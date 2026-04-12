from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
import enum
from datetime import datetime
from app.core.database import Base

class LectureStatus(str, enum.Enum):
    submitted = "submitted"
    processing = "processing"
    completed = "completed"
    failed = "failed"

class Lecture(Base):
    __tablename__ = "lectures"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    source_type = Column(String(50)) # 'upload', 'youtube'
    source_url = Column(String(500)) # for yt link or file path
    status = Column(Enum(LectureStatus), default=LectureStatus.submitted)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="lectures")
    
    job = relationship("ProcessingJob", back_populates="lecture", uselist=False)
    transcript = relationship("Transcript", back_populates="lecture", uselist=False)
    notes = relationship("Note", back_populates="lecture", uselist=False)
    media_asset = relationship("MediaAsset", back_populates="lecture", uselist=False)
