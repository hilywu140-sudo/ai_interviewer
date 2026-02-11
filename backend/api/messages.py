from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from database import get_db
from models import Message
from schemas.message import MessageCreate, MessageResponse, MessageListResponse

router = APIRouter(prefix="/api/messages", tags=["messages"])


@router.get("", response_model=MessageListResponse)
def list_messages(
    session_id: UUID = Query(..., description="会话 ID（必填）"),
    limit: int = Query(20, ge=1, le=100, description="每页数量"),
    offset: int = Query(0, ge=0, description="偏移量"),
    order: str = Query("desc", regex="^(asc|desc)$", description="排序方式：desc=最新优先，asc=最早优先"),
    db: Session = Depends(get_db)
):
    """
    获取分页消息列表

    - order=desc: 最新消息优先（用于初始加载，获取最近的消息）
    - order=asc: 最早消息优先（用于加载更早的消息）
    """
    query = db.query(Message).filter(Message.session_id == session_id)

    # 获取总数
    total = query.count()

    # 应用排序和分页
    if order == "desc":
        query = query.order_by(Message.created_at.desc())
    else:
        query = query.order_by(Message.created_at.asc())

    messages = query.offset(offset).limit(limit).all()

    # 如果是 desc 排序，反转结果以返回时间顺序
    if order == "desc":
        messages = list(reversed(messages))

    return MessageListResponse(
        messages=messages,
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + limit < total
    )


@router.post("", response_model=MessageResponse)
def create_message(message: MessageCreate, db: Session = Depends(get_db)):
    """创建消息（用于非 WebSocket 场景）"""
    db_message = Message(**message.model_dump())
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message


@router.get("/{message_id}", response_model=MessageResponse)
def get_message(message_id: UUID, db: Session = Depends(get_db)):
    """获取单个消息"""
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    return message
