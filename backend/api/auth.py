"""
认证 API 端点
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from schemas.auth import (
    SendCodeRequest,
    SendCodeResponse,
    LoginRequest,
    LoginResponse,
    UserInfo,
    MeResponse
)
from services.sms_service import sms_service
from services.auth_service import auth_service
from dependencies.auth import get_current_user


router = APIRouter(prefix="/auth", tags=["认证"])


def get_client_ip(request: Request) -> str:
    """获取客户端 IP"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else ""


@router.post("/send-code", response_model=SendCodeResponse)
async def send_verification_code(
    body: SendCodeRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    发送短信验证码

    - 60秒内不能重复发送
    - 每个IP每小时最多10次
    - 每个手机号每天最多10次
    """
    ip_address = get_client_ip(request)

    success, message = sms_service.send_verification_code(
        db=db,
        phone=body.phone,
        ip_address=ip_address,
        purpose="login"
    )

    return SendCodeResponse(
        success=success,
        message=message,
        expires_in=300  # 5分钟有效
    )


@router.post("/login", response_model=LoginResponse)
async def login(
    body: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    验证码登录

    - 验证码正确则登录成功
    - 新用户自动注册
    - 返回 JWT Token
    """
    # 验证验证码
    valid, error_msg = sms_service.verify_code(
        db=db,
        phone=body.phone,
        code=body.code,
        purpose="login"
    )

    if not valid:
        return LoginResponse(
            success=False,
            message=error_msg
        )

    # 获取或创建用户
    user, is_new = auth_service.get_or_create_user(db, body.phone)

    # 生成 Token
    token = auth_service.create_access_token(user)

    return LoginResponse(
        success=True,
        message="注册成功" if is_new else "登录成功",
        token=token,
        token_type="Bearer",
        expires_in=7 * 24 * 3600,  # 7天
        user=UserInfo(
            id=user.id,
            phone=user.phone,
            nickname=user.nickname,
            avatar_url=user.avatar_url,
            is_verified=user.is_verified,
            created_at=user.created_at
        )
    )


@router.get("/me", response_model=MeResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """
    获取当前用户信息

    需要 Bearer Token 认证
    """
    return MeResponse(
        id=current_user.id,
        phone=current_user.phone,
        nickname=current_user.nickname,
        avatar_url=current_user.avatar_url,
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        last_login_at=current_user.last_login_at,
        login_count=current_user.login_count,
        created_at=current_user.created_at
    )


@router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_user)
):
    """
    登出

    注意：JWT 是无状态的，服务端无法使 Token 失效
    前端需要删除本地存储的 Token
    """
    return {"success": True, "message": "登出成功"}
