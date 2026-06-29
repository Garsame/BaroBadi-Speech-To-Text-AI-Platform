import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta, datetime
from typing import Any, Optional
from pydantic import BaseModel

class EmailVerificationRequest(BaseModel):
    code: Optional[str] = None

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
    
    # Pre-fetch user to check lockout
    user_record = auth_service.get_user_by_email(email=form_data.username)
    if user_record:
        if user_record.lockout_until and datetime.utcnow() < user_record.lockout_until:
            time_remaining = user_record.lockout_until - datetime.utcnow()
            minutes_remaining = int(time_remaining.total_seconds() / 60) + 1
            logger.warning("Login blocked due to lockout for email=%s", form_data.username)
            raise HTTPException(
                status_code=400,
                detail=f"Too many failed login attempts. Account is locked. Please try again in {minutes_remaining} minutes."
            )
            
    user = auth_service.authenticate(email=form_data.username, password=form_data.password)
    if not user:
        logger.warning("Login failed for email=%s", form_data.username)
        if user_record:
            user_record.login_attempts = getattr(user_record, "login_attempts", 0) + 1
            if user_record.login_attempts >= 4:
                user_record.lockout_until = datetime.utcnow() + timedelta(minutes=15)
                user_record.login_attempts = 0
                db.add(user_record)
                db.commit()
                raise HTTPException(
                    status_code=400,
                    detail="Too many failed login attempts. Account is locked. Please try again in 15 minutes."
                )
            db.add(user_record)
            db.commit()
        raise HTTPException(status_code=400, detail="Incorrect email or password")
        
    elif not user.is_active:
        logger.warning("Login blocked for inactive user email=%s", form_data.username)
        raise HTTPException(status_code=400, detail="Inactive user")
    elif user.role == RoleEnum.admin:
        logger.warning("Admin login attempted on user sign-in endpoint for email=%s", form_data.username)
        raise HTTPException(
            status_code=400,
            detail="Incorrect email or password"
        )
        
    # Successful login: reset attempts
    user.login_attempts = 0
    user.lockout_until = None
    db.add(user)
    db.commit()
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    logger.info("Login success for user_id=%s email=%s", user.id, user.email)
    db.add(
        ActivityLog(
            action="USER_LOGIN",
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

@router.post("/admin-login", response_model=Token)
def admin_login_access_token(
    db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """OAuth2 compatible token login for admins exclusively."""
    logger.info("Admin login attempt for email=%s", form_data.username)
    auth_service = AuthService(db)
    
    # Pre-fetch user to check lockout
    user_record = auth_service.get_user_by_email(email=form_data.username)
    if user_record:
        if user_record.lockout_until and datetime.utcnow() < user_record.lockout_until:
            time_remaining = user_record.lockout_until - datetime.utcnow()
            minutes_remaining = int(time_remaining.total_seconds() / 60) + 1
            logger.warning("Admin login blocked due to lockout for email=%s", form_data.username)
            raise HTTPException(
                status_code=400,
                detail=f"Too many failed login attempts. Account is locked. Please try again in {minutes_remaining} minutes."
            )
            
    user = auth_service.authenticate(email=form_data.username, password=form_data.password)
    if not user:
        logger.warning("Admin login failed for email=%s", form_data.username)
        if user_record:
            user_record.login_attempts = getattr(user_record, "login_attempts", 0) + 1
            if user_record.login_attempts >= 4:
                user_record.lockout_until = datetime.utcnow() + timedelta(minutes=15)
                user_record.login_attempts = 0
                db.add(user_record)
                db.commit()
                raise HTTPException(
                    status_code=400,
                    detail="Too many failed login attempts. Account is locked. Please try again in 15 minutes."
                )
            db.add(user_record)
            db.commit()
        raise HTTPException(status_code=400, detail="Incorrect email or password")
        
    elif not user.is_active:
        logger.warning("Admin login blocked for inactive user email=%s", form_data.username)
        raise HTTPException(status_code=400, detail="Inactive user")
    elif user.role != RoleEnum.admin:
        logger.warning("Non-admin user login attempted on admin sign-in endpoint for email=%s", form_data.username)
        raise HTTPException(
            status_code=400,
            detail="Incorrect email or password"
        )
        
    # Successful login: reset attempts
    user.login_attempts = 0
    user.lockout_until = None
    db.add(user)
    db.commit()
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    logger.info("Admin login success for user_id=%s email=%s", user.id, user.email)
    db.add(
        ActivityLog(
            action="ADMIN_LOGIN",
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
    if len(user_in.password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters long."
        )
    auth_service = AuthService(db)
    user = auth_service.get_user_by_email(email=user_in.email)
    if user:
        logger.warning("Signup rejected because email already exists: %s", user_in.email)
        raise HTTPException(
            status_code=400,
            detail="This email is already registered.",
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
def create_new_admin(
    *,
    db: Session = Depends(get_db),
    user_in: UserCreate,
) -> Any:
    """Create new administrator account."""
    logger.info("Admin signup attempt for email=%s", user_in.email)
    if len(user_in.password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters long."
        )
    auth_service = AuthService(db)
    user = auth_service.get_user_by_email(email=user_in.email)
    if user:
        logger.warning("Admin signup rejected because email already exists: %s", user_in.email)
        raise HTTPException(
            status_code=400,
            detail="This email is already registered.",
        )
    user = auth_service.create_user(user_in, role=RoleEnum.admin)
    user.is_email_verified = True
    db.commit()
    
    # Write robust logging for the system and the user
    sys_log = SystemLog(level="INFO", message=f"New admin registered: {user.email}")
    act_log = ActivityLog(action="ADMIN_SIGNUP", user_id=user.id, details={"email": user.email})
    db.add(sys_log)
    db.add(act_log)
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
    
    email_changed = False
    new_email = user_in.email.strip().lower()
    if new_email != current_user.email.lower():
        email_changed = True
        auth_service = AuthService(db)
        existing_user = auth_service.get_user_by_email(email=new_email)
        if existing_user and existing_user.id != current_user.id:
            raise HTTPException(
                status_code=400,
                detail="This email is already registered."
            )
        current_user.email = new_email
        current_user.is_email_verified = False

    if user_in.password:
        if len(user_in.password) < 8:
            raise HTTPException(
                status_code=400,
                detail="Password must be at least 8 characters long."
            )
        current_user.hashed_password = get_password_hash(user_in.password)
        current_user.has_password = True
    
    if email_changed:
        import secrets
        otp_code = "".join(secrets.choice("0123456789") for _ in range(6))
        current_user.otp_code = otp_code
        current_user.otp_expires_at = datetime.utcnow() + timedelta(minutes=15)
        current_user.otp_attempts = 0
        
        # Dispatch verification code email
        from app.services.email import send_otp_email
        send_otp_email(current_user.email, otp_code)
    
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

class GoogleLoginRequest(BaseModel):
    token: str

@router.post("/google-login", response_model=Token)
def google_login(
    *,
    db: Session = Depends(get_db),
    login_in: GoogleLoginRequest
) -> Any:
    """Login or register with Google."""
    import urllib.request
    import json
    
    google_data = None
    google_email = ""
    google_name = ""
    google_picture = None

    if login_in.token.startswith("mock-google-token-"):
        if not settings.ALLOW_MOCK_LOGIN:
            raise HTTPException(
                status_code=400,
                detail="Mock Google login is disabled in this environment."
            )
        # Simulated Google token format: "mock-google-token-email:name"
        token_content = login_in.token.replace("mock-google-token-", "")
        parts = token_content.split(":")
        google_email = parts[0]
        google_name = parts[1] if len(parts) > 1 else google_email.split("@")[0]
        logger.info("Using simulated Google login for email=%s", google_email)
    else:
        try:
            url = f"https://oauth2.googleapis.com/tokeninfo?id_token={login_in.token}"
            with urllib.request.urlopen(url) as response:
                google_data = json.loads(response.read().decode())
        except Exception as e:
            logger.error("Failed to verify Google token: %s", e)
            raise HTTPException(
                status_code=400,
                detail="Invalid Google credential token."
            )

        if not google_data or "email" not in google_data:
            raise HTTPException(
                status_code=400,
                detail="Could not retrieve email from Google credential token."
            )

        google_email = google_data["email"]
        google_name = google_data.get("name", google_email.split("@")[0])
        google_picture = google_data.get("picture", None)

    logger.info("Google login verified for email=%s", google_email)
    auth_service = AuthService(db)
    user = auth_service.get_user_by_email(email=google_email)
    
    if not user:
        import secrets
        from app.models.user import User as DBUser
        # Create a new user with Google login details
        # We assign a secure random password hash
        random_password = secrets.token_urlsafe(32)
        user = DBUser(
            email=google_email,
            hashed_password=get_password_hash(random_password),
            full_name=google_name,
            profile_picture_url=google_picture,
            role=RoleEnum.user,
            is_active=True,
            is_email_verified=True,  # Google accounts are pre-verified
            has_password=False       # Password has not been set yet
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info("New Google user registered: %s", user.email)
        
        # Logging
        sys_log = SystemLog(level="INFO", message=f"New Google user registered: {user.email}")
        act_log = ActivityLog(action="USER_SIGNUP", user_id=user.id, details={"email": user.email, "method": "google"})
        db.add(sys_log)
        db.add(act_log)
        db.commit()
    else:
        # If user exists, make sure they have a name/picture if empty
        if not user.full_name:
            user.full_name = google_name
        if not user.profile_picture_url and google_picture:
            user.profile_picture_url = google_picture
        user.is_email_verified = True  # Google users are always verified
        db.commit()
    
    # Generate access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    logger.info("Google login success for user_id=%s email=%s", user.id, user.email)
    
    db.add(
        ActivityLog(
            action="USER_LOGIN",
            user_id=user.id,
            details={"email": user.email, "method": "google"},
        )
    )
    db.commit()
    
    return {
        "access_token": create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }

@router.post("/verify-email", response_model=Any)
def verify_email(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    payload: Optional[EmailVerificationRequest] = None,
) -> Any:
    """Request email verification (sends OTP) or confirm verification OTP."""
    from app.models.user import User as DBUser
    
    if current_user.is_email_verified:
        return User.model_validate(current_user)
        
    # Case 1: Request OTP code
    if not payload or not payload.code:
        import secrets
        otp_code = "".join(secrets.choice("0123456789") for _ in range(6))
        
        # Save OTP to user record
        current_user.otp_code = otp_code
        current_user.otp_expires_at = datetime.utcnow() + timedelta(minutes=15)
        current_user.otp_attempts = 0
        db.add(current_user)
        db.commit()
        
        # Dispatch verification code email
        from app.services.email import send_otp_email
        send_otp_email(current_user.email, otp_code)
        
        return {"status": "otp_sent", "email": current_user.email}

    # Case 2: Verify OTP code
    if not current_user.otp_code or not current_user.otp_expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No verification code has been requested. Please request one first."
        )

    if datetime.utcnow() > current_user.otp_expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new one."
        )

    # Brute force protection check
    if getattr(current_user, "otp_attempts", 0) >= 5:
        current_user.otp_code = None
        current_user.otp_expires_at = None
        current_user.otp_attempts = 0
        db.add(current_user)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Too many incorrect attempts. Please request a new verification code."
        )

    if payload.code != current_user.otp_code:
        current_user.otp_attempts = getattr(current_user, "otp_attempts", 0) + 1
        db.add(current_user)
        db.commit()
        
        if current_user.otp_attempts >= 5:
            current_user.otp_code = None
            current_user.otp_expires_at = None
            current_user.otp_attempts = 0
            db.add(current_user)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Too many incorrect attempts. Please request a new verification code."
            )
            
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid verification code. Please check and try again. (Attempt {current_user.otp_attempts}/5)"
        )

    # Success: Mark email as verified
    current_user.is_email_verified = True
    current_user.otp_code = None
    current_user.otp_expires_at = None
    current_user.otp_attempts = 0
    db.add(current_user)
    
    db.add(
        ActivityLog(
            action="EMAIL_VERIFIED",
            user_id=current_user.id,
            details={"email": current_user.email},
        )
    )
    db.commit()
    db.refresh(current_user)
    logger.info("Email verified for user_id=%s email=%s", current_user.id, current_user.email)
    return User.model_validate(current_user)
