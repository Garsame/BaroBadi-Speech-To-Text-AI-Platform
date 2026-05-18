import ast
import re
from typing import Any


STAGE_LABELS = {
    "validating_input": "Lecture input validation",
    "preparing_media": "Media preparation",
    "extracting_audio": "Audio extraction",
    "preparing_audio": "Audio preparation",
    "transcribing": "Audio transcription",
    "cleaning_transcript": "Transcript cleanup",
    "generating_notes": "Somali note generation",
    "lecture_analysis": "AI lecture analysis",
    "lecture_chat": "Lecture chatbot",
    "saving_results": "Saving lecture results",
}


def _stage_key(stage: Any) -> str:
    value = getattr(stage, "value", None) or str(stage or "")
    return value.split(".")[-1]


def _stage_label(stage: Any) -> str:
    key = _stage_key(stage)
    return STAGE_LABELS.get(key, key.replace("_", " ").strip().title() or "Lecture processing")


def _clean_message(message: str) -> str:
    return re.sub(r"\s+", " ", (message or "").strip())


def _truncate(message: str, limit: int = 950) -> str:
    cleaned = _clean_message(message)
    if len(cleaned) <= limit:
        return cleaned
    return f"{cleaned[: limit - 3].rstrip()}..."


def _extract_provider_error(raw_message: str) -> dict[str, str | int] | None:
    header_match = re.search(r"\b(?P<code>\d{3})\s+(?P<status>[A-Z_]+)\b", raw_message)
    parsed_error: dict[str, Any] = {}

    start = raw_message.find("{")
    end = raw_message.rfind("}")
    if start != -1 and end > start:
        try:
            payload = ast.literal_eval(raw_message[start : end + 1])
            if isinstance(payload, dict):
                raw_error = payload.get("error")
                if isinstance(raw_error, dict):
                    parsed_error = raw_error
        except (SyntaxError, ValueError):
            parsed_error = {}

    code_value = parsed_error.get("code")
    code = int(code_value) if isinstance(code_value, int | str) and str(code_value).isdigit() else None
    status = str(parsed_error.get("status") or "").strip().upper()
    message = str(parsed_error.get("message") or "").strip()

    if header_match:
        code = code or int(header_match.group("code"))
        status = status or header_match.group("status")

    if not code and not status and not message:
        return None

    return {
        "code": code or "unknown",
        "status": status or "UNKNOWN",
        "message": message or "The AI provider did not return a detailed message.",
    }


def format_exception_for_user(exc: Exception, stage: Any = None) -> str:
    raw_message = str(exc).strip()
    operation = _stage_label(stage)
    provider_error = _extract_provider_error(raw_message)

    if provider_error:
        code = provider_error["code"]
        status = str(provider_error["status"])
        provider_message = str(provider_error["message"]).rstrip(". ")

        if code in {500, 502, 503, 504} or status in {"INTERNAL", "UNAVAILABLE", "DEADLINE_EXCEEDED"}:
            reason = "the external AI provider returned a temporary server error"
            next_step = "Please retry the lecture. If it fails again, wait a few minutes or try a shorter lecture."
        elif code == 429 or status == "RESOURCE_EXHAUSTED":
            reason = "the AI provider rate limit or quota was reached"
            next_step = "Wait for the quota to reset, reduce repeated retries, or check the API billing/quota settings."
        elif code in {401, 403} or status in {"UNAUTHENTICATED", "PERMISSION_DENIED"}:
            reason = "the AI provider rejected the API credentials or permissions"
            next_step = "Check GEMINI_API_KEY, billing access, and whether the configured model is allowed for this key."
        elif code == 400 or status == "INVALID_ARGUMENT":
            reason = "the AI provider rejected the request"
            next_step = "The transcript or prompt may be too large or invalid for the configured model. Try a shorter lecture or check the model name."
        else:
            reason = "the AI provider returned an error"
            next_step = "Retry the lecture or check the backend logs for the full provider response."

        stage_context = ""
        if _stage_key(stage) == "generating_notes":
            stage_context = " The transcript was already prepared, but the model failed while creating the Somali notes."

        return _truncate(
            f"{operation} failed because {reason} (HTTP {code} / {status})."
            f"{stage_context} Provider message: {provider_message}. {next_step}"
        )

    if raw_message:
        return _truncate(raw_message)

    return f"{operation} failed because an unexpected error occurred."


def is_transient_ai_provider_error(exc: Exception) -> bool:
    raw_message = str(exc).strip()
    provider_error = _extract_provider_error(raw_message)
    if provider_error:
        code = provider_error["code"]
        status = str(provider_error["status"])
        return code in {500, 502, 503, 504} or status in {
            "INTERNAL",
            "UNAVAILABLE",
            "DEADLINE_EXCEEDED",
        }

    lowered_message = raw_message.lower()
    return any(
        marker in lowered_message
        for marker in (
            "timed out",
            "timeout",
            "connection reset",
            "server disconnected",
            "temporary failure",
            "remoteprotocolerror",
        )
    )
