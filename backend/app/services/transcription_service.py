import logging
import time
from typing import Any

from app.core.config import load_settings
from app.services.genai_client_factory import create_genai_client

try:
    from google import genai
except ImportError:
    genai = None

logger = logging.getLogger("somali_notes.transcription")


class TranscriptionService:
    RECITATION_ERROR_MARKERS = (
        "finishreason.recitation",
        "finish_reason=finishreason.recitation",
        "recitation",
    )

    RETRYABLE_ERROR_MARKERS = (
        "server disconnected without sending a response",
        "getaddrinfo failed",
        "timed out",
        "timeout",
        "503",
        "unavailable",
        "connection reset",
        "temporary failure",
        "remoteprotocolerror",
    )

    def __init__(self):
        settings = load_settings()
        api_key = (settings.GEMINI_API_KEY or "").strip()
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not configured in backend/.env, so real transcription cannot run."
            )
        if genai is None:
            raise RuntimeError(
                "google-genai is not installed, so real transcription cannot run."
            )
        self.client = create_genai_client(api_key)
        self.model = settings.GEMINI_TRANSCRIPTION_MODEL
        self.max_retries = max(1, settings.TRANSCRIPTION_MAX_RETRIES)
        self.file_ready_timeout_seconds = max(
            30,
            settings.GEMINI_FILE_READY_TIMEOUT_SECONDS,
        )

    def _wait_for_file_ready(self, file_name: str):
        attempts = max(1, self.file_ready_timeout_seconds // 2)
        for _ in range(attempts):
            file_ref = self.client.files.get(name=file_name)
            state = str(getattr(file_ref, "state", "")).upper()
            if state.endswith("ACTIVE") or not state:
                return file_ref
            if state.endswith("FAILED"):
                raise RuntimeError("Gemini audio upload failed during processing.")
            time.sleep(2)

        raise RuntimeError("Gemini audio upload did not become ready in time.")

    def _is_retryable_error(self, exc: Exception) -> bool:
        message = str(exc).lower()
        return any(marker in message for marker in self.RETRYABLE_ERROR_MARKERS)

    def is_recitation_error(self, exc: Exception) -> bool:
        message = str(exc).lower()
        return any(marker in message for marker in self.RECITATION_ERROR_MARKERS)

    def _extract_text_from_response(self, response: Any) -> str:
        transcript_text = (getattr(response, "text", "") or "").strip()
        if transcript_text:
            return transcript_text

        candidates = getattr(response, "candidates", None) or []
        parts_text: list[str] = []

        for candidate in candidates:
            content = getattr(candidate, "content", None)
            if not content:
                continue

            for part in getattr(content, "parts", None) or []:
                part_text = getattr(part, "text", None)
                if part_text and part_text.strip():
                    parts_text.append(part_text.strip())

        return "\n".join(parts_text).strip()

    def _summarize_response(self, response: Any) -> str:
        candidates = getattr(response, "candidates", None) or []
        summary_parts = [
            f"text_len={len((getattr(response, 'text', '') or '').strip())}",
            f"candidates={len(candidates)}",
        ]

        if candidates:
            first_candidate = candidates[0]
            finish_reason = getattr(first_candidate, "finish_reason", None)
            if finish_reason is not None:
                summary_parts.append(f"finish_reason={finish_reason}")

            content = getattr(first_candidate, "content", None)
            parts = getattr(content, "parts", None) or []
            summary_parts.append(f"parts={len(parts)}")

        prompt_feedback = getattr(response, "prompt_feedback", None)
        if prompt_feedback is not None:
            summary_parts.append(f"prompt_feedback={prompt_feedback}")

        usage_metadata = getattr(response, "usage_metadata", None)
        if usage_metadata is not None:
            summary_parts.append(f"usage_metadata={usage_metadata}")

        return ", ".join(summary_parts)

    def _transcribe_audio_once(self, audio_file_path: str) -> str:
        """
        Transcribes audio using the Google Gemini API.
        """
        uploaded_file = None
        try:
            logger.info(
                "Starting Gemini transcription for %s with model %s",
                audio_file_path,
                self.model,
            )
            uploaded_file = self.client.files.upload(file=audio_file_path)
            logger.info(
                "Uploaded audio to Gemini: name=%s state=%s",
                getattr(uploaded_file, "name", "unknown"),
                getattr(uploaded_file, "state", "unknown"),
            )
            uploaded_file = self._wait_for_file_ready(uploaded_file.name)
            logger.info(
                "Gemini audio file is ready: name=%s state=%s",
                getattr(uploaded_file, "name", "unknown"),
                getattr(uploaded_file, "state", "unknown"),
            )

            transcript = self.client.models.generate_content(
                model=self.model,
                contents=[
                    "Generate a plain text transcript of the spoken audio. Do not summarize. Do not add commentary.",
                    uploaded_file,
                ],
            )

            transcript_text = self._extract_text_from_response(transcript)
            if not transcript_text:
                response_summary = self._summarize_response(transcript)
                logger.error(
                    "Gemini returned no transcript text for %s. %s",
                    audio_file_path,
                    response_summary,
                )
                raise RuntimeError(
                    f"Gemini returned an empty transcription response. {response_summary}"
                )

            logger.info(
                "Gemini transcription completed for %s with %s characters.",
                audio_file_path,
                len(transcript_text),
            )
            return transcript_text
        except Exception:
            logger.exception(
                "Gemini transcription failed for %s with model %s",
                audio_file_path,
                self.model,
            )
            raise
        finally:
            if uploaded_file is not None:
                try:
                    self.client.files.delete(name=uploaded_file.name)
                except Exception:
                    logger.warning(
                        "Failed to delete Gemini upload %s after transcription.",
                        getattr(uploaded_file, "name", "unknown"),
                    )

    def transcribe_audio(self, audio_file_path: str) -> str:
        last_error: Exception | None = None

        for attempt in range(1, self.max_retries + 1):
            try:
                if attempt > 1:
                    logger.warning(
                        "Retrying Gemini transcription for %s (attempt %s/%s).",
                        audio_file_path,
                        attempt,
                        self.max_retries,
                    )
                return self._transcribe_audio_once(audio_file_path)
            except Exception as exc:
                last_error = exc
                if attempt >= self.max_retries or not self._is_retryable_error(exc):
                    break
                time.sleep(min(2 ** attempt, 10))

        if last_error is None:
            raise RuntimeError("Gemini transcription failed for an unknown reason.")

        raise RuntimeError(
            f"Gemini transcription failed after {self.max_retries} attempt(s): {last_error}"
        ) from last_error
