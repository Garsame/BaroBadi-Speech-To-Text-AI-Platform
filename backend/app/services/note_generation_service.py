import concurrent.futures
import json
import logging
import re
import time
import unicodedata
from typing import Any

from pydantic import BaseModel

from app.core.config import load_settings
from app.services.ai_error_utils import format_exception_for_user, is_transient_ai_provider_error
from app.services.genai_client_factory import create_genai_client

try:
    from google import genai
except ImportError:
    genai = None


logger = logging.getLogger("somali_notes.note_generation")


class SomaliNotesPayload(BaseModel):
    structured_content: str
    summary: str
    key_points: list[str]
    glossary: list[str]
    revision_questions: list[str]


class TranscriptChunkDigestPayload(BaseModel):
    chunk_summary: str
    key_points: list[str]


class NoteGenerationService:
    MAX_TRANSCRIPT_CHUNKS = 12
    MAX_REPAIR_ATTEMPTS = 2

    TEXT_REPLACEMENTS = {
        "\u00a0": " ",
        "\u200b": "",
        "\u200c": "",
        "\u200d": "",
        "\u2060": "",
        "\ufeff": "",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2013": "-",
        "\u2014": "-",
        "\u2212": "-",
        "\u2022": "- ",
        "\u25cf": "- ",
        "\u25e6": "- ",
    }

    ALLOWED_ENGLISH_TOKENS = {
        "ai",
        "api",
        "aws",
        "azure",
        "chatgpt",
        "claude",
        "cpu",
        "css",
        "docker",
        "excel",
        "fastapi",
        "figma",
        "gcp",
        "gemini",
        "gemma",
        "github",
        "git",
        "gpt",
        "gpu",
        "html",
        "iaas",
        "javascript",
        "json",
        "jupyter",
        "llm",
        "ml",
        "mongodb",
        "mysql",
        "next.js",
        "node.js",
        "node",
        "numpy",
        "opencv",
        "pandas",
        "paas",
        "pdf",
        "postgresql",
        "powerpoint",
        "python",
        "pytorch",
        "react",
        "redis",
        "saas",
        "sql",
        "tensorflow",
        "typescript",
        "ui",
        "ux",
        "youtube",
    }

    ENGLISH_STOPWORDS = {
        "a",
        "an",
        "and",
        "are",
        "as",
        "at",
        "be",
        "been",
        "being",
        "between",
        "by",
        "can",
        "compared",
        "comparison",
        "definition",
        "detailed",
        "does",
        "each",
        "for",
        "from",
        "how",
        "if",
        "in",
        "instead",
        "into",
        "is",
        "it",
        "its",
        "more",
        "most",
        "needs",
        "of",
        "on",
        "only",
        "or",
        "over",
        "provided",
        "requires",
        "service",
        "services",
        "should",
        "such",
        "than",
        "that",
        "the",
        "their",
        "them",
        "these",
        "this",
        "through",
        "to",
        "under",
        "uses",
        "using",
        "very",
        "vs",
        "what",
        "when",
        "where",
        "which",
        "who",
        "why",
        "with",
        "without",
    }

    ENGLISH_DOMAIN_WORDS = {
        "application",
        "applications",
        "architecture",
        "cloud",
        "comparison",
        "computing",
        "concept",
        "concepts",
        "conclusion",
        "database",
        "databases",
        "definition",
        "deployment",
        "development",
        "example",
        "examples",
        "explanation",
        "framework",
        "hardware",
        "hosting",
        "infrastructure",
        "introduction",
        "key",
        "learning",
        "maintenance",
        "management",
        "model",
        "models",
        "network",
        "notes",
        "operations",
        "overview",
        "platform",
        "points",
        "popular",
        "private",
        "provider",
        "providers",
        "public",
        "runtime",
        "scalability",
        "security",
        "server",
        "servers",
        "service",
        "services",
        "software",
        "storage",
        "summary",
        "testing",
        "training",
        "virtualization",
    }

    SOMALI_MARKERS = {
        "ah",
        "ama",
        "ayaa",
        "ayuu",
        "ay",
        "balse",
        "dhexeeya",
        "iyada",
        "inta",
        "iyo",
        "ka",
        "kale",
        "la",
        "loo",
        "marka",
        "oo",
        "qaybta",
        "sida",
        "si",
        "u",
        "ugu",
        "waxa",
        "waxay",
        "waxuu",
        "waxa",
        "waa",
        "wuxuu",
        "ku",
    }

    def __init__(self):
        settings = load_settings()
        api_key = (settings.GEMINI_API_KEY or "").strip()
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not configured in backend/.env, so Somali note generation cannot run."
            )
        if genai is None:
            raise RuntimeError(
                "google-genai is not installed, so Somali note generation cannot run."
            )
        self.client = create_genai_client(api_key)
        self.model = settings.GEMMA_MODEL
        self.fallback_model = settings.GEMINI_CHAT_MODEL
        self.note_models = [
            model
            for index, model in enumerate([self.model, self.fallback_model])
            if model and model not in [self.model, self.fallback_model][:index]
        ]
        self.transient_retry_attempts = max(1, settings.AI_PROVIDER_RETRY_ATTEMPTS)
        self.transient_retry_base_seconds = max(0.5, settings.AI_PROVIDER_RETRY_BASE_SECONDS)
        self.transient_retry_max_seconds = max(
            self.transient_retry_base_seconds,
            settings.AI_PROVIDER_RETRY_MAX_SECONDS,
        )
        self.transcript_chunk_char_limit = max(
            8000,
            settings.NOTES_TRANSCRIPT_CHUNK_CHAR_LIMIT,
        )

    def _clip_text(self, value: str, limit: int) -> str:
        cleaned_value = (value or "").strip()
        if len(cleaned_value) <= limit:
            return cleaned_value
        return f"{cleaned_value[:limit]}\n\n[truncated]"

    def _normalize_text(self, value: str) -> str:
        normalized = unicodedata.normalize("NFKC", value or "")
        for source, target in self.TEXT_REPLACEMENTS.items():
            normalized = normalized.replace(source, target)

        normalized = normalized.replace("\r\n", "\n").replace("\r", "\n")
        normalized = re.sub("(?m)^[ \\t]*[*\\u2022]\\s+", "- ", normalized)
        normalized = re.sub(r"(?m)^[ \t]*-\s{2,}", "- ", normalized)
        normalized = re.sub(r"\*{3}([^*\n]+)\*{3}", r"**\1**", normalized)
        normalized = re.sub(r"(?<!\*)\*([^*\n]+)\*(?!\*)", r"\1", normalized)
        normalized = re.sub(r"_([^_\n]+)_", r"\1", normalized)
        normalized = re.sub(r"(?m)^[ \t]*[-=]{3,}[ \t]*$", "", normalized)
        normalized = re.sub(r"[ \t]+\n", "\n", normalized)
        normalized = re.sub(r"\n{3,}", "\n\n", normalized)
        normalized = re.sub(r"[ \t]{2,}", " ", normalized)
        return normalized.strip()

    def _sanitize_transcript_for_generation(self, transcript_text: str) -> str:
        cleaned_transcript = self._normalize_text(transcript_text)
        cleaned_transcript = re.sub(r"\n{3,}", "\n\n", cleaned_transcript)
        return cleaned_transcript

    def _split_text_into_chunks(self, text: str, limit: int) -> list[str]:
        cleaned_text = (text or "").strip()
        if not cleaned_text:
            return []

        if len(cleaned_text) <= limit:
            return [cleaned_text]

        chunks: list[str] = []
        current_chunk = ""

        def flush_chunk() -> None:
            nonlocal current_chunk
            if current_chunk.strip():
                chunks.append(current_chunk.strip())
            current_chunk = ""

        paragraphs = [
            paragraph.strip()
            for paragraph in re.split(r"\n{2,}", cleaned_text)
            if paragraph.strip()
        ] or [cleaned_text]

        for paragraph in paragraphs:
            if len(paragraph) > limit:
                sentences = [
                    sentence.strip()
                    for sentence in re.split(r"(?<=[.!?])\s+", paragraph)
                    if sentence.strip()
                ] or [paragraph]
            else:
                sentences = [paragraph]

            for sentence in sentences:
                candidate = f"{current_chunk}\n\n{sentence}".strip() if current_chunk else sentence
                if len(candidate) <= limit:
                    current_chunk = candidate
                    continue

                if current_chunk:
                    flush_chunk()

                if len(sentence) <= limit:
                    current_chunk = sentence
                    continue

                start_index = 0
                while start_index < len(sentence):
                    end_index = start_index + limit
                    chunks.append(sentence[start_index:end_index].strip())
                    start_index = end_index

        flush_chunk()

        if len(chunks) <= self.MAX_TRANSCRIPT_CHUNKS:
            return chunks

        limited_chunks = chunks[: self.MAX_TRANSCRIPT_CHUNKS - 1]
        remaining = "\n\n".join(chunks[self.MAX_TRANSCRIPT_CHUNKS - 1 :])
        limited_chunks.append(self._clip_text(remaining, limit))
        return limited_chunks

    def _normalize_payload(self, payload: dict[str, Any]) -> dict[str, str | list[str]]:
        structured_content = self._normalize_text(str(payload.get("structured_content", "")))
        summary = self._normalize_text(str(payload.get("summary", "")))

        def normalize_string_list(raw_items: Any) -> list[str]:
            if not isinstance(raw_items, list):
                raw_items = [
                    part
                    for part in re.split(r"\n+", str(raw_items))
                    if str(part).strip()
                ]

            cleaned_items: list[str] = []
            seen_items: set[str] = set()
            for item in raw_items:
                cleaned_item = self._normalize_text(str(item))
                cleaned_item = re.sub("^[-*\\u2022]\\s+", "", cleaned_item).strip()
                if not cleaned_item:
                    continue

                dedupe_key = cleaned_item.casefold()
                if dedupe_key in seen_items:
                    continue

                seen_items.add(dedupe_key)
                cleaned_items.append(cleaned_item)

            return cleaned_items

        return {
            "structured_content": structured_content,
            "summary": summary,
            "key_points": normalize_string_list(payload.get("key_points", [])),
            "glossary": normalize_string_list(payload.get("glossary", [])),
            "revision_questions": normalize_string_list(
                payload.get("revision_questions", [])
            ),
        }

    def _generate_content_with_fallback(self, prompt: str, response_schema: type[BaseModel]):
        last_error: Exception | None = None

        for model_index, model in enumerate(self.note_models):
            attempts = self.transient_retry_attempts
            for attempt in range(1, attempts + 1):
                try:
                    if model_index > 0 or attempt > 1:
                        logger.warning(
                            "Retrying Somali note generation with model %s (attempt %s/%s).",
                            model,
                            attempt,
                            attempts,
                        )
                    return self.client.models.generate_content(
                        model=model,
                        contents=prompt,
                        config={
                            "response_mime_type": "application/json",
                            "response_schema": response_schema,
                        },
                    )
                except Exception as exc:
                    last_error = exc
                    if not is_transient_ai_provider_error(exc):
                        raise RuntimeError(format_exception_for_user(exc, "generating_notes")) from exc

                    logger.warning(
                        "Somali note generation provider error with model %s: %s",
                        model,
                        format_exception_for_user(exc, "generating_notes"),
                    )
                    if attempt < attempts:
                        sleep_seconds = min(
                            self.transient_retry_base_seconds * (2 ** (attempt - 1)),
                            self.transient_retry_max_seconds,
                        )
                        time.sleep(sleep_seconds)

        if last_error is not None:
            raise RuntimeError(format_exception_for_user(last_error, "generating_notes")) from last_error

        raise RuntimeError("No AI model is configured for Somali note generation.")

    def _request_payload(self, prompt: str) -> dict[str, str | list[str]]:
        response = self._generate_content_with_fallback(prompt, SomaliNotesPayload)

        parsed = getattr(response, "parsed", None)
        if parsed is not None:
            if isinstance(parsed, SomaliNotesPayload):
                return parsed.model_dump()
            return SomaliNotesPayload.model_validate(parsed).model_dump()

        response_text = getattr(response, "text", None)
        if not response_text:
            raise RuntimeError("Gemma returned an empty response for Somali note generation.")

        return SomaliNotesPayload.model_validate_json(response_text).model_dump()

    def _request_chunk_digest(self, prompt: str) -> dict[str, str | list[str]]:
        response = self._generate_content_with_fallback(prompt, TranscriptChunkDigestPayload)

        parsed = getattr(response, "parsed", None)
        if parsed is not None:
            if isinstance(parsed, TranscriptChunkDigestPayload):
                return parsed.model_dump()
            return TranscriptChunkDigestPayload.model_validate(parsed).model_dump()

        response_text = getattr(response, "text", None)
        if not response_text:
            raise RuntimeError("Gemma returned an empty response while summarizing a transcript chunk.")

        return TranscriptChunkDigestPayload.model_validate_json(response_text).model_dump()

    def _find_foreign_scripts(self, text: str) -> list[str]:
        scripts: set[str] = set()
        for char in text:
            if char.isascii() or not char.isalpha():
                continue

            char_name = unicodedata.name(char, "")
            if not char_name or "LATIN" in char_name:
                continue

            scripts.add(char_name.split(" ")[0].title())

        return sorted(scripts)

    def _line_has_suspicious_english(self, line: str) -> bool:
        stripped = line.strip()
        if not stripped:
            return False

        raw_tokens = re.findall(r"[A-Za-z][A-Za-z0-9'.-]*", stripped)
        if not raw_tokens:
            return False

        filtered_tokens: list[str] = []
        for token in raw_tokens:
            lowered = token.strip(".'-").lower()
            if not lowered:
                continue
            if lowered in self.ALLOWED_ENGLISH_TOKENS:
                continue
            if token.isupper() and len(token) <= 8:
                continue
            filtered_tokens.append(lowered)

        if not filtered_tokens:
            return False

        english_hits = sum(token in self.ENGLISH_STOPWORDS for token in filtered_tokens)
        domain_hits = sum(token in self.ENGLISH_DOMAIN_WORDS for token in filtered_tokens)
        somali_hits = sum(token in self.SOMALI_MARKERS for token in filtered_tokens)

        if english_hits + domain_hits >= 3 and english_hits + domain_hits >= somali_hits + 2:
            return True

        if stripped.startswith(("#", "**")) and english_hits + domain_hits >= 2 and somali_hits == 0:
            return True

        return False

    def _find_validation_issues(
        self,
        payload: dict[str, str | list[str]],
        transcript_text: str,
    ) -> list[str]:
        issues: list[str] = []
        structured_content = str(payload.get("structured_content", "")).strip()
        summary = str(payload.get("summary", "")).strip()
        key_points = payload.get("key_points", [])
        glossary = payload.get("glossary", [])
        revision_questions = payload.get("revision_questions", [])
        full_text = "\n".join(
            [
                summary,
                structured_content,
                *[str(point) for point in key_points or []],
                *[str(entry) for entry in glossary or []],
                *[str(question) for question in revision_questions or []],
            ]
        )

        if not structured_content:
            issues.append("Structured Somali notes are empty.")
        if not summary:
            issues.append("Somali summary is empty.")
        if not key_points:
            issues.append("Key points list is empty.")
        if not glossary:
            issues.append("Glossary list is empty.")
        if not revision_questions:
            issues.append("Revision questions list is empty.")

        transcript_word_count = len(re.findall(r"[A-Za-z']+", transcript_text))
        summary_word_count = len(re.findall(r"[A-Za-z']+", summary))
        structured_word_count = len(re.findall(r"[A-Za-z']+", structured_content))
        minimum_structured_words = min(2500, max(650, transcript_word_count // 8))

        if summary and summary_word_count < 18:
            issues.append("Summary is too short and not descriptive enough.")
        if structured_content and structured_word_count < minimum_structured_words:
            issues.append("Detailed notes are too short for the transcript length.")
        if structured_content.count("### ") < 2:
            issues.append("Detailed notes need at least two clear Somali section headings.")

        if isinstance(key_points, list):
            if len(key_points) < 12:
                issues.append("Key points should contain at least twelve useful Somali points.")
            short_points = [
                point
                for point in key_points
                if len(re.findall(r"[A-Za-z']+", str(point))) < 6
            ]
            if len(short_points) > 1:
                issues.append("Several key points are too short to be useful.")
        if isinstance(glossary, list) and len(glossary) < 5:
            issues.append("Glossary should contain at least five useful Somali definitions.")
        if isinstance(revision_questions, list) and len(revision_questions) < 5:
            issues.append("Revision questions should contain at least five useful questions.")

        foreign_scripts = self._find_foreign_scripts(full_text)
        if foreign_scripts:
            issues.append(
                f"Unexpected foreign-script characters detected: {', '.join(foreign_scripts[:4])}."
            )

        suspicious_lines: list[str] = []
        for line in full_text.splitlines():
            if self._line_has_suspicious_english(line):
                suspicious_lines.append(line.strip())
            if len(suspicious_lines) >= 4:
                break

        if suspicious_lines:
            issues.append(
                "English leakage detected in lines such as: "
                + " | ".join(suspicious_lines)
            )

        if structured_content.count("**") % 2 != 0:
            issues.append("Detailed notes contain unmatched bold markers.")

        return issues

    def _build_chunk_digest_prompt(self, transcript_chunk, chunk_index, total_chunks):
        return f"""Waxaad diyaarinaysaa xog faahfaahsan oo laga sameyn doono Somali study notes dambe.
Soo koob qaybta {chunk_index} ee {total_chunks} ee transcript-ka.
Soo celi strict JSON oo leh:
- chunk_summary: 6 ilaa 10 weedhood oo Somali rasmi ah oo sharaxaya fikradaha ugu muhiimsan ee qaybtan si faahfaahsan
- key_points: 8 ilaa 12 qodob oo Somali ah oo faahfaahsan, mid kasta oo sharaxaya fikrad gaar ah oo ka timid qaybtan

Xeerar:
- Ha gaabinin — qaybtani waxay ka mid tahay muhadaro dheer, markaa ilaaliso DHAMMAAN fikradaha muhiimsan.
- Haddii eray farsamo muhiim yahay, marka hore sharax Somali ahaan, ka dibna ku qor magaca Ingiriisiga xiga xagga midig ee jaantusyada.
- Qor si faahfaahsan — ardayga waa inuu fahmi karaa qaybtan oo kaliya adiga oo u sharaxaya.
- Ku dar tusaalooyin haddii transcript-ku leeyahay.

Transcript chunk:
{transcript_chunk}
"""

    def _build_compact_source_material(
        self,
        transcript_text: str,
    ) -> tuple[str, dict[str, int | str]]:
        chunks = self._split_text_into_chunks(
            transcript_text,
            self.transcript_chunk_char_limit,
        )

        if len(chunks) <= 1:
            return transcript_text, {
                "source_strategy": "single_pass",
                "source_chunks": max(1, len(chunks)),
            }

        condensed_sections: list[str | None] = [None] * len(chunks)

        def process_chunk_digest(index: int, chunk: str):
            try:
                digest = self._request_chunk_digest(
                    self._build_chunk_digest_prompt(chunk, index, len(chunks))
                )
                key_points = [
                    f"- {self._normalize_text(str(point))}"
                    for point in digest.get("key_points", [])
                    if str(point).strip()
                ]
                section_lines = [
                    f"### Qaybta {index}",
                    self._normalize_text(str(digest.get("chunk_summary", ""))),
                ]
                if key_points:
                    section_lines.extend(key_points)
                return "\n".join(section_lines).strip()
            except Exception as exc:
                logger.error(f"Error digesting chunk {index}: {exc}")
                return f"### Qaybta {index}\n[Error summary generation failed for this part]"

        with concurrent.futures.ThreadPoolExecutor(max_workers=min(len(chunks), 16)) as executor:
            future_to_index = {
                executor.submit(process_chunk_digest, i, chunk): i
                for i, chunk in enumerate(chunks, start=1)
            }
            for future in concurrent.futures.as_completed(future_to_index):
                idx = future_to_index[future]
                condensed_sections[idx - 1] = future.result()

        return "\n\n".join(filter(None, condensed_sections)).strip(), {
            "source_strategy": "hierarchical_digest",
            "source_chunks": len(chunks),
        }

    def _build_generation_prompt(self, source_material):
        return f"""You are a senior Somali academic note writer, translator, and curriculum designer.
Your job is to convert the full lecture source material into comprehensive, detailed Somali study notes.
This lecture is long (potentially 1–2 hours). You MUST cover the ENTIRE content — do not skip, compress, or summarize away any topic, concept, or section from the source material.

Return strict JSON with exactly these keys:
- structured_content: comprehensive Somali notes in clean markdown covering EVERY topic in the lecture
- summary: 4 to 6 formal Somali sentences covering the full scope of the lecture
- key_points: 15 to 25 Somali bullet ideas as a JSON list of strings, one per major concept
- glossary: 8 to 15 entries as a JSON list of strings, each in format "Magaca Ereyga: sharaxaad Somali ah (English term)"
- revision_questions: 8 to 12 Somali revision questions as a JSON list of strings that test understanding of the lecture

Non-negotiable language rules:
- All explanatory prose must be in natural, formal Somali.
- Do not leave full headings, full sentences, or bullet items in English.
- Only keep proper nouns, product names, programming languages, and short acronyms in English when necessary (e.g. Python, AWS, API, SQL, AI, IaaS, PaaS, SaaS).
- When a technical English term is important, explain it in Somali first and place the English term in parentheses only once.
- Remove corruption, strange symbols, foreign scripts, placeholder text, and transcript noise.
- Correct obvious wording mistakes from the transcript when they are clearly accidental.
- Do not use code fences, HTML, tables, or numbered JSON objects.

Writing quality rules:
- Write like a strong Somali lecturer preparing comprehensive revision notes for university students.
- Go beyond simple translation: explain the meaning, why the idea matters, and how ideas connect to each other.
- Prefer clear Somali sentences over literal English structure.
- Keep the tone formal, accurate, and student-friendly.
- Use markdown that renders cleanly:
  - use headings like ### Cinwaan
  - use subsection labels like **Qodob Muhiim ah**
  - use bullet lists with -
- Avoid raw asterisks, malformed markdown, and decorative separators.

Required structure for structured_content — you MUST include ALL of these sections:
1. ### Dulmar Faahfaahsan  
   (Full overview of the entire lecture — what it covers and why it matters)

2. ### Mawduucyada Ugu Muhiimsan  
   (One detailed subsection per major topic in the lecture. Each subsection must have a bold heading, descriptive Somali paragraphs, and bullet points. Do NOT merge multiple topics into one subsection — give each its own space.)

3. ### Tusaalooyin iyo Adeegsi  
   (Real examples, use cases, or demonstrations mentioned in the lecture, explained in Somali)

4. ### Erayo Muhiim ah (Glossary)  
   (Key terms defined in Somali with English in parentheses)

5. ### Su'aalaha Dib-u-Eegista  
   (Revision questions in Somali)

6. ### Gunaanad  
   (Closing summary of the most important takeaways from the full lecture)

IMPORTANT: The structured_content must be proportional to the lecture length. A 2-hour lecture must produce long, detailed notes — not a short summary. Every major topic discussed in the source material must appear as its own subsection.

Source material:
{source_material}
"""

    def _build_repair_prompt(
        self,
        transcript_text: str,
        draft_payload: dict[str, str | list[str]],
        issues: list[str],
    ) -> str:
        serialized_draft = json.dumps(draft_payload, ensure_ascii=False, indent=2)
        serialized_issues = "\n".join(f"- {issue}" for issue in issues)

        return f"""You are a strict Somali academic editor and quality-control reviewer.
Rewrite the draft notes so they become high-quality Somali study notes that fully satisfy the rules below.

Return strict JSON with exactly these keys:
- structured_content
- summary
- key_points
- glossary
- revision_questions

Problems found in the draft:
{serialized_issues}

Repair rules:
- Rewrite every English heading, sentence, and bullet into Somali unless it is a necessary proper noun or short acronym.
- Remove corrupted symbols, foreign-script characters, copied transcript fragments, and malformed markdown.
- Make the notes richer and clearer than the draft by explaining concepts, significance, and examples when the transcript supports them.
- Keep the tone formal, polished, and easy for Somali-speaking students to study from.
- Use clean markdown headings with ### and clean bullet lists with -.
- Ensure summary is 4 to 6 full Somali sentences.
- Ensure key_points contains 15 to 25 strong Somali points when the source supports it.
- Ensure glossary contains 8 to 15 useful Somali definitions when the source supports it.
- Ensure revision_questions contains 8 to 12 Somali questions when the source supports it.
- Ensure structured_content includes the required sections: Dulmar Faahfaahsan, Mawduucyada Ugu Muhiimsan, Tusaalooyin iyo Adeegsi, Erayo Muhiim ah, Su'aalaha Dib-u-Eegista, and Gunaanad.

Source transcript:
{transcript_text}

Draft JSON to repair:
{serialized_draft}
"""

    def generate_somali_notes(self, english_transcript: str) -> dict[str, str | list | dict]:
        """
        Converts an English transcript into detailed Somali study notes.
        The response is validated, normalized, repaired when needed, and rejected
        if mixed-language or corrupted output remains after QA.
        """
        transcript_text = self._sanitize_transcript_for_generation(english_transcript)
        if not transcript_text:
            raise RuntimeError("Transcript is empty after sanitization, so Somali note generation cannot continue.")

        source_material, source_metadata = self._build_compact_source_material(transcript_text)
        draft_payload = self._normalize_payload(
            self._request_payload(self._build_generation_prompt(source_material))
        )
        issues = self._find_validation_issues(draft_payload, transcript_text)

        repair_applied = False
        attempt_count = 1
        final_payload = draft_payload

        while issues and attempt_count <= self.MAX_REPAIR_ATTEMPTS:
            repair_applied = True
            logger.warning(
                "Somali note QA detected issues on attempt %s: %s",
                attempt_count,
                issues,
            )
            final_payload = self._normalize_payload(
                self._request_payload(
                    self._build_repair_prompt(source_material, final_payload, issues)
                )
            )
            issues = self._find_validation_issues(final_payload, transcript_text)
            attempt_count += 1

        if issues:
            logger.error("Somali note QA rejected output after repair: %s", issues)
            raise RuntimeError(
                "Somali notes failed the language-quality checks after repair. Please retry the lecture generation."
            )

        return {
            **final_payload,
            "metadata": {
                "guardrail_version": "somali_notes_v2",
                "repair_applied": repair_applied,
                "repair_attempts": max(0, attempt_count - 1),
                "transcript_chars_used": len(transcript_text),
                "source_material_chars_used": len(source_material),
                **source_metadata,
            },
        }
