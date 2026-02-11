"""
音频清理服务

定期清理过期的音频文件，释放 OSS 存储空间。
"""

import logging
from datetime import datetime
from typing import Dict, Any

from sqlalchemy.orm import Session

from models.audio_file import AudioFile
from services.oss_service import oss_service

logger = logging.getLogger(__name__)


class CleanupService:
    """
    音频清理服务

    负责清理超过保留期限的音频文件。
    """

    def cleanup_expired_audio(self, db: Session, batch_size: int = 100) -> Dict[str, Any]:
        """
        删除过期的音频文件

        Args:
            db: 数据库会话
            batch_size: 每批处理的文件数量

        Returns:
            dict: 清理统计信息
        """
        now = datetime.utcnow()

        # 查找过期的音频文件（有 oss_key 且已过期）
        expired_files = db.query(AudioFile).filter(
            AudioFile.expires_at < now,
            AudioFile.oss_key.isnot(None)
        ).limit(batch_size).all()

        if not expired_files:
            logger.info("没有需要清理的过期音频文件")
            return {
                "deleted": 0,
                "failed": 0,
                "total_processed": 0,
                "message": "No expired files"
            }

        # 收集 OSS keys
        oss_keys = [f.oss_key for f in expired_files if f.oss_key]

        # 从 OSS 删除文件
        deleted_count = oss_service.delete_expired_audio(oss_keys)

        # 更新数据库记录（清除 OSS 信息，保留记录用于历史查询）
        for audio_file in expired_files:
            audio_file.oss_key = None
            audio_file.oss_url = None

        db.commit()

        logger.info(f"清理完成: 删除 {deleted_count}/{len(expired_files)} 个过期音频文件")

        return {
            "deleted": deleted_count,
            "failed": len(expired_files) - deleted_count,
            "total_processed": len(expired_files),
            "message": f"Cleaned up {deleted_count} expired audio files"
        }

    def cleanup_orphaned_audio(self, db: Session, batch_size: int = 100) -> Dict[str, Any]:
        """
        清理孤立的音频文件（没有关联消息的音频）

        Args:
            db: 数据库会话
            batch_size: 每批处理的文件数量

        Returns:
            dict: 清理统计信息
        """
        from models.message import Message

        # 查找没有关联消息的音频文件
        orphaned_files = db.query(AudioFile).outerjoin(
            Message, AudioFile.id == Message.audio_file_id
        ).filter(
            Message.id.is_(None),
            AudioFile.oss_key.isnot(None)
        ).limit(batch_size).all()

        if not orphaned_files:
            return {
                "deleted": 0,
                "total_processed": 0,
                "message": "No orphaned files"
            }

        # 收集 OSS keys
        oss_keys = [f.oss_key for f in orphaned_files if f.oss_key]

        # 从 OSS 删除文件
        deleted_count = oss_service.delete_expired_audio(oss_keys)

        # 删除数据库记录
        for audio_file in orphaned_files:
            db.delete(audio_file)

        db.commit()

        logger.info(f"清理孤立音频完成: 删除 {deleted_count} 个文件")

        return {
            "deleted": deleted_count,
            "total_processed": len(orphaned_files),
            "message": f"Cleaned up {deleted_count} orphaned audio files"
        }


# 全局清理服务实例
cleanup_service = CleanupService()
