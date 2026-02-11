from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from database import Base


class AudioFile(Base):
    __tablename__ = "audio_files"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer)
    duration_seconds = Column(Float)
    format = Column(String(20))
    asr_status = Column(String(50), default="pending")
    asr_result = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # OSS 持久化存储字段
    oss_key = Column(String(500))           # OSS 对象 key
    oss_url = Column(String(1000))          # OSS 基础 URL（不含签名）
    expires_at = Column(DateTime(timezone=True))  # 过期时间（用于定期清理）
