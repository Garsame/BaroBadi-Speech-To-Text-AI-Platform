from sqlalchemy import Column, Integer, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base

class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(Integer, primary_key=True, index=True)
    lecture_id = Column(Integer, ForeignKey("lectures.id", ondelete="CASCADE"), unique=True, nullable=False)
    questions_json = Column(JSON, nullable=False)  # List of questions (questions, options, correct answers)
    created_at = Column(DateTime, default=datetime.utcnow)

    lecture = relationship("Lecture", back_populates="quiz")
    attempts = relationship("QuizAttempt", back_populates="quiz", cascade="all, delete-orphan")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(Integer, primary_key=True, index=True)
    lecture_id = Column(Integer, ForeignKey("lectures.id", ondelete="CASCADE"), nullable=False)
    quiz_id = Column(Integer, ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    score = Column(Integer, nullable=False)  # Numeric score obtained (e.g. 4)
    total_questions = Column(Integer, nullable=False)  # Total questions graded (e.g. 5)
    answers_json = Column(JSON, nullable=False)  # Student's submitted answers
    feedback_json = Column(JSON, nullable=False)  # AI-graded corrections and Somali tutoring explanations
    created_at = Column(DateTime, default=datetime.utcnow)

    lecture = relationship("Lecture", back_populates="quiz_attempts")
    quiz = relationship("Quiz", back_populates="attempts")
    user = relationship("User")
