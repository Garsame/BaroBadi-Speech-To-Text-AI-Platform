from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum, JSON
from sqlalchemy.orm import relationship
import enum
from datetime import datetime
from app.core.database import Base

class JobStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    success = "success"
    error = "error"
    canceled = "canceled"

class JobStage(str, enum.Enum):
    validating_input = "validating_input"
    preparing_media = "preparing_media"
    extracting_audio = "extracting_audio"
    preparing_audio = "preparing_audio"
    transcribing = "transcribing"
    cleaning_transcript = "cleaning_transcript"
    generating_notes = "generating_notes"
    saving_results = "saving_results"
    completed = "completed"
    failed = "failed"
    canceled = "canceled"

class ProcessingJob(Base):
    __tablename__ = "processing_jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(255), unique=True, index=True) # celery/worker task id
    status = Column(Enum(JobStatus), default=JobStatus.pending)
    stage = Column(Enum(JobStage), default=JobStage.validating_input)
    progress_percent = Column(Integer, default=0)
    error_message = Column(String(1000), nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    lecture_id = Column(Integer, ForeignKey("lectures.id"))
    lecture = relationship("Lecture", back_populates="job")
