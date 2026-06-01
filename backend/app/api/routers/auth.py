import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import Any

from app.core.database import get_db
from app.core.config import settings
from app.core.security import create_access_token
from app.models.log import ActivityLog, SystemLog
from app.models.user import RoleEnum
from app.schemas.user import UserCreate, User
from app.schemas.token import Token
from app.services.auth_service import AuthService
from app.api.dependencies import get_current_user

router = APIRouter()
logger = logging.getLogger("somali_notes.auth")

@router.post("/login", response_model=Token)
def login_access_token(
    db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """OAuth2 compatible token login, get an access token for future requests."""
    logger.info("Login attempt for email=%s", form_data.username)
    auth_service = AuthService(db)
    user = auth_service.authenticate(email=form_data.username, password=form_data.password)
    if not user:
        logger.warning("Login failed for email=%s", form_data.username)
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    elif not user.is_active:
        logger.warning("Login blocked for inactive user email=%s", form_data.username)
        raise HTTPException(status_code=400, detail="Inactive user")
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    logger.info("Login success for user_id=%s email=%s", user.id, user.email)
    action = "ADMIN_LOGIN" if user.role == RoleEnum.admin else "USER_LOGIN"
    db.add(
        ActivityLog(
            action=action,
            user_id=user.id,
            details={
                "email": user.email,
                "role": user.role.value if hasattr(user.role, "value") else str(user.role),
            },
        )
    )
    db.commit()
    return {
        "access_token": create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }

@router.post("/signup", response_model=User)
def create_new_user(
    *,
    db: Session = Depends(get_db),
    user_in: UserCreate,
) -> Any:
    """Create new user."""
    logger.info("Signup attempt for email=%s", user_in.email)
    auth_service = AuthService(db)
    user = auth_service.get_user_by_email(email=user_in.email)
    if user:
        logger.warning("Signup rejected because email already exists: %s", user_in.email)
        raise HTTPException(
            status_code=400,
            detail="The user with this username already exists in the system.",
        )
    user = auth_service.create_user(user_in)
    
    # Write robust logging for the system and the user
    sys_log = SystemLog(level="INFO", message=f"New user registered: {user.email}")
    act_log = ActivityLog(action="USER_SIGNUP", user_id=user.id, details={"email": user.email})
    db.add(sys_log)
    db.add(act_log)
    db.commit()
    
    logger.info("Signup success for user_id=%s email=%s", user.id, user.email)
    return user

@router.post("/admin-signup", response_model=User)
def create_new_admin_user(
    *,
    db: Session = Depends(get_db),
    user_in: UserCreate,
) -> Any:
    """Create new admin user exclusively."""
    logger.info("Admin signup attempt for email=%s", user_in.email)
    auth_service = AuthService(db)
    user = auth_service.get_user_by_email(email=user_in.email)
    if user:
        logger.warning("Admin signup rejected because email already exists: %s", user_in.email)
        raise HTTPException(
            status_code=400,
            detail="The user with this username already exists in the system.",
        )
    user = auth_service.create_user(user_in)
    
    # Elevate to admin
    user.role = RoleEnum.admin
    db.add(
        ActivityLog(
            action="ADMIN_SIGNUP",
            user_id=user.id,
            details={"email": user.email, "role": RoleEnum.admin.value},
        )
    )
    db.add(SystemLog(level="INFO", message=f"New admin registered: {user.email}"))
    db.commit()
    
    logger.info("Admin signup success for user_id=%s email=%s", user.id, user.email)
    return user

@router.get("/me", response_model=User)
def read_user_me(
    current_user: User = Depends(get_current_user),
) -> Any:
    """Get current user."""
    return current_user

from pydantic import BaseModel
from typing import Optional
from app.core.security import get_password_hash

class UserUpdate(BaseModel):
    full_name: str
    email: str
    password: Optional[str] = None

@router.put("/me/profile", response_model=User)
def update_user_profile(
    *,
    db: Session = Depends(get_db),
    user_in: UserUpdate,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Update current user profile info."""
    current_user.full_name = user_in.full_name
    current_user.email = user_in.email
    if user_in.password:
        current_user.hashed_password = get_password_hash(user_in.password)
    
    db.commit()
    db.refresh(current_user)
    return current_user

from fastapi import UploadFile, File
import shutil
import uuid
import os

@router.post("/me/avatar", response_model=User)
def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    # Ensure directory exists
    os.makedirs("uploads/profiles", exist_ok=True)
    
    MAX_SIZE = 5 * 1024 * 1024 # 5 MB
    ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
    ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}

    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPG, PNG, and WebP are allowed.")
        
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file extension.")

    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    if file_size > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB.")

    # Create random filename
    filename = f"{uuid.uuid4().hex}.{ext}"
    file_path = f"uploads/profiles/{filename}"
    
    # Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    current_user.profile_picture_url = f"/uploads/profiles/{filename}"
    db.commit()
    db.refresh(current_user)
    
    return current_user

@router.delete("/me/avatar", response_model=User)
def delete_avatar(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """Remove user avatar gracefully from DB and filesystem."""
    if current_user.profile_picture_url:
        file_path = current_user.profile_picture_url.lstrip("/")
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                logger.error(f"Failed to delete file {file_path}: {e}")
                
        current_user.profile_picture_url = None
        db.commit()
        db.refresh(current_user)
        
    return current_user

@router.get("/me/activity")
def get_user_activity(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 5
) -> Any:
    """Get recent activity logs exclusively for current user."""
    from app.models.log import ActivityLog
    logs = db.query(ActivityLog).filter(ActivityLog.user_id == current_user.id).order_by(ActivityLog.created_at.desc()).limit(limit).all()
    return [
        {
            "id": log.id,
            "action": log.action,
            "created_at": log.created_at,
            "details": log.details
        } for log in logs
    ]
