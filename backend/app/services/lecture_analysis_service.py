import logging
import time

from pydantic import BaseModel, Field

from app.core.config import load_settings
from app.services.ai_error_utils import format_exception_for_user, is_transient_ai_provider_error
from app.services.genai_client_factory import create_genai_client

try:
    from google import genai
except ImportError:
    genai = None


logger = logging.getLogger("somali_notes.lecture_analysis")


class LectureAnalysisPayload(BaseModel):
    confidence_score: float = Field(ge=0, le=100)
    confidence_label: str
    valuation_summary: str
    genre_label: str
    genre_explanation: str


class LectureAnalysisService:
    def __init__(self):
        settings = load_settings()
        api_key = (settings.GEMINI_API_KEY or "").strip()
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not configured in backend/.env, so lecture analysis cannot run."
            )
        if genai is None:
            raise RuntimeError(
                "google-genai is not installed, so lecture analysis cannot run."
            )
        self.client = create_genai_client(api_key)
        self.model = settings.GEMMA_MODEL
        self.fallback_model = settings.GEMINI_CHAT_MODEL
        self.analysis_models = [
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

    def _clip_text(self, value: str, limit: int) -> str:
        cleaned_value = value.strip()
        if len(cleaned_value) <= limit:
            return cleaned_value
        return f"{cleaned_value[:limit]}\n\n[truncated]"

    def analyze_lecture(
        self,
        lecture_title: str,
        transcript_text: str,
        notes_payload: dict[str, str | list | dict],
    ) -> dict[str, str | float]:
        transcript_excerpt = self._clip_text(transcript_text, 18000)
        detailed_notes = self._clip_text(
            str(notes_payload.get("structured_content", "")),
            10000,
        )
        prompt = f"""You are an expert academic evaluator.
Analyze how well the prepared notes match the lecture transcript and classify the lecture genre as specifically as possible.

Return strict JSON with exactly these keys:
- confidence_score: number from 0 to 100 measuring how well the notes align with the transcript
- confidence_label: short phrase such as "Strong alignment", "Moderate alignment", or "Needs improvement"
- valuation_summary: 2 concise sentences explaining what the notes captured well and what may be missing or less precise
- genre_label: a highly specific lecture genre such as "Python Programming", "Artificial Intelligence", "Business Strategy", "Organic Chemistry", "Public Speaking", or similar
- genre_explanation: 2 to 3 sentences explaining why this exact genre fits based on the lecture title and content

Guidelines:
- Be specific with the genre; avoid broad labels like only "Educational" unless the content truly has no clearer topic.
- Use the transcript and notes together for the confidence score.
- Keep the explanation professional and direct.
- Do not include markdown in the JSON values.

Lecture title:
{lecture_title}

Transcript excerpt:
{transcript_excerpt}

Somali notes summary:
{notes_payload.get("summary", "")}

Somali key points:
{notes_payload.get("key_points", [])}

Somali detailed notes excerpt:
{detailed_notes}
"""

        response = self._generate_analysis_with_fallback(prompt)

        parsed = getattr(response, "parsed", None)
        if parsed is not None:
            if isinstance(parsed, LectureAnalysisPayload):
                return parsed.model_dump()
            return LectureAnalysisPayload.model_validate(parsed).model_dump()

        response_text = getattr(response, "text", None)
        if not response_text:
            raise RuntimeError("Gemma returned an empty response for lecture analysis.")

        return LectureAnalysisPayload.model_validate_json(response_text).model_dump()

    def _generate_analysis_with_fallback(self, prompt: str):
        last_error: Exception | None = None

        for model_index, model in enumerate(self.analysis_models):
            attempts = self.transient_retry_attempts
            for attempt in range(1, attempts + 1):
                try:
                    if model_index > 0 or attempt > 1:
                        logger.warning(
                            "Retrying lecture analysis with model %s (attempt %s/%s).",
                            model,
                            attempt,
                            attempts,
                        )
                    return self.client.models.generate_content(
                        model=model,
                        contents=prompt,
                        config={
                            "response_mime_type": "application/json",
                            "response_schema": LectureAnalysisPayload,
                        },
                    )
                except Exception as exc:
                    last_error = exc
                    if not is_transient_ai_provider_error(exc):
                        raise RuntimeError(format_exception_for_user(exc, "lecture_analysis")) from exc

                    logger.warning(
                        "Lecture analysis provider error with model %s: %s",
                        model,
                        format_exception_for_user(exc, "lecture_analysis"),
                    )
                    if attempt < attempts:
                        sleep_seconds = min(
                            self.transient_retry_base_seconds * (2 ** (attempt - 1)),
                            self.transient_retry_max_seconds,
                        )
                        time.sleep(sleep_seconds)

        if last_error is not None:
            raise RuntimeError(format_exception_for_user(last_error, "lecture_analysis")) from last_error

        raise RuntimeError("No AI model is configured for lecture analysis.")
