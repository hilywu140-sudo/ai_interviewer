from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID


class MessageCreate(BaseModel):
    session_id: UUID
    role: str
    content: str
    message_type: Optional[str] = None


class MessageResponse(BaseModel):
    id: UUID
    session_id: UUID
    role: str
    content: str
    message_type: Optional[str] = None

    # 音频相关
    audio_file_id: Optional[UUID] = None
    transcript: Optional[str] = None

    # 反馈相关
    feedback: Optional[Dict[str, Any]] = None

    # 元数据
    meta: Optional[Dict[str, Any]] = None

    created_at: datetime

    class Config:
        from_attributes = True


class MessageListResponse(BaseModel):
    """分页消息列表响应"""
    messages: List[MessageResponse]
    total: int
    limit: int
    offset: int
    has_more: bool
