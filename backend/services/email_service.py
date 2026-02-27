"""
阿里云邮件推送服务
"""

import random
import string
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from sqlalchemy.orm import Session

from alibabacloud_dm20151123.client import Client as DmClient
from alibabacloud_dm20151123 import models as dm_models
from alibabacloud_tea_openapi import models as open_api_models

from config import settings
from models.user import EmailVerificationCode


class EmailService:
    """邮件服务"""

    def __init__(self):
        self.client = self._create_client()
        self.account_name = settings.aliyun_dm_account_name
        self.from_alias = settings.aliyun_dm_from_alias or "AI面试助手"

    def _create_client(self) -> DmClient:
        """创建阿里云邮件推送客户端"""
        config = open_api_models.Config(
            access_key_id=settings.aliyun_access_key_id,
            access_key_secret=settings.aliyun_access_key_secret
        )
        config.endpoint = "dm.aliyuncs.com"
        return DmClient(config)

    @staticmethod
    def generate_code(length: int = 6) -> str:
        """生成随机验证码"""
        return ''.join(random.choices(string.digits, k=length))

    def check_rate_limit(
        self,
        db: Session,
        email: str,
        ip_address: Optional[str] = None
    ) -> Tuple[bool, str]:
        """
        检查发送频率限制

        返回: (是否允许发送, 错误消息)
        """
        now = datetime.now(timezone.utc)

        # 检查 60 秒内是否已发送
        recent_code = db.query(EmailVerificationCode).filter(
            EmailVerificationCode.email == email,
            EmailVerificationCode.created_at > now - timedelta(seconds=60)
        ).first()

        if recent_code:
            return False, "请等待60秒后再次发送"

        # 检查 IP 每小时限制（如果提供了 IP）
        if ip_address:
            ip_count = db.query(EmailVerificationCode).filter(
                EmailVerificationCode.ip_address == ip_address,
                EmailVerificationCode.created_at > now - timedelta(hours=1)
            ).count()

            if ip_count >= 10:
                return False, "发送次数过多，请稍后再试"

        # 检查邮箱每天限制
        daily_count = db.query(EmailVerificationCode).filter(
            EmailVerificationCode.email == email,
            EmailVerificationCode.created_at > now - timedelta(hours=24)
        ).count()

        if daily_count >= 50:
            return False, "今日发送次数已达上限"

        return True, ""

    def send_verification_code(
        self,
        db: Session,
        email: str,
        ip_address: Optional[str] = None,
        purpose: str = "login"
    ) -> Tuple[bool, str]:
        """
        发送验证码

        返回: (是否成功, 消息)
        """
        # 检查频率限制
        allowed, error_msg = self.check_rate_limit(db, email, ip_address)
        if not allowed:
            return False, error_msg

        # 生成验证码
        code = self.generate_code()

        # 如果没有配置邮件服务，使用开发模式
        if not self.account_name:
            # 开发模式：直接存储验证码，不实际发送
            self._save_verification_code(db, email, code, ip_address, purpose)
            print(f"[DEV MODE] 验证码: {email} -> {code}")
            return True, f"开发模式：验证码为 {code}"

        # 调用阿里云邮件推送 API
        try:
            send_request = dm_models.SingleSendMailRequest(
                account_name=self.account_name,
                address_type=1,
                reply_to_address=False,
                to_address=email,
                subject="您的登录验证码",
                html_body=self._build_email_body(code),
                from_alias=self.from_alias
            )

            response = self.client.single_send_mail(send_request)

            if response.body:
                # 存储验证码记录
                self._save_verification_code(db, email, code, ip_address, purpose)
                return True, "验证码发送成功"
            else:
                return False, "发送失败"

        except Exception as e:
            return False, f"发送失败: {str(e)}"

    def _build_email_body(self, code: str) -> str:
        """构建邮件HTML内容"""
        return f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">验证码</h2>
            <p style="color: #666; font-size: 16px;">您的验证码是：</p>
            <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
                <span style="font-size: 32px; font-weight: bold; color: #333; letter-spacing: 8px;">{code}</span>
            </div>
            <p style="color: #999; font-size: 14px;">验证码5分钟内有效，请勿泄露给他人。</p>
            <p style="color: #999; font-size: 14px;">如非本人操作，请忽略此邮件。</p>
        </div>
        """

    def _save_verification_code(
        self,
        db: Session,
        email: str,
        code: str,
        ip_address: Optional[str],
        purpose: str
    ):
        """保存验证码记录"""
        verification = EmailVerificationCode(
            email=email,
            code=code,
            purpose=purpose,
            ip_address=ip_address,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=5)
        )
        db.add(verification)
        db.commit()

    def verify_code(
        self,
        db: Session,
        email: str,
        code: str,
        purpose: str = "login"
    ) -> Tuple[bool, str]:
        """
        验证验证码

        返回: (是否有效, 消息)
        """
        now = datetime.now(timezone.utc)

        # 查找最近的未使用验证码
        verification = db.query(EmailVerificationCode).filter(
            EmailVerificationCode.email == email,
            EmailVerificationCode.code == code,
            EmailVerificationCode.purpose == purpose,
            EmailVerificationCode.is_used == False,
            EmailVerificationCode.expires_at > now
        ).order_by(EmailVerificationCode.created_at.desc()).first()

        if not verification:
            return False, "验证码无效或已过期"

        # 标记为已使用
        verification.is_used = True
        db.commit()

        return True, "验证成功"


# 全局实例
email_service = EmailService()
