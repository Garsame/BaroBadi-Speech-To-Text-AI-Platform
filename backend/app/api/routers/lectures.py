from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, Query, Request
from fastapi.responses import FileResponse, StreamingResponse
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from typing import List, Any
import shutil
import os
import mimetypes

from app.core.config import BACKEND_ROOT, settings
from app.core.database import get_db
from app.models.log import SystemLog
from app.models.user import User
from app.models.lecture import Lecture as ModelLecture
from app.schemas.chat import (
    LectureChatAskRequest,
    LectureChatAskResponse,
    LectureChatMessageDetail,
)
from app.schemas.lecture import LectureCreate, Lecture, LectureDetail, LectureLog
from app.services.lecture_chat_service import LectureChatService
from app.services.lecture_service import LectureService
from app.services.youtube_service import YouTubeService
from app.api.dependencies import get_current_active_user

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _get_user_from_media_token(db: Session, token: str | None) -> User:
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        user_id_value = payload.get("sub")
        if user_id_value is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user_id = int(user_id_value)
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="Could not validate credentials")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    return user


def _is_within_directory(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
    except ValueError:
        return False

    return True


def _resolve_media_file_path(file_path: str) -> Path | None:
    if file_path.startswith(("http://", "https://")):
        return None

    normalized_path = file_path.replace("\\", os.sep)
    raw_path = Path(normalized_path)
    candidate_paths = (
        [raw_path]
        if raw_path.is_absolute()
        else [
            Path.cwd() / raw_path,
            BACKEND_ROOT / raw_path,
        ]
    )
    allowed_roots = [
        (Path.cwd() / "uploads").resolve(),
        (Path.cwd() / "temp_youtube").resolve(),
        (Path.cwd() / "temp_media").resolve(),
        (BACKEND_ROOT / "uploads").resolve(),
        (BACKEND_ROOT / "temp_youtube").resolve(),
        (BACKEND_ROOT / "temp_media").resolve(),
    ]

    for candidate_path in candidate_paths:
        resolved_path = candidate_path.resolve()
        if not resolved_path.is_file():
            continue
        if any(_is_within_directory(resolved_path, root) for root in allowed_roots):
            return resolved_path

    return None

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

    if lecture_in.source_type == "youtube":
        youtube_service = YouTubeService()
        lecture_title = (lecture_in.title or "").strip()

        if not youtube_service.is_valid_url(lecture_in.source_url or ""):
            raise HTTPException(status_code=400, detail="Invalid YouTube URL.")

        if not lecture_title:
            try:
                lecture_title = youtube_service.get_video_title(
                    lecture_in.source_url or "",
                )
            except Exception as exc:
                try:
                    transcript_bundle = youtube_service.download_transcript_bundle(
                        lecture_in.source_url or "",
                    )
                except Exception:
                    transcript_bundle = None

                lecture_title = str(
                    (transcript_bundle or {}).get("title") or ""
                ).strip()
                if not lecture_title:
                    raise HTTPException(
                        status_code=400,
                        detail="We could not read the YouTube video title. Please check the link and try again.",
                    ) from exc

        lecture_in = lecture_in.model_copy(update={"title": lecture_title})

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

    cleaned_title = title.strip()
    if not cleaned_title:
        raise HTTPException(status_code=400, detail="Lecture title is required for uploaded videos.")

    file_path = os.path.join(UPLOAD_DIR, f"{current_user.id}_{file.filename}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    lecture_in = LectureCreate(
        title=cleaned_title,
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


@router.get("/{lecture_id}/media")
def read_lecture_media(
    lecture_id: int,
    request: Request,
    token: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> Any:
    lecture_service = LectureService(db)
    # TEMPORARY AUTH BYPASS
    # current_user = _get_user_from_media_token(db, token)
    # lecture = lecture_service.get_lecture(
    #    lecture_id=lecture_id,
    #    owner_id=current_user.id,
    # )
    lecture = db.query(ModelLecture).filter(ModelLecture.id == lecture_id).first()


    if not lecture or not lecture.media_asset:
        raise HTTPException(status_code=404, detail="Lecture media not found")

    media_path = _resolve_media_file_path(lecture.media_asset.file_path)
    if not media_path:
        raise HTTPException(
            status_code=404,
            detail="Original lecture audio is not available for playback.",
        )

    file_size = media_path.stat().st_size
    content_type, _ = mimetypes.guess_type(str(media_path))
    content_type = content_type or "application/octet-stream"
    if media_path.suffix.lower() == ".webm":
        content_type = "audio/webm"
    elif media_path.suffix.lower() == ".m4a":
        content_type = "audio/mp4"

    range_header = request.headers.get("range")

    if range_header:
        try:
            range_str = range_header.strip().replace("bytes=", "")
            start_str, end_str = range_str.split("-", 1)
            start = int(start_str) if start_str else 0
            end = int(end_str) if end_str else file_size - 1
            if start >= file_size or end >= file_size or start > end:
                raise ValueError()
        except ValueError:
            raise HTTPException(status_code=416, detail="Requested Range Not Satisfiable")

        chunk_size = end - start + 1
        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(chunk_size),
            "Content-Type": content_type,
        }

        def file_iterator():
            with open(media_path, "rb") as f:
                f.seek(start)
                bytes_left = chunk_size
                while bytes_left > 0:
                    chunk = f.read(min(bytes_left, 1024 * 64))
                    if not chunk:
                        break
                    bytes_left -= len(chunk)
                    yield chunk

        return StreamingResponse(
            file_iterator(),
            headers=headers,
            status_code=206,
            media_type=content_type
        )
    else:
        headers = {
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
            "Content-Type": content_type,
        }
        return FileResponse(path=media_path, headers=headers, media_type=content_type)


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

@router.post("/{lecture_id}/cancel", response_model=Lecture)
def cancel_lecture(
    *,
    lecture_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    lecture_service = LectureService(db)
    try:
        lecture = lecture_service.cancel_lecture(
            lecture_id=lecture_id,
            owner_id=current_user.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

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

@router.get("/{lecture_id}/chat/messages", response_model=List[LectureChatMessageDetail])
def read_lecture_chat_messages(
    lecture_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    lecture_service = LectureService(db)
    lecture = lecture_service.get_lecture(lecture_id=lecture_id, owner_id=current_user.id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    chat_service = LectureChatService(db)
    return chat_service.get_messages(lecture_id=lecture_id, owner_id=current_user.id)

@router.post("/{lecture_id}/chat/ask", response_model=LectureChatAskResponse)
def ask_lecture_chatbot(
    *,
    lecture_id: int,
    payload: LectureChatAskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    chat_service = LectureChatService(db)
    try:
        user_message, assistant_message = chat_service.ask_question(
            lecture_id=lecture_id,
            current_user=current_user,
            message=payload.message,
        )
    except ValueError as exc:
        detail = str(exc)
        status_code = 404 if detail == "Lecture not found." else 400
        raise HTTPException(status_code=status_code, detail=detail) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {
        "user_message": user_message,
        "assistant_message": assistant_message,
    }
