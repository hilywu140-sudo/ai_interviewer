"""
用户相关 Pydantic Schemas
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class UserBase(BaseModel):
    email: str = Field(..., pattern=r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None


class UserCreate(UserBase):
    pass


class UserUpdate(BaseModel):
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None


class UserResponse(BaseModel):
    id: UUID
    email: str
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool
    is_verified: bool
    last_login_at: Optional[datetime] = None
    login_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserBriefResponse(BaseModel):
    """用户简要信息（用于列表等场景）"""
    id: UUID
    email: str
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True
