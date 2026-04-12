from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr


class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserUpdate(UserBase):
    password: Optional[str] = None


class UserInDBBase(UserBase):
    id: int
    role: str
    is_active: bool
    created_at: datetime
    profile_picture_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class User(UserInDBBase):
    pass
