"""
阿里云短信服务
"""

import random
import string
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from sqlalchemy.orm import Session

from alibabacloud_dysmsapi20170525.client import Client as DysmsapiClient
from alibabacloud_dysmsapi20170525 import models as dysms_models
from alibabacloud_tea_openapi import models as open_api_models

from config import settings
from models.user import SmsVerificationCode


class SmsService:
    """短信服务"""

    def __init__(self):
        self.client = self._create_client()
        self.sign_name = settings.aliyun_sms_sign_name
        self.template_code = settings.aliyun_sms_template_code

    def _create_client(self) -> DysmsapiClient:
        """创建阿里云短信客户端"""
        config = open_api_models.Config(
            access_key_id=settings.aliyun_access_key_id,
            access_key_secret=settings.aliyun_access_key_secret
        )
        config.endpoint = "dysmsapi.aliyuncs.com"
        return DysmsapiClient(config)

    @staticmethod
    def generate_code(length: int = 6) -> str:
        """生成随机验证码"""
        return ''.join(random.choices(string.digits, k=length))

    def check_rate_limit(
        self,
        db: Session,
        phone: str,
        ip_address: Optional[str] = None
    ) -> Tuple[bool, str]:
        """
        检查发送频率限制

        返回: (是否允许发送, 错误消息)
        """
        now = datetime.now(timezone.utc)

        # 检查 60 秒内是否已发送
        recent_code = db.query(SmsVerificationCode).filter(
            SmsVerificationCode.phone == phone,
            SmsVerificationCode.created_at > now - timedelta(seconds=60)
        ).first()

        if recent_code:
            return False, "请等待60秒后再次发送"

        # 检查 IP 每小时限制（如果提供了 IP）
        if ip_address:
            ip_count = db.query(SmsVerificationCode).filter(
                SmsVerificationCode.ip_address == ip_address,
                SmsVerificationCode.created_at > now - timedelta(hours=1)
            ).count()

            if ip_count >= 10:
                return False, "发送次数过多，请稍后再试"

        # 检查手机号每天限制
        daily_count = db.query(SmsVerificationCode).filter(
            SmsVerificationCode.phone == phone,
            SmsVerificationCode.created_at > now - timedelta(hours=24)
        ).count()

        if daily_count >= 50:
            return False, "今日发送次数已达上限"

        return True, ""

    def send_verification_code(
        self,
        db: Session,
        phone: str,
        ip_address: Optional[str] = None,
        purpose: str = "login"
    ) -> Tuple[bool, str]:
        """
        发送验证码

        返回: (是否成功, 消息)
        """
        # 检查频率限制
        allowed, error_msg = self.check_rate_limit(db, phone, ip_address)
        if not allowed:
            return False, error_msg

        # 生成验证码
        code = self.generate_code()

        # 如果没有配置短信服务，使用开发模式
        if not self.sign_name or not self.template_code:
            # 开发模式：直接存储验证码，不实际发送
            self._save_verification_code(db, phone, code, ip_address, purpose)
            print(f"[DEV MODE] 验证码: {phone} -> {code}")
            return True, f"开发模式：验证码为 {code}"

        # 调用阿里云短信 API
        try:
            send_request = dysms_models.SendSmsRequest(
                phone_numbers=phone,
                sign_name=self.sign_name,
                template_code=self.template_code,
                template_param=f'{{"code":"{code}"}}'
            )

            response = self.client.send_sms(send_request)

            if response.body.code == "OK":
                # 存储验证码记录
                self._save_verification_code(db, phone, code, ip_address, purpose)
                return True, "验证码发送成功"
            else:
                return False, f"发送失败: {response.body.message}"

        except Exception as e:
            return False, f"发送失败: {str(e)}"

    def _save_verification_code(
        self,
        db: Session,
        phone: str,
        code: str,
        ip_address: Optional[str],
        purpose: str
    ):
        """保存验证码记录"""
        verification = SmsVerificationCode(
            phone=phone,
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
        phone: str,
        code: str,
        purpose: str = "login"
    ) -> Tuple[bool, str]:
        """
        验证验证码

        返回: (是否有效, 消息)
        """
        now = datetime.now(timezone.utc)

        # 查找最近的未使用验证码
        verification = db.query(SmsVerificationCode).filter(
            SmsVerificationCode.phone == phone,
            SmsVerificationCode.code == code,
            SmsVerificationCode.purpose == purpose,
            SmsVerificationCode.is_used == False,
            SmsVerificationCode.expires_at > now
        ).order_by(SmsVerificationCode.created_at.desc()).first()

        if not verification:
            return False, "验证码无效或已过期"

        # 标记为已使用
        verification.is_used = True
        db.commit()

        return True, "验证成功"


# 全局实例
sms_service = SmsService()
