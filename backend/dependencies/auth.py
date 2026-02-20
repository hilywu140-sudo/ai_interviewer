"""
Clerk 认证依赖注入
"""

import requests
import jwt
from typing import Optional
from datetime import datetime

from fastapi import Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from config import settings


# Bearer Token 提取器
security = HTTPBearer(auto_error=False)

# Clerk JWKS 缓存
_jwks_cache = None
_jwks_cache_time = None
JWKS_CACHE_DURATION = 3600  # 1小时


def get_clerk_jwks_sync():
    """同步获取 Clerk 的 JWKS (JSON Web Key Set)"""
    global _jwks_cache, _jwks_cache_time

    now = datetime.now().timestamp()
    if _jwks_cache and _jwks_cache_time and (now - _jwks_cache_time) < JWKS_CACHE_DURATION:
        return _jwks_cache

    if not settings.clerk_secret_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Clerk 未配置"
        )

    try:
        clerk_frontend_api = "known-kiwi-14.clerk.accounts.dev"
        jwks_url = f"https://{clerk_frontend_api}/.well-known/jwks.json"

        response = requests.get(jwks_url, timeout=10)
        response.raise_for_status()
        _jwks_cache = response.json()
        _jwks_cache_time = now
        print(f"[DEBUG] JWKS fetched successfully: {len(_jwks_cache.get('keys', []))} keys")
        return _jwks_cache
    except Exception as e:
        print(f"[DEBUG] Failed to fetch JWKS: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"无法获取 Clerk JWKS: {str(e)}"
        )


async def verify_clerk_token(token: str) -> dict:
    """验证 Clerk JWT Token"""
    try:
        # 获取 JWKS (使用同步方法)
        jwks = get_clerk_jwks_sync()

        # 解码 token header 获取 kid
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        print(f"[DEBUG] Token kid: {kid}")

        # 找到对应的公钥
        public_key = None
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key)
                break

        if not public_key:
            print(f"[DEBUG] No matching key found for kid: {kid}")
            print(f"[DEBUG] Available keys: {[k.get('kid') for k in jwks.get('keys', [])]}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的 Token 签名",
                headers={"WWW-Authenticate": "Bearer"}
            )

        # 验证并解码 token，添加时间容差处理时钟偏差
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={"verify_aud": False},  # Clerk 不使用 aud
            leeway=60  # 允许 60 秒的时间偏差
        )
        print(f"[DEBUG] Token payload: {payload}")

        return payload

    except jwt.ExpiredSignatureError:
        print("[DEBUG] Token expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token 已过期",
            headers={"WWW-Authenticate": "Bearer"}
        )
    except jwt.InvalidTokenError as e:
        print(f"[DEBUG] Invalid token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"无效的 Token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"}
        )
    except Exception as e:
        print(f"[DEBUG] Unexpected error in verify_clerk_token: {e}")
        raise


def get_or_create_user_from_clerk(db: Session, clerk_payload: dict) -> User:
    """
    根据 Clerk Token 获取或创建用户

    用户同步逻辑:
    1. 先通过 clerk_user_id 查找
    2. 如果没找到，通过 JWT 中的 email 查找现有用户并关联
    3. 如果都没找到，创建新用户

    注意: 需要在 Clerk Dashboard 的 Session Token 中配置:
    {"email": "{{user.primary_email_address}}"}
    """
    clerk_user_id = clerk_payload.get("sub")
    email = clerk_payload.get("email")

    print(f"[DEBUG] clerk_user_id: {clerk_user_id}, email: {email}")

    # 1. 通过 clerk_user_id 查找
    user = db.query(User).filter(User.clerk_user_id == clerk_user_id).first()
    if user:
        print(f"[DEBUG] Found user by clerk_user_id: {user.id}")
        return user

    # 2. 通过邮箱查找现有用户
    if email:
        user = db.query(User).filter(User.email == email).first()
        if user:
            print(f"[DEBUG] Found user by email: {user.id}, updating clerk_user_id")
            user.clerk_user_id = clerk_user_id
            db.commit()
            db.refresh(user)
            return user

    # 3. 创建新用户
    nickname = email.split("@")[0] if email else "用户"
    print(f"[DEBUG] Creating new user with email: {email}")

    new_user = User(
        email=email,
        clerk_user_id=clerk_user_id,
        nickname=nickname,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    print(f"[DEBUG] Created new user: {new_user.id}")
    return new_user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    获取当前用户（必须登录）

    用于需要认证的 API 端点
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未提供认证信息",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = credentials.credentials
    payload = await verify_clerk_token(token)

    user = get_or_create_user_from_clerk(db, payload)

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
    """
    获取当前用户（可选）

    用于登录和未登录都可以访问的 API
    """
    if not credentials:
        return None

    try:
        token = credentials.credentials
        payload = await verify_clerk_token(token)
        user = get_or_create_user_from_clerk(db, payload)

        if not user.is_active:
            return None

        return user
    except HTTPException:
        return None


async def get_user_from_token(
    token: str = Query(None),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    从 URL 参数获取用户（用于 WebSocket）

    用法: ws://example.com/ws/chat/{session_id}?token=xxx
    """
    if not token:
        return None

    try:
        payload = await verify_clerk_token(token)
        user = get_or_create_user_from_clerk(db, payload)

        if not user.is_active:
            return None

        return user
    except HTTPException:
        return None
