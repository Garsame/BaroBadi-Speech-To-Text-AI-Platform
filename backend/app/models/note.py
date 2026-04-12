from sqlalchemy import Column, Integer, Text, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base

class Note(Base):
    __tablename__ = "notes"
    
    id = Column(Integer, primary_key=True, index=True)
    structured_content = Column(Text, nullable=False) # Markdown or JSON storing the somali notes
    summary = Column(Text, nullable=True)             # Short summary
    key_points = Column(JSON, nullable=True)          # List of key points
    created_at = Column(DateTime, default=datetime.utcnow)
    
    lecture_id = Column(Integer, ForeignKey("lectures.id"))
    lecture = relationship("Lecture", back_populates="notes")
