from typing import Any

from sqlalchemy.orm import Session, joinedload

from app.core.config import load_settings
from app.services.genai_client_factory import create_genai_client
from app.services.ai_error_utils import format_exception_for_user
from app.models.chat_message import ChatMessageRole, LectureChatMessage
from app.models.lecture import Lecture, LectureStatus
from app.models.user import User

try:
    from google import genai
except ImportError:
    genai = None


class LectureChatService:
    RECENT_MESSAGE_LIMIT = 20
    TRANSCRIPT_CHAR_LIMIT = 60000
    NOTES_CHAR_LIMIT = 40000

    def __init__(self, db: Session):
        self.db = db

        settings = load_settings()
        self.api_key = (settings.GEMINI_API_KEY or "").strip()
        self.client = None
        self.model = settings.GEMINI_CHAT_MODEL

    def _ensure_client(self) -> Any:
        if self.client is not None:
            return self.client

        if not self.api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not configured in backend/.env, so lecture chat cannot run."
            )
        if genai is None:
            raise RuntimeError(
                "google-genai is not installed, so lecture chat cannot run."
            )

        self.client = create_genai_client(self.api_key)
        return self.client

    def _clip_text(self, value: str | None, limit: int) -> str:
        cleaned_value = (value or "").strip()
        if len(cleaned_value) <= limit:
            return cleaned_value
        return f"{cleaned_value[:limit]}\n\n[truncated]"

    def _get_lecture_for_chat(self, lecture_id: int, owner_id: int) -> Lecture | None:
        return (
            self.db.query(Lecture)
            .options(
                joinedload(Lecture.transcript),
                joinedload(Lecture.notes),
                joinedload(Lecture.chat_messages),
            )
            .filter(Lecture.id == lecture_id, Lecture.owner_id == owner_id)
            .first()
        )

    def get_messages(self, lecture_id: int, owner_id: int) -> list[LectureChatMessage]:
        lecture_exists = (
            self.db.query(Lecture.id)
            .filter(Lecture.id == lecture_id, Lecture.owner_id == owner_id)
            .first()
        )
        if not lecture_exists:
            return []

        return (
            self.db.query(LectureChatMessage)
            .filter(
                LectureChatMessage.lecture_id == lecture_id,
                LectureChatMessage.owner_id == owner_id,
            )
            .order_by(LectureChatMessage.created_at.asc(), LectureChatMessage.id.asc())
            .all()
        )

    def _build_prompt(
        self,
        lecture: Lecture,
        question: str,
        recent_messages: list[LectureChatMessage],
    ) -> str:
        transcript_text = self._clip_text(
            lecture.transcript.cleaned_text if lecture.transcript else "",
            self.TRANSCRIPT_CHAR_LIMIT,
        )
        notes_summary = (lecture.notes.summary if lecture.notes else "") or ""
        key_points = lecture.notes.key_points if lecture.notes and lecture.notes.key_points else []
        detailed_notes = self._clip_text(
            lecture.notes.structured_content if lecture.notes else "",
            self.NOTES_CHAR_LIMIT,
        )
        prior_conversation = "\n".join(
            f"{'Student' if message.role == ChatMessageRole.user else 'Tutor'}: {message.content}"
            for message in recent_messages
        ).strip()

        # Extract extra analysis details if available
        analysis_data = {}
        if lecture.transcript and lecture.transcript.metadata_json:
            analysis_data = lecture.transcript.metadata_json.get("analysis") or {}

        genre_label = analysis_data.get("genre_label", "")
        genre_explanation = analysis_data.get("genre_explanation", "")
        valuation_summary = analysis_data.get("valuation_summary", "")

        extra_details = ""
        if genre_label:
            extra_details += f"Lecture Category/Genre: {genre_label}\n"
        if genre_explanation:
            extra_details += f"Category Focus: {genre_explanation}\n"
        if valuation_summary:
            extra_details += f"Content Completeness Assessment: {valuation_summary}\n"

        return f"""You are a professional study tutor embedded inside a lecture-learning app.
Help the student answer questions about this specific lecture only.

Rules:
- Ground your answer in the lecture transcript, Somali notes, and recent conversation.
- If the student asks something outside the lecture topic, politely say you can help only with this lecture and suggest a related question.
- Be accurate, supportive, and concise.
- LANGUAGE MATCHING RULE:
  - If the student writes their question in English, you MUST reply entirely in English.
  - If the student writes their question in Somali, you MUST reply entirely in Somali.
  - Match the student's chosen language precisely. Ground your explanations in the provided materials (e.g., explain Somali notes in English if asked in English, or explain them in Somali if asked in Somali).
- Use short paragraphs or bullet points when they improve clarity.
- Do not invent facts that are not supported by the provided lecture material.
- If the lecture material only partially covers the question, say what is covered and what is missing.

Lecture title:
{lecture.title}

Lecture status:
{lecture.status}

{extra_details}
Transcript excerpt:
{transcript_text or "Transcript not available."}

Somali notes summary:
{notes_summary or "Somali summary not available."}

Somali key points:
{key_points or []}

Somali detailed notes excerpt:
{detailed_notes or "Detailed notes not available."}

Recent conversation:
{prior_conversation or "No previous messages yet."}

Student question:
{question}
"""

    def _extract_response_text(self, response: Any) -> str:
        response_text = (getattr(response, "text", "") or "").strip()
        if response_text:
            return response_text

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

    def ask_question(
        self,
        lecture_id: int,
        current_user: User,
        message: str,
    ) -> tuple[LectureChatMessage, LectureChatMessage]:
        lecture = self._get_lecture_for_chat(lecture_id, current_user.id)
        if not lecture:
            raise ValueError("Lecture not found.")

        if lecture.status in {LectureStatus.failed, LectureStatus.canceled}:
            raise ValueError(
                "This lecture is not available for chatbot study because processing did not finish successfully."
            )

        if (
            lecture.status in {LectureStatus.submitted, LectureStatus.processing}
            and not lecture.transcript
            and not lecture.notes
        ):
            raise ValueError(
                "The lecture chatbot is available after the lecture finishes processing."
            )

        if not lecture.transcript and not lecture.notes:
            raise ValueError(
                "This lecture does not have enough generated material for the chatbot yet."
            )

        clean_message = message.strip()
        if not clean_message:
            raise ValueError("Please enter a question before sending it to the chatbot.")

        recent_messages = list(lecture.chat_messages or [])[-self.RECENT_MESSAGE_LIMIT :]
        prompt = self._build_prompt(lecture, clean_message, recent_messages)
        client = self._ensure_client()
        try:
            response = client.models.generate_content(
                model=self.model,
                contents=prompt,
                config={
                    "temperature": 0.35,
                },
            )
        except Exception as exc:
            raise RuntimeError(format_exception_for_user(exc, "lecture_chat")) from exc

        assistant_text = self._extract_response_text(response)
        if not assistant_text:
            raise RuntimeError("Gemini returned an empty response for the lecture chatbot.")

        user_message = LectureChatMessage(
            lecture_id=lecture.id,
            owner_id=current_user.id,
            role=ChatMessageRole.user,
            content=clean_message,
        )
        assistant_message = LectureChatMessage(
            lecture_id=lecture.id,
            owner_id=current_user.id,
            role=ChatMessageRole.assistant,
            content=assistant_text,
        )

        self.db.add(user_message)
        self.db.add(assistant_message)
        self.db.commit()
        self.db.refresh(user_message)
        self.db.refresh(assistant_message)

        return user_message, assistant_message
