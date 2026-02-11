from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from database import Base


class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(50), nullable=False)
    content = Column(Text, nullable=False)
    message_type = Column(String(50))

    # For user answers
    audio_file_id = Column(UUID(as_uuid=True), ForeignKey("audio_files.id"))
    transcript = Column(Text)
    chunks = Column(JSON)

    # For feedback
    feedback = Column(JSON)

    # For rewrites
    original_answer_id = Column(UUID(as_uuid=True), ForeignKey("messages.id"))

    meta = Column(JSON)  # 改名为 meta，避免与 SQLAlchemy 的 metadata 冲突
    created_at = Column(DateTime(timezone=True), server_default=func.now())
