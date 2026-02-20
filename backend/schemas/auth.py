"""
认证相关 Pydantic Schemas
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


# ============ 请求 Schemas ============

class SendCodeRequest(BaseModel):
    """发送验证码请求"""
    email: str = Field(..., pattern=r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", description="邮箱地址")


class LoginRequest(BaseModel):
    """登录请求"""
    email: str = Field(..., pattern=r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", description="邮箱地址")
    code: str = Field(..., min_length=6, max_length=6, description="验证码")


# ============ 响应 Schemas ============

class SendCodeResponse(BaseModel):
    """发送验证码响应"""
    success: bool
    message: str
    expires_in: int = Field(default=300, description="验证码有效期（秒）")


class UserInfo(BaseModel):
    """用户信息"""
    id: UUID
    email: str
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None
    is_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    """登录响应"""
    success: bool
    message: str
    token: Optional[str] = None
    token_type: str = "Bearer"
    expires_in: int = Field(default=604800, description="Token 有效期（秒），默认 7 天")
    user: Optional[UserInfo] = None


class TokenPayload(BaseModel):
    """JWT Token Payload"""
    sub: str  # user_id
    email: str
    exp: datetime
    iat: datetime


class MeResponse(BaseModel):
    """获取当前用户响应"""
    id: UUID
    email: str
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool
    is_verified: bool
    last_login_at: Optional[datetime] = None
    login_count: int
    created_at: datetime

    class Config:
        from_attributes = True
