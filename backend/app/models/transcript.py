from sqlalchemy import Column, Integer, Text, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base

class Transcript(Base):
    __tablename__ = "transcripts"
    
    id = Column(Integer, primary_key=True, index=True)
    raw_text = Column(Text, nullable=False)
    cleaned_text = Column(Text, nullable=True)
    metadata_json = Column(JSON, nullable=True) # e.g. timestamps, language
    created_at = Column(DateTime, default=datetime.utcnow)
    
    lecture_id = Column(Integer, ForeignKey("lectures.id"))
    lecture = relationship("Lecture", back_populates="transcript")
