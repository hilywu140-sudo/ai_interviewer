"""
阿里云 OSS 上传服务

用于上传音频文件到 OSS，供 ASR 服务使用。
"""

import logging
import uuid
from typing import Optional

import oss2

from config import settings

logger = logging.getLogger(__name__)


class OSSService:
    """
    阿里云 OSS 服务

    提供音频文件上传和删除功能
    """

    def __init__(self):
        self._bucket = None
        self.bucket_name = settings.aliyun_oss_bucket
        self.endpoint = settings.aliyun_oss_endpoint

    @property
    def bucket(self):
        """延迟初始化 bucket 连接"""
        if self._bucket is None:
            if not self.bucket_name:
                raise RuntimeError("OSS bucket 未配置，请设置 ALIYUN_OSS_BUCKET 环境变量")
            auth = oss2.Auth(
                settings.aliyun_access_key_id,
                settings.aliyun_access_key_secret
            )
            self._bucket = oss2.Bucket(
                auth,
                f"https://{self.endpoint}",
                self.bucket_name
            )
        return self._bucket

    def upload_audio(self, audio_data: bytes, suffix: str = '.wav', max_retries: int = 3) -> str:
        """
        上传音频文件到 OSS

        Args:
            audio_data: 音频字节数据
            suffix: 文件后缀，默认 .wav
            max_retries: 最大重试次数，默认 3

        Returns:
            音频文件的签名 URL（有效期 1 小时）
        """
        import time
        key = f"audio/{uuid.uuid4()}{suffix}"

        last_error = None
        for attempt in range(max_retries):
            try:
                result = self.bucket.put_object(key, audio_data)
                if result.status == 200:
                    # 生成签名 URL，有效期 3600 秒（1小时）
                    signed_url = self.bucket.sign_url('GET', key, 3600)
                    logger.info(f"音频上传成功: {key}")
                    logger.info(f"签名 URL: {signed_url[:100]}...")
                    return signed_url
                else:
                    raise Exception(f"OSS 上传失败，状态码: {result.status}")
            except Exception as e:
                last_error = e
                logger.warning(f"OSS 上传失败 (尝试 {attempt + 1}/{max_retries}): {e}")
                if attempt < max_retries - 1:
                    # 重置 bucket 连接
                    self._bucket = None
                    time.sleep(1)  # 等待 1 秒后重试

        logger.error(f"OSS 上传失败，已重试 {max_retries} 次: {last_error}")
        raise last_error

    def delete_audio(self, key: str) -> bool:
        """
        删除 OSS 上的音频文件

        Args:
            key: 文件的 object key

        Returns:
            是否删除成功
        """
        try:
            self.bucket.delete_object(key)
            logger.info(f"音频删除成功: {key}")
            return True
        except Exception as e:
            logger.error(f"OSS 删除失败: {e}")
            return False

    def get_key_from_url(self, url: str) -> Optional[str]:
        """
        从 URL 中提取 object key

        Args:
            url: OSS 文件 URL（可能是签名 URL）

        Returns:
            object key 或 None
        """
        try:
            from urllib.parse import urlparse, unquote
            parsed = urlparse(url)
            # 路径格式: /audio/xxx.wav 或 /audio%2Fxxx.wav
            path = unquote(parsed.path)
            if path.startswith('/'):
                path = path[1:]
            # 移除查询参数（签名部分）
            return path if path else None
        except Exception:
            return None

    def upload_audio_persistent(self, audio_data: bytes, suffix: str = '.wav') -> tuple:
        """
        持久化上传音频文件到 OSS（不会自动删除）

        Args:
            audio_data: 音频字节数据
            suffix: 文件后缀，默认 .wav

        Returns:
            tuple: (oss_key, oss_url) - OSS 对象 key 和基础 URL（不含签名）
        """
        key = f"audio/{uuid.uuid4()}{suffix}"

        result = self.bucket.put_object(key, audio_data)
        if result.status != 200:
            raise Exception(f"OSS 上传失败，状态码: {result.status}")

        # 返回 key 和基础 URL（不含签名）
        base_url = f"https://{self.bucket_name}.{self.endpoint}/{key}"
        logger.info(f"音频持久化上传成功: {key}")

        return key, base_url

    def get_signed_url(self, key: str, expires_in: int = 3600) -> str:
        """
        为已存在的 OSS 对象生成签名 URL

        Args:
            key: OSS 对象 key
            expires_in: URL 有效期（秒），默认 1 小时

        Returns:
            签名 URL
        """
        signed_url = self.bucket.sign_url('GET', key, expires_in)
        logger.debug(f"生成签名 URL: {key}, expires_in={expires_in}")
        return signed_url

    def delete_expired_audio(self, keys: list) -> int:
        """
        批量删除过期的音频文件

        Args:
            keys: 要删除的 OSS 对象 key 列表

        Returns:
            成功删除的文件数量
        """
        deleted = 0
        for key in keys:
            try:
                self.bucket.delete_object(key)
                deleted += 1
                logger.debug(f"删除过期音频: {key}")
            except Exception as e:
                logger.error(f"删除失败 {key}: {e}")
        logger.info(f"批量删除完成: {deleted}/{len(keys)} 个文件")
        return deleted


# 全局 OSS 服务实例
oss_service = OSSService()
