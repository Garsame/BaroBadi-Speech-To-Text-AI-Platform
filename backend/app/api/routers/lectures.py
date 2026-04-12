from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Any
import shutil
import os

from app.core.database import get_db
from app.models.log import SystemLog
from app.models.user import User
from app.schemas.lecture import LectureCreate, Lecture, LectureDetail, LectureLog
from app.services.lecture_service import LectureService
from app.api.dependencies import get_current_active_user

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/", response_model=Lecture)
def create_new_lecture(
    *,
    db: Session = Depends(get_db),
    lecture_in: LectureCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Create new lecture from youtube link."""
    if lecture_in.source_type == "youtube" and not lecture_in.source_url:
        raise HTTPException(status_code=400, detail="YouTube URL is required.")
    
    lecture_service = LectureService(db, background_tasks=background_tasks)
    lecture = lecture_service.create_lecture(lecture_in, owner_id=current_user.id)
    return lecture

@router.post("/upload", response_model=Lecture)
async def upload_lecture_video(
    *,
    db: Session = Depends(get_db),
    title: str = Form(...),
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Upload a new lecture video file."""
    MAX_SIZE = 500 * 1024 * 1024 # 500MB
    ALLOWED_EXTENSIONS = {"mp4", "avi", "mov", "mkv", "mp3", "wav"}
    ALLOWED_MIME_TYPES = {
        "video/mp4", "video/x-msvideo", "video/quicktime", "video/x-matroska", "video/webm",
        "audio/mpeg", "audio/wav", "audio/x-wav"
    }

    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Invalid media type. Please upload a valid video or audio file.")

    ext = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file extension.")
        
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    
    if file_size > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 500MB.")
    
    file_path = os.path.join(UPLOAD_DIR, f"{current_user.id}_{file.filename}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    lecture_in = LectureCreate(
        title=title,
        source_type="upload",
        source_url=file_path
    )
    lecture_service = LectureService(db, background_tasks=background_tasks)
    lecture = lecture_service.create_lecture(lecture_in, owner_id=current_user.id)
    return lecture

@router.get("/", response_model=List[Lecture])
def read_lectures(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Retrieve lectures for current user."""
    lecture_service = LectureService(db)
    return lecture_service.get_lectures_by_user(owner_id=current_user.id)

@router.get("/{lecture_id}", response_model=LectureDetail)
def read_lecture(
    lecture_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get specific lecture by ID."""
    lecture_service = LectureService(db)
    lecture = lecture_service.get_lecture_with_details(
        lecture_id=lecture_id,
        owner_id=current_user.id,
    )
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    return lecture

@router.post("/{lecture_id}/retry", response_model=Lecture)
def retry_lecture(
    *,
    lecture_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    lecture_service = LectureService(db, background_tasks=background_tasks)
    lecture = lecture_service.retry_lecture(
        lecture_id=lecture_id,
        owner_id=current_user.id,
    )
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    return lecture

@router.get("/{lecture_id}/logs", response_model=List[LectureLog])
def read_lecture_logs(
    lecture_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    lecture_service = LectureService(db)
    lecture = lecture_service.get_lecture(lecture_id=lecture_id, owner_id=current_user.id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    logs = db.query(SystemLog).order_by(SystemLog.created_at.desc()).all()
    lecture_logs = [
        log
        for log in logs
        if isinstance(log.metadata_json, dict)
        and log.metadata_json.get("lecture_id") == lecture_id
    ]
    return lecture_logs[:50]
