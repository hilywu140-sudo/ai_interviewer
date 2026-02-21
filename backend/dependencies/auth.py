"""
Supabase 认证依赖注入
"""

import jwt
import requests
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

# JWKS 缓存
_jwks_cache = None
_jwks_cache_time = None
JWKS_CACHE_DURATION = 3600  # 1小时


def get_supabase_jwks():
    """获取 Supabase 的 JWKS (JSON Web Key Set)"""
    global _jwks_cache, _jwks_cache_time

    now = datetime.now().timestamp()
    if _jwks_cache and _jwks_cache_time and (now - _jwks_cache_time) < JWKS_CACHE_DURATION:
        return _jwks_cache

    if not settings.supabase_url:
        raise ValueError("Supabase URL 未配置")

    try:
        # Supabase JWKS 端点
        jwks_url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
        response = requests.get(jwks_url, timeout=10)
        response.raise_for_status()
        _jwks_cache = response.json()
        _jwks_cache_time = now
        print(f"[DEBUG] JWKS fetched: {len(_jwks_cache.get('keys', []))} keys")
        return _jwks_cache
    except Exception as e:
        print(f"[DEBUG] Failed to fetch JWKS: {e}")
        raise ValueError(f"无法获取 Supabase JWKS: {str(e)}")


async def verify_supabase_token(token: str) -> dict:
    """验证 Supabase JWT Token"""
    try:
        jwks = get_supabase_jwks()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

    try:
        # 解码 token header 获取 kid
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        alg = unverified_header.get("alg", "ES256")
        print(f"[DEBUG] Token alg: {alg}, kid: {kid}")

        # 找到对应的公钥
        public_key = None
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                public_key = jwt.algorithms.ECAlgorithm.from_jwk(key)
                break

        if not public_key:
            print(f"[DEBUG] No matching key found for kid: {kid}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的 Token 签名",
                headers={"WWW-Authenticate": "Bearer"}
            )

        # 验证并解码 token
        payload = jwt.decode(
            token,
            public_key,
            algorithms=[alg],
            audience="authenticated"
        )
        return payload

    except jwt.ExpiredSignatureError:
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


def get_or_create_user_from_supabase(db: Session, supabase_payload: dict) -> User:
    """
    根据 Supabase Token 获取或创建用户

    Supabase JWT payload 包含:
    - sub: 用户 UUID
    - email: 用户邮箱
    - aud: "authenticated"
    """
    supabase_user_id = supabase_payload.get("sub")
    email = supabase_payload.get("email")

    # 1. 通过 supabase_user_id 查找
    user = db.query(User).filter(User.supabase_user_id == supabase_user_id).first()
    if user:
        return user

    # 2. 通过邮箱查找现有用户并关联
    if email:
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.supabase_user_id = supabase_user_id
            db.commit()
            db.refresh(user)
            return user

    # 3. 创建新用户
    nickname = email.split("@")[0] if email else "用户"
    new_user = User(
        email=email,
        supabase_user_id=supabase_user_id,
        nickname=nickname,
        is_active=True,
        is_verified=True  # Supabase 已验证邮箱
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """获取当前用户（必须登录）"""
    print(f"[DEBUG] credentials: {credentials}")
    if not credentials:
        print("[DEBUG] No credentials provided")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未提供认证信息",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = credentials.credentials
    print(f"[DEBUG] Token received: {token[:50]}...")
    payload = await verify_supabase_token(token)
    print(f"[DEBUG] Payload: {payload}")
    user = get_or_create_user_from_supabase(db, payload)

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
        payload = await verify_supabase_token(token)
        user = get_or_create_user_from_supabase(db, payload)
        return user if user.is_active else None
    except HTTPException:
        return None


async def get_user_from_token(
    token: str = Query(None),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """从 URL 参数获取用户（用于 WebSocket）"""
    if not token:
        return None

    try:
        payload = await verify_supabase_token(token)
        user = get_or_create_user_from_supabase(db, payload)
        return user if user.is_active else None
    except HTTPException:
        return None
