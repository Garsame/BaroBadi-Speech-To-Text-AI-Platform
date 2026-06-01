from datetime import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, ConfigDict

class QuizQuestionSchema(BaseModel):
    id: str  # e.g., "q1", "q2"
    question_text: str  # Question in Somali
    type: str  # "multiple_choice" or "true_false"
    options: List[str]  # 4 options for MCQ, or ["Run", "Been"] for True/False
    correct_answer: str  # The exact text of the correct option
    explanation: str  # Explanation in Somali of why it's correct

class QuizResponse(BaseModel):
    id: int
    lecture_id: int
    questions: List[QuizQuestionSchema]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class QuizAttemptSubmit(BaseModel):
    answers: Dict[str, str]  # question_id -> student's selected option text

class QuestionCorrection(BaseModel):
    question_id: str
    student_answer: str
    correct_answer: str
    is_correct: bool
    explanation: str  # Question explanation in Somali

class QuizAttemptResponse(BaseModel):
    id: int
    quiz_id: int
    score: int
    total_questions: int
    corrections: List[QuestionCorrection]
    general_feedback: str  # General feedback/tips from Gemini in Somali
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class QuizAttemptBrief(BaseModel):
    id: int
    score: int
    total_questions: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class QuizDashboardLectureItem(BaseModel):
    id: int
    title: str
    status: str
    quiz_generated: bool
    highest_score: Optional[int] = None
    total_questions: Optional[int] = None
    last_attempt_at: Optional[datetime] = None
    created_at: datetime

class QuizDashboardSummary(BaseModel):
    pending_quizzes: List[QuizDashboardLectureItem]
    taken_quizzes: List[QuizDashboardLectureItem]
