from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from database import Base


class Asset(Base):
    __tablename__ = "assets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    question = Column(Text, nullable=False)
    transcript = Column(Text)  # 可编辑的逐字稿
    original_message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id"))
    tags = Column(JSON)
    star_structure = Column(JSON)
    version = Column(Integer, default=1)  # 版本号
    parent_asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id"))  # 父版本ID
    version_type = Column(String(20), default="recording")  # "recording" | "edited"
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
