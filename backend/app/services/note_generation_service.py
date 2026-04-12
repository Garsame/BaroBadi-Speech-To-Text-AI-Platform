from pydantic import BaseModel

from app.core.config import load_settings

try:
    from google import genai
except ImportError:
    genai = None


class SomaliNotesPayload(BaseModel):
    structured_content: str
    summary: str
    key_points: list[str]


class NoteGenerationService:
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
        self.client = genai.Client(api_key=api_key)
        self.model = settings.GEMMA_MODEL

    def generate_somali_notes(self, english_transcript: str) -> dict[str, str | list | dict]:
        """
        Converts English transcript to structured Somali study notes.
        Requires JSON format response with schema: { "structured_content": "...", "summary": "...", "key_points": ["..."] }
        """
        prompt = f"""You are an expert bilingual educational assistant.
Transform the following English lecture transcript into structured Somali study notes.
Return strict JSON with exactly these keys:
- structured_content: detailed Somali notes, markdown allowed
- summary: a brief 2-3 sentence overview in Somali
- key_points: a list of important takeaways in Somali

Transcript:
{english_transcript}
"""

        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_schema": SomaliNotesPayload,
            },
        )

        parsed = getattr(response, "parsed", None)
        if parsed is not None:
            if isinstance(parsed, SomaliNotesPayload):
                return parsed.model_dump()
            return SomaliNotesPayload.model_validate(parsed).model_dump()

        response_text = getattr(response, "text", None)
        if not response_text:
            raise RuntimeError("Gemma returned an empty response for Somali note generation.")

        return SomaliNotesPayload.model_validate_json(response_text).model_dump()
