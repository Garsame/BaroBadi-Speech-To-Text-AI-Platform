from datetime import datetime
import enum

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class ChatMessageRole(str, enum.Enum):
    user = "user"
    assistant = "assistant"


class LectureChatMessage(Base):
    __tablename__ = "lecture_chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    role = Column(Enum(ChatMessageRole), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    lecture_id = Column(Integer, ForeignKey("lectures.id"), nullable=False, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    lecture = relationship("Lecture", back_populates="chat_messages")
    owner = relationship("User", back_populates="chat_messages")
