from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import joinedload
from sqlalchemy.orm import Session
from typing import Any

from app.core.database import get_db
from app.models.user import User, RoleEnum
from app.models.lecture import Lecture, LectureStatus
from app.models.job import JobStatus, ProcessingJob
from app.models.note import Note
from app.models.log import ActivityLog, SystemLog
from app.api.dependencies import get_current_active_admin
from app.schemas.user import User as UserResponse, UserCreate
from app.services.auth_service import AuthService

router = APIRouter()

@router.get("/stats")
def get_admin_stats(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_active_admin),
) -> Any:
    """Get system-wide statistics for the admin dashboard."""
    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.is_active.is_(True)).count()
    admin_users = db.query(User).filter(User.role == RoleEnum.admin).count()
    learner_users = db.query(User).filter(User.role == RoleEnum.user).count()
    total_lectures = db.query(Lecture).count()
    total_notes = db.query(Note).count()

    completed_lectures = db.query(Lecture).filter(Lecture.status == LectureStatus.completed).count()
    failed_lectures = db.query(Lecture).filter(Lecture.status == LectureStatus.failed).count()
    processing_lectures = db.query(Lecture).filter(Lecture.status == LectureStatus.processing).count()
    submitted_lectures = db.query(Lecture).filter(Lecture.status == LectureStatus.submitted).count()
    canceled_lectures = db.query(Lecture).filter(Lecture.status == LectureStatus.canceled).count()
    youtube_lectures = db.query(Lecture).filter(Lecture.source_type == "youtube").count()
    uploaded_lectures = db.query(Lecture).filter(Lecture.source_type != "youtube").count()

    total_jobs = db.query(ProcessingJob).count()
    pending_jobs = db.query(ProcessingJob).filter(ProcessingJob.status == JobStatus.pending).count()
    running_jobs = db.query(ProcessingJob).filter(ProcessingJob.status == JobStatus.running).count()
    successful_jobs = db.query(ProcessingJob).filter(ProcessingJob.status == JobStatus.success).count()
    errored_jobs = db.query(ProcessingJob).filter(ProcessingJob.status == JobStatus.error).count()
    canceled_jobs = db.query(ProcessingJob).filter(ProcessingJob.status == JobStatus.canceled).count()

    success_rate = 0
    total_processed = completed_lectures + failed_lectures
    if total_processed > 0:
        success_rate = round((completed_lectures / total_processed) * 100, 1)

    note_conversion_rate = 0
    if completed_lectures > 0:
        note_conversion_rate = round((total_notes / completed_lectures) * 100, 1)

    now = datetime.utcnow()
    seven_days_ago = now - timedelta(days=7)
    new_users_7d = db.query(User).filter(User.created_at >= seven_days_ago).count()
    lectures_7d = db.query(Lecture).filter(Lecture.created_at >= seven_days_ago).count()
    completed_jobs_7d = (
        db.query(ProcessingJob)
        .filter(
            ProcessingJob.status == JobStatus.success,
            ProcessingJob.completed_at >= seven_days_ago,
        )
        .count()
    )

    completed_jobs = (
        db.query(ProcessingJob)
        .filter(
            ProcessingJob.status == JobStatus.success,
            ProcessingJob.started_at.isnot(None),
            ProcessingJob.completed_at.isnot(None),
        )
        .all()
    )
    completion_seconds = [
        max(0, int((job.completed_at - job.started_at).total_seconds()))
        for job in completed_jobs
        if job.started_at and job.completed_at
    ]
    average_job_seconds = (
        round(sum(completion_seconds) / len(completion_seconds))
        if completion_seconds
        else 0
    )

    stage_rows = (
        db.query(ProcessingJob.stage, func.count(ProcessingJob.id))
        .filter(ProcessingJob.status == JobStatus.running)
        .group_by(ProcessingJob.stage)
        .all()
    )
    active_stage_breakdown = [
        {
            "label": stage.value if hasattr(stage, "value") else str(stage),
            "value": count,
        }
        for stage, count in stage_rows
    ]

    trend_days = [now.date() - timedelta(days=day) for day in range(6, -1, -1)]
    created_lectures = db.query(Lecture).filter(Lecture.created_at >= now - timedelta(days=6)).all()
    finished_jobs = (
        db.query(ProcessingJob)
        .filter(ProcessingJob.completed_at >= now - timedelta(days=6))
        .all()
    )
    weekly_trend = []
    for day in trend_days:
        weekly_trend.append(
            {
                "date": day.isoformat(),
                "submitted": sum(
                    1 for lecture in created_lectures if lecture.created_at and lecture.created_at.date() == day
                ),
                "completed": sum(
                    1
                    for job in finished_jobs
                    if job.completed_at
                    and job.completed_at.date() == day
                    and job.status == JobStatus.success
                ),
                "failed": sum(
                    1
                    for job in finished_jobs
                    if job.completed_at
                    and job.completed_at.date() == day
                    and job.status == JobStatus.error
                ),
            }
        )

    return {
        "total_users": total_users,
        "active_users": active_users,
        "admin_users": admin_users,
        "learner_users": learner_users,
        "new_users_7d": new_users_7d,
        "total_lectures": total_lectures,
        "lectures_7d": lectures_7d,
        "total_notes": total_notes,
        "completed_processing": completed_lectures,
        "failed_processing": failed_lectures,
        "processing_lectures": processing_lectures,
        "submitted_lectures": submitted_lectures,
        "canceled_lectures": canceled_lectures,
        "youtube_lectures": youtube_lectures,
        "uploaded_lectures": uploaded_lectures,
        "automation_success_rate": success_rate,
        "note_conversion_rate": note_conversion_rate,
        "total_jobs": total_jobs,
        "pending_jobs": pending_jobs,
        "running_jobs": running_jobs,
        "successful_jobs": successful_jobs,
        "errored_jobs": errored_jobs,
        "canceled_jobs": canceled_jobs,
        "completed_jobs_7d": completed_jobs_7d,
        "average_job_seconds": average_job_seconds,
        "job_status_breakdown": [
            {"label": "Successful", "value": successful_jobs, "color": "#10b981"},
            {"label": "Running", "value": running_jobs, "color": "#38bdf8"},
            {"label": "Pending", "value": pending_jobs, "color": "#f59e0b"},
            {"label": "Errored", "value": errored_jobs, "color": "#ef4444"},
            {"label": "Canceled", "value": canceled_jobs, "color": "#64748b"},
        ],
        "lecture_source_breakdown": [
            {"label": "YouTube", "value": youtube_lectures, "color": "#ef4444"},
            {"label": "Uploads", "value": uploaded_lectures, "color": "#38bdf8"},
        ],
        "active_stage_breakdown": active_stage_breakdown,
        "weekly_trend": weekly_trend,
    }

@router.get("/recent-lectures")
def get_recent_all_lectures(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_active_admin),
    limit: int = 20
) -> Any:
    """Get recent lectures created by any user in the system."""
    lectures = (
        db.query(Lecture)
        .options(
            joinedload(Lecture.owner),
            joinedload(Lecture.media_asset),
            joinedload(Lecture.transcript),
            joinedload(Lecture.job),
        )
        .order_by(Lecture.created_at.desc())
        .limit(limit)
        .all()
    )

    result = []
    for lec in lectures:
        owner = lec.owner
        transcript_metadata = (
            lec.transcript.metadata_json
            if lec.transcript and isinstance(lec.transcript.metadata_json, dict)
            else {}
        )
        analysis = transcript_metadata.get("analysis") if isinstance(transcript_metadata, dict) else {}
        if not isinstance(analysis, dict):
            analysis = {}

        source_type = lec.source_type or "unknown"
        source_link = lec.source_url if source_type == "youtube" else f"/api/v1/lectures/{lec.id}/media"
        status_value = lec.status.value if hasattr(lec.status, "value") else str(lec.status)
        result.append({
            "id": lec.id,
            "title": lec.title,
            "status": status_value,
            "source_type": source_type,
            "source_url": lec.source_url,
            "source_link": source_link,
            "created_at": lec.created_at,
            "updated_at": lec.updated_at,
            "owner_name": owner.full_name if owner else "Unknown",
            "owner_email": owner.email if owner else "Unknown",
            "duration_seconds": lec.media_asset.duration_seconds if lec.media_asset else None,
            "file_size_bytes": lec.media_asset.file_size_bytes if lec.media_asset else None,
            "job_progress_percent": lec.job.progress_percent if lec.job else None,
            "job_completed_at": lec.job.completed_at if lec.job else None,
            "valuation_score": analysis.get("confidence_score"),
            "valuation_label": analysis.get("confidence_label"),
            "valuation_summary": analysis.get("valuation_summary"),
            "genre_label": analysis.get("genre_label"),
            "genre_explanation": analysis.get("genre_explanation"),
        })
    return result

@router.get("/system-logs")
def get_system_logs(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_active_admin),
    limit: int = 50
) -> Any:
    """Get the most recent admin-facing activity entries."""
    activity_actions = {"USER_LOGIN", "ADMIN_LOGIN"}
    activity_logs = (
        db.query(ActivityLog)
        .options(joinedload(ActivityLog.user))
        .filter(ActivityLog.action.in_(activity_actions))
        .order_by(ActivityLog.created_at.desc())
        .limit(limit)
        .all()
    )

    entries: list[dict[str, Any]] = []
    for log in activity_logs:
        user = log.user
        details = log.details if isinstance(log.details, dict) else {}
        actor_email = user.email if user else details.get("email", "Unknown")
        actor_name = user.full_name if user and user.full_name else actor_email
        actor_role = user.role if user else details.get("role", "user")
        actor_role_value = actor_role.value if hasattr(actor_role, "value") else str(actor_role)
        actor_label = "Admin" if actor_role_value == RoleEnum.admin.value else "User"
        action_label = "signed in" if log.action.endswith("LOGIN") else "signed up"

        entries.append(
            {
                "id": f"activity-{log.id}",
                "level": "INFO",
                "event_type": log.action,
                "message": f"{actor_label} {actor_name} {action_label}.",
                "actor_name": actor_name,
                "actor_email": actor_email,
                "actor_role": actor_role_value,
                "created_at": log.created_at,
            }
        )

    signed_up_users = db.query(User).order_by(User.created_at.desc()).limit(limit).all()
    for user in signed_up_users:
        role_value = user.role.value if hasattr(user.role, "value") else str(user.role)
        actor_label = "Admin" if role_value == RoleEnum.admin.value else "User"
        event_type = "ADMIN_SIGNUP" if role_value == RoleEnum.admin.value else "USER_SIGNUP"
        actor_name = user.full_name or user.email

        entries.append(
            {
                "id": f"signup-{user.id}",
                "level": "INFO",
                "event_type": event_type,
                "message": f"{actor_label} {actor_name} signed up.",
                "actor_name": actor_name,
                "actor_email": user.email,
                "actor_role": role_value,
                "created_at": user.created_at,
            }
        )

    completed_jobs = (
        db.query(ProcessingJob)
        .options(joinedload(ProcessingJob.lecture).joinedload(Lecture.owner))
        .filter(
            ProcessingJob.status == JobStatus.success,
            ProcessingJob.completed_at.isnot(None),
        )
        .order_by(ProcessingJob.completed_at.desc())
        .limit(limit)
        .all()
    )

    for job in completed_jobs:
        lecture = job.lecture
        if not lecture:
            continue

        owner = lecture.owner
        owner_email = owner.email if owner else "Unknown"
        owner_name = owner.full_name if owner and owner.full_name else owner_email
        entries.append(
            {
                "id": f"lecture-{lecture.id}",
                "level": "INFO",
                "event_type": "LECTURE_GENERATED",
                "message": f"Lecture generated: {lecture.title}",
                "actor_name": owner_name,
                "actor_email": owner_email,
                "actor_role": RoleEnum.user.value,
                "lecture_id": lecture.id,
                "lecture_title": lecture.title,
                "created_at": job.completed_at,
            }
        )

    entries.sort(key=lambda entry: entry["created_at"], reverse=True)
    return entries[:limit]

from pydantic import BaseModel, EmailStr
from typing import Optional

class AdminUserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str

@router.post("/users", response_model=UserResponse)
def create_user_by_admin(
    *,
    db: Session = Depends(get_db),
    user_in: AdminUserCreate,
    current_admin: User = Depends(get_current_active_admin),
) -> Any:
    auth_service = AuthService(db)
    existing_user = auth_service.get_user_by_email(email=user_in.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="A user with this email already exists.")

    created_user = auth_service.create_user(
        UserCreate(
            full_name=user_in.full_name,
            email=user_in.email,
            password=user_in.password,
        ),
        role=RoleEnum.user,
    )

    db.add(
        SystemLog(
            level="INFO",
            message=f"Admin {current_admin.email} created user {created_user.email}",
        )
    )
    db.commit()
    db.refresh(created_user)
    return created_user

@router.get("/users")
def get_all_users(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_active_admin),
) -> Any:
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": u.created_at
        } for u in users
    ]

class AdminUpdate(BaseModel):
    full_name: str
    email: str
    password: Optional[str] = None

@router.put("/profile")
def update_admin_profile(
    *,
    db: Session = Depends(get_db),
    admin_in: AdminUpdate,
    current_admin: User = Depends(get_current_active_admin),
) -> Any:
    current_admin.full_name = admin_in.full_name
    current_admin.email = admin_in.email
    if admin_in.password:
        from app.core.security import get_password_hash
        current_admin.hashed_password = get_password_hash(admin_in.password)
    
    db.commit()
    db.refresh(current_admin)
    return current_admin

class AdminUserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

@router.put("/users/{user_id}")
def update_user_by_admin(
    *,
    user_id: int,
    db: Session = Depends(get_db),
    user_in: AdminUserUpdate,
    current_admin: User = Depends(get_current_active_admin),
) -> Any:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user_in.full_name is not None:
        user.full_name = user_in.full_name
    if user_in.email is not None:
        user.email = user_in.email
    if user_in.password:
        from app.core.security import get_password_hash
        user.hashed_password = get_password_hash(user_in.password)
    if user_in.role:
        from app.models.user import RoleEnum
        user.role = RoleEnum.admin if user_in.role == "admin" else RoleEnum.user
    if user_in.is_active is not None:
        user.is_active = user_in.is_active
        
    db.commit()
    return {"message": "User updated"}

@router.delete("/users/{user_id}")
def delete_user_by_admin(
    *,
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_active_admin),
) -> Any:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
        
    db.delete(user)
    db.commit()
    return {"message": "User deleted"}
