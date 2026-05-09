from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class LectureBase(BaseModel):
    title: Optional[str] = None
    source_type: str
    source_url: Optional[str] = None


class LectureCreate(LectureBase):
    pass


class TranscriptDetail(BaseModel):
    raw_text: str
    cleaned_text: Optional[str] = None
    metadata_json: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)


class NoteDetail(BaseModel):
    structured_content: str
    summary: Optional[str] = None
    key_points: Optional[list[str]] = None

    model_config = ConfigDict(from_attributes=True)


class JobDetail(BaseModel):
    status: str
    stage: str
    progress_percent: int
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class MediaAssetDetail(BaseModel):
    file_path: str
    media_type: Optional[str] = None
    duration_seconds: Optional[int] = None
    file_size_bytes: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class LectureLog(BaseModel):
    id: int
    level: str
    message: str
    created_at: datetime
    metadata_json: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)


class LectureInDBBase(LectureBase):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime
    owner_id: int

    model_config = ConfigDict(from_attributes=True)


class Lecture(LectureInDBBase):
    job: Optional[JobDetail] = None


class LectureDetail(Lecture):
    transcript: Optional[TranscriptDetail] = None
    notes: Optional[NoteDetail] = None
    media_asset: Optional[MediaAssetDetail] = None
