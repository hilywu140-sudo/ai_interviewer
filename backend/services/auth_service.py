"""
认证服务 - JWT Token 生成和验证
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from uuid import UUID

from jose import jwt, JWTError
from sqlalchemy.orm import Session

from config import settings
from models.user import User
from schemas.auth import TokenPayload


class AuthService:
    """认证服务"""

    def __init__(self):
        self.secret_key = settings.jwt_secret_key or settings.secret_key
        self.algorithm = settings.jwt_algorithm
        self.expire_days = settings.jwt_expire_days

    def create_access_token(self, user: User) -> str:
        """
        创建 JWT Token
        """
        now = datetime.now(timezone.utc)
        expire = now + timedelta(days=self.expire_days)

        payload = {
            "sub": str(user.id),
            "email": user.email,
            "iat": now,
            "exp": expire
        }

        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)

    def verify_token(self, token: str) -> Tuple[bool, Optional[TokenPayload], str]:
        """
        验证 JWT Token

        返回: (是否有效, TokenPayload, 错误消息)
        """
        try:
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm]
            )

            token_data = TokenPayload(
                sub=payload["sub"],
                email=payload["email"],
                exp=datetime.fromtimestamp(payload["exp"], tz=timezone.utc),
                iat=datetime.fromtimestamp(payload["iat"], tz=timezone.utc)
            )

            return True, token_data, ""

        except JWTError as e:
            return False, None, f"Token 无效: {str(e)}"

    def get_or_create_user(
        self,
        db: Session,
        email: str
    ) -> Tuple[User, bool]:
        """
        获取或创建用户

        返回: (用户, 是否新创建)
        """
        user = db.query(User).filter(User.email == email).first()

        if user:
            # 更新登录信息
            user.last_login_at = datetime.now(timezone.utc)
            user.login_count += 1
            user.is_verified = True
            db.commit()
            db.refresh(user)
            return user, False

        # 创建新用户
        user = User(
            email=email,
            is_verified=True,
            last_login_at=datetime.now(timezone.utc),
            login_count=1
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user, True

    def get_user_by_id(self, db: Session, user_id: UUID) -> Optional[User]:
        """根据 ID 获取用户"""
        return db.query(User).filter(User.id == user_id).first()

    def get_user_by_email(self, db: Session, email: str) -> Optional[User]:
        """根据邮箱获取用户"""
        return db.query(User).filter(User.email == email).first()


# 全局实例
auth_service = AuthService()
