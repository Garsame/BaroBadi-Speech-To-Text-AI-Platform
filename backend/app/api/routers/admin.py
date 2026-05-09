from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Any

from app.core.database import get_db
from app.models.user import User, RoleEnum
from app.models.lecture import Lecture, LectureStatus
from app.models.note import Note
from app.models.log import SystemLog
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
    total_lectures = db.query(Lecture).count()
    total_notes = db.query(Note).count()
    
    completed_lectures = db.query(Lecture).filter(Lecture.status == LectureStatus.completed).count()
    failed_lectures = db.query(Lecture).filter(Lecture.status == LectureStatus.failed).count()
    
    success_rate = 0
    total_processed = completed_lectures + failed_lectures
    if total_processed > 0:
        success_rate = round((completed_lectures / total_processed) * 100, 1)

    return {
        "total_users": total_users,
        "total_lectures": total_lectures,
        "total_notes": total_notes,
        "completed_processing": completed_lectures,
        "failed_processing": failed_lectures,
        "automation_success_rate": success_rate,
    }

@router.get("/recent-lectures")
def get_recent_all_lectures(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_active_admin),
    limit: int = 20
) -> Any:
    """Get recent lectures created by any user in the system."""
    lectures = db.query(Lecture).order_by(Lecture.created_at.desc()).limit(limit).all()
    
    # Manually serialize to include owner details easily
    result = []
    for lec in lectures:
        owner = db.query(User).filter(User.id == lec.owner_id).first()
        result.append({
            "id": lec.id,
            "title": lec.title,
            "status": lec.status,
            "source_type": lec.source_type,
            "created_at": lec.created_at,
            "owner_name": owner.full_name if owner else "Unknown",
            "owner_email": owner.email if owner else "Unknown",
        })
    return result

@router.get("/system-logs")
def get_system_logs(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_active_admin),
    limit: int = 50
) -> Any:
    """Get the most recent system logs."""
    logs = db.query(SystemLog).order_by(SystemLog.created_at.desc()).limit(limit).all()
    # Serialize safely
    return [
        {
            "id": log.id,
            "level": log.level,
            "message": log.message,
            "created_at": log.created_at
        } for log in logs
    ]

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
