"""
JWT 认证依赖注入（自建邮件验证码 + JWT）
"""

from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from services.auth_service import auth_service

# Bearer Token 提取器
security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """获取当前用户（必须登录）"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未提供认证信息",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = credentials.credentials
    valid, token_data, error_msg = auth_service.verify_token(token)

    if not valid or not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_msg or "Token 无效",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user = auth_service.get_user_by_id(db, UUID(token_data.sub))

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="用户已被禁用"
        )

    return user


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """获取当前用户（可选）"""
    if not credentials:
        return None

    try:
        token = credentials.credentials
        valid, token_data, _ = auth_service.verify_token(token)
        if not valid or not token_data:
            return None

        user = auth_service.get_user_by_id(db, UUID(token_data.sub))
        return user if user and user.is_active else None
    except Exception:
        return None


async def get_user_from_token(
    token: str = Query(None),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """从 URL 参数获取用户（用于 WebSocket）"""
    if not token:
        return None

    try:
        valid, token_data, _ = auth_service.verify_token(token)
        if not valid or not token_data:
            return None

        user = auth_service.get_user_by_id(db, UUID(token_data.sub))
        return user if user and user.is_active else None
    except Exception:
        return None
