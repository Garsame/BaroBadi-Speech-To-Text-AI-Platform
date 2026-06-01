import json
import logging
from datetime import datetime
from typing import List, Dict, Optional, Any
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.core.config import load_settings
from app.services.ai_error_utils import format_exception_for_user
from app.services.genai_client_factory import create_genai_client
from app.models.lecture import Lecture, LectureStatus
from app.models.quiz import Quiz, QuizAttempt
from app.schemas.quiz import QuizAttemptSubmit, QuizDashboardLectureItem, QuizDashboardSummary

try:
    from google import genai
except ImportError:
    genai = None

logger = logging.getLogger("somali_notes.quiz_service")

# Pydantic schemas defined for Gemini Structured Output
class QuizQuestionPayload(BaseModel):
    id: str  # e.g. "q1"
    question_text: str  # Question in Somali
    type: str  # "multiple_choice" or "true_false"
    options: List[str]  # 4 choices for multiple_choice, or ["Run", "Been"] for true_false
    correct_answer: str  # Must EXACTLY match one of the strings in options
    explanation: str  # Detailed Somali explanation of why it's correct

class QuizPayload(BaseModel):
    questions: List[QuizQuestionPayload]


class QuizService:
    TRANSCRIPT_CHAR_LIMIT = 50000
    NOTES_CHAR_LIMIT = 30000

    def __init__(self, db: Session):
        self.db = db
        settings = load_settings()
        self.api_key = (settings.GEMINI_API_KEY or "").strip()
        self.client = None
        self.model = settings.GEMINI_CHAT_MODEL  # Use gemini-2.5-flash

    def _ensure_client(self) -> Any:
        if self.client is not None:
            return self.client

        if not self.api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not configured in backend/.env, so quizzes cannot be generated."
            )
        if genai is None:
            raise RuntimeError(
                "google-genai is not installed, so quizzes cannot be generated."
            )

        self.client = create_genai_client(self.api_key)
        return self.client

    def _clip_text(self, value: str | None, limit: int) -> str:
        cleaned_value = (value or "").strip()
        if len(cleaned_value) <= limit:
            return cleaned_value
        return f"{cleaned_value[:limit]}\n\n[truncated]"

    def _generate_content_with_retry(
        self, prompt: str, response_schema: Any = None, is_feedback: bool = False
    ) -> Any:
        import time
        from app.services.ai_error_utils import is_transient_ai_provider_error

        settings = load_settings()
        attempts = max(1, settings.AI_PROVIDER_RETRY_ATTEMPTS)
        base_seconds = max(0.5, settings.AI_PROVIDER_RETRY_BASE_SECONDS)
        max_seconds = max(base_seconds, settings.AI_PROVIDER_RETRY_MAX_SECONDS)

        last_error = None
        for attempt in range(1, attempts + 1):
            try:
                client = self._ensure_client()
                
                config = {}
                if response_schema:
                    config["response_mime_type"] = "application/json"
                    config["response_schema"] = response_schema
                    config["temperature"] = 0.2
                else:
                    config["temperature"] = 0.3

                return client.models.generate_content(
                    model=self.model,
                    contents=prompt,
                    config=config,
                )
            except Exception as exc:
                last_error = exc
                
                # Treat rate limits (429) and temporary unavailable states (503) as transient
                exc_str = str(exc)
                is_transient = (
                    is_transient_ai_provider_error(exc)
                    or "429" in exc_str
                    or "RESOURCE_EXHAUSTED" in exc_str
                    or "503" in exc_str
                    or "UNAVAILABLE" in exc_str
                )
                
                if not is_transient:
                    stage = "generating_quiz" if not is_feedback else "generating_quiz"
                    raise RuntimeError(format_exception_for_user(exc, stage)) from exc

                stage = "generating_quiz" if not is_feedback else "generating_quiz"
                logger.warning(
                    "AI quiz service transient error with model %s on attempt %s/%s: %s",
                    self.model,
                    attempt,
                    attempts,
                    format_exception_for_user(exc, stage),
                )
                
                if attempt < attempts:
                    sleep_seconds = min(
                        base_seconds * (2 ** (attempt - 1)),
                        max_seconds,
                    )
                    time.sleep(sleep_seconds)

        stage = "generating_quiz" if not is_feedback else "generating_quiz"
        if last_error is not None:
            raise RuntimeError(format_exception_for_user(last_error, stage)) from last_error

        raise RuntimeError(f"No response from AI model during {stage.replace('_', ' ')}.")

    def generate_quiz(self, lecture_id: int, user_id: int) -> Quiz:
        """
        Generates a quiz for a completed lecture using Gemini 2.5 Flash.
        If a quiz already exists for this lecture, it is returned directly.
        """
        # Check if quiz already exists
        existing_quiz = (
            self.db.query(Quiz)
            .filter(Quiz.lecture_id == lecture_id)
            .first()
        )
        if existing_quiz:
            return existing_quiz

        # Fetch completed lecture details
        lecture = (
            self.db.query(Lecture)
            .options(joinedload(Lecture.transcript), joinedload(Lecture.notes))
            .filter(Lecture.id == lecture_id, Lecture.owner_id == user_id)
            .first()
        )

        if not lecture:
            raise ValueError("Lecture not found.")

        if lecture.status != LectureStatus.completed:
            raise ValueError("Quizzes can only be generated for completed lectures.")

        transcript_text = self._clip_text(
            lecture.transcript.cleaned_text if lecture.transcript else "",
            self.TRANSCRIPT_CHAR_LIMIT,
        )
        notes_summary = (lecture.notes.summary if lecture.notes else "") or ""
        detailed_notes = self._clip_text(
            lecture.notes.structured_content if lecture.notes else "",
            self.NOTES_CHAR_LIMIT,
        )

        # Build prompt
        prompt = f"""Waxaad tahay macallin ku takhasusay diyaarinta kediska. Shaqadaadu waa inaad u samayso ardayda kedis ka kooban su'aalo ku saabsan casharka loo soo bandhigay.
Casharku waa: "{lecture.title}"

Dulmarka Casharka:
{notes_summary}

Qoraalka Casharka (Transcript Excerpt):
{transcript_text or "No transcript text available."}

Qoraalka Notes-ka (Detailed Notes Excerpt):
{detailed_notes or "No notes available."}

Fadlan casharkan ka soo saar kedis ka kooban inta u dhaxaysa 5 ilaa 10 su'aalood oo isugu jira:
1. Multiple Choice (Doorasho): oo leh 4 dookh (options), oo uu ku jiro hal dookh oo keliya oo sax ah.
2. True/False (Run ama Been): oo leh labo dookh oo kala ah ["Run", "Been"].

Xeerarka muhiimka ah:
- Su'aalaha oo dhan, dookhyada iyo sharraxaaddoodu waa inay ku qornaadaan af Soomaali sax ah oo ardaydu si fudud u fahmi karaan.
- "correct_answer" waa inuu si sax ah ula mid noqdo mid ka mid ah dookhyada ku jira "options" xagga higaadda iyo xarfaha.
- Su'aal kasta sii sharraxaad kooban oo af Soomaali ah (explanation) oo muujinaysa sababta ay jawaabtaas u saxan tahay.
- Qor su'aalo tayo leh oo ku saabsan mawduucyada ugu muhiimsan ee casharkan.
"""

        try:
            response = self._generate_content_with_retry(
                prompt, response_schema=QuizPayload, is_feedback=False
            )
        except Exception as exc:
            raise RuntimeError(format_exception_for_user(exc, "generating_quiz")) from exc

        # Extract structured content
        parsed = getattr(response, "parsed", None)
        questions_list = []
        if parsed is not None:
            if isinstance(parsed, QuizPayload):
                questions_list = [q.model_dump() for q in parsed.questions]
            else:
                questions_list = [q.model_dump() for q in QuizPayload.model_validate(parsed).questions]
        else:
            response_text = getattr(response, "text", None)
            if not response_text:
                raise RuntimeError("Gemini returned an empty response for quiz generation.")
            questions_list = [q.model_dump() for q in QuizPayload.model_validate_json(response_text).questions]

        if not questions_list:
            raise RuntimeError("No questions were generated by the AI.")

        # Save to DB
        new_quiz = Quiz(
            lecture_id=lecture_id,
            questions_json=questions_list
        )
        self.db.add(new_quiz)
        self.db.commit()
        self.db.refresh(new_quiz)

        return new_quiz

    def submit_quiz_answers(self, lecture_id: int, attempt_in: QuizAttemptSubmit, user_id: int) -> QuizAttempt:
        """
        Grades submitted quiz answers programmatically and generates personalized
        Somali feedback/review using Gemini 2.5 Flash.
        """
        lecture = (
            self.db.query(Lecture)
            .filter(Lecture.id == lecture_id, Lecture.owner_id == user_id)
            .first()
        )
        if not lecture:
            raise ValueError("Lecture not found.")

        quiz = (
            self.db.query(Quiz)
            .filter(Quiz.lecture_id == lecture_id)
            .first()
        )
        if not quiz:
            raise ValueError("Quiz has not been generated for this lecture yet.")

        questions = quiz.questions_json
        student_answers = attempt_in.answers

        score = 0
        total_questions = len(questions)
        corrections = []

        # Programmatic grading
        for q in questions:
            q_id = q.get("id")
            correct_ans = q.get("correct_answer", "").strip()
            student_ans = student_answers.get(q_id, "").strip()

            # Normalize for comparison
            is_correct = student_ans.lower() == correct_ans.lower()
            if is_correct:
                score += 1

            corrections.append({
                "question_id": q_id,
                "student_answer": student_ans,
                "correct_answer": correct_ans,
                "is_correct": is_correct,
                "explanation": q.get("explanation", "")
            })

        # Call Gemini to write custom encouraging summary and study advice in Somali
        serialized_corrections = []
        for idx, corr in enumerate(corrections, start=1):
            q_text = next((q.get("question_text") for q in questions if q.get("id") == corr["question_id"]), "")
            status = "SAX" if corr["is_correct"] else "KHALAD"
            serialized_corrections.append(
                f"{idx}. Su'aal: {q_text}\n   Jawaabta Ardayga: {corr['student_answer']}\n   Jawaabta Saxda ah: {corr['correct_answer']}\n   Natiijo: {status}"
            )
        corrections_summary_str = "\n\n".join(serialized_corrections)

        feedback_prompt = f"""Waxaad tahay macallin ku takhasusay saxista kedisyada ardayda ee af Soomaaliga.
Ardaygu wuxuu ka jawaabay kedis ku saabsan casharka: "{lecture.title}".
Natiijada ardayga waa: {score} oo sax ah, wadartuna waa {total_questions} su'aalood.

Waa kan falanqaynta jawaabaha ardayga:
{corrections_summary_str}

Fadlan u qor ardayga qiimayn iyo falanqayn kooban oo af Soomaali ah (3 ilaa 5 weedhood).
Ula hadal ardayga si dhiirrigelin leh, ugu hambalyee qaybaha uu ku fiicnaaday, u tilmaan fikradaha uu ku khaldamay, una soo jeedi mawduucyada uu u baahan yahay inuu notes-ka ka akhriyo si uu u hagaajiyo fahamkiisa.
Qoraalku ha ahaado mid toos ah oo saaxiibtinimo leh, ha ku soo celin qaab JSON ah, ee ku soo qor qoraal caadi ah.
"""

        try:
            feedback_response = self._generate_content_with_retry(
                feedback_prompt, response_schema=None, is_feedback=True
            )
            # Retrieve text response
            general_feedback = getattr(feedback_response, "text", "") or ""
            if not general_feedback.strip():
                # Extract candidate text fallback
                candidates = getattr(feedback_response, "candidates", None) or []
                parts_text = []
                for c in candidates:
                    content = getattr(c, "content", None)
                    if content:
                        for p in getattr(content, "parts", None) or []:
                            part_text = getattr(p, "text", None)
                            if part_text:
                                parts_text.append(part_text)
                general_feedback = "\n".join(parts_text).strip()
        except Exception as exc:
            logger.warning(f"Failed to generate AI feedback: {exc}")
            general_feedback = "Waa la saxay kediskaaga! Dib u fiiri jawaabaha hoose si aad u ogaato meelaha aad ku fiicnayd iyo meelaha u baahan hagaajinta."

        if not general_feedback.strip():
            general_feedback = "Waa la saxay kediskaaga! Dib u fiiri jawaabaha hoose si aad u ogaato meelaha aad ku fiicnayd iyo meelaha u baahan hagaajinta."

        # Save to DB
        attempt = QuizAttempt(
            lecture_id=lecture_id,
            quiz_id=quiz.id,
            user_id=user_id,
            score=score,
            total_questions=total_questions,
            answers_json=student_answers,
            feedback_json={
                "corrections": corrections,
                "general_feedback": general_feedback
            }
        )
        self.db.add(attempt)
        self.db.commit()
        self.db.refresh(attempt)

        return attempt

    def get_dashboard_summary(self, user_id: int) -> QuizDashboardSummary:
        """
        Retrieves all completed lectures for the user and categorizes them into:
        - `pending_quizzes`: Completed lectures where the student hasn't taken a quiz yet
        - `taken_quizzes`: Completed lectures where the student has taken a quiz, including their highest score
        """
        # Query completed lectures
        lectures = (
            self.db.query(Lecture)
            .filter(Lecture.owner_id == user_id, Lecture.status == LectureStatus.completed)
            .order_by(Lecture.updated_at.desc())
            .all()
        )

        pending_list = []
        taken_list = []

        for lecture in lectures:
            # Check if quiz exists
            quiz = self.db.query(Quiz).filter(Quiz.lecture_id == lecture.id).first()
            quiz_generated = quiz is not None

            # Get attempts
            attempts = (
                self.db.query(QuizAttempt)
                .filter(QuizAttempt.lecture_id == lecture.id, QuizAttempt.user_id == user_id)
                .order_by(QuizAttempt.created_at.desc())
                .all()
            )

            if attempts:
                # Highest score
                highest_score_attempt = max(attempts, key=lambda a: a.score)
                last_attempt = attempts[0]

                item = QuizDashboardLectureItem(
                    id=lecture.id,
                    title=lecture.title,
                    status=lecture.status.value if hasattr(lecture.status, "value") else str(lecture.status),
                    quiz_generated=quiz_generated,
                    highest_score=highest_score_attempt.score,
                    total_questions=highest_score_attempt.total_questions,
                    last_attempt_at=last_attempt.created_at,
                    created_at=lecture.created_at
                )
                taken_list.append(item)
            else:
                item = QuizDashboardLectureItem(
                    id=lecture.id,
                    title=lecture.title,
                    status=lecture.status.value if hasattr(lecture.status, "value") else str(lecture.status),
                    quiz_generated=quiz_generated,
                    highest_score=None,
                    total_questions=None,
                    last_attempt_at=None,
                    created_at=lecture.created_at
                )
                pending_list.append(item)

        return QuizDashboardSummary(
            pending_quizzes=pending_list,
            taken_quizzes=taken_list
        )
