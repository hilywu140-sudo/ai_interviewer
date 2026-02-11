from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID


class AssetCreate(BaseModel):
    """创建资产的请求模型"""
    project_id: UUID
    question: str
    transcript: Optional[str] = None
    original_message_id: Optional[UUID] = None
    tags: Optional[List[str]] = Field(default_factory=list)
    star_structure: Optional[Dict[str, Any]] = None
    parent_asset_id: Optional[UUID] = None
    version_type: str = "recording"  # "recording" | "edited"


class AssetUpdate(BaseModel):
    """更新资产的请求模型"""
    transcript: Optional[str] = None
    tags: Optional[List[str]] = None


class AssetResponse(BaseModel):
    """资产响应模型"""
    id: UUID
    project_id: UUID
    question: str
    transcript: Optional[str] = None
    original_message_id: Optional[UUID] = None
    tags: List[str] = Field(default_factory=list)
    star_structure: Optional[Dict[str, Any]] = None
    version: int
    parent_asset_id: Optional[UUID] = None
    version_type: str = "recording"  # "recording" | "edited"
    created_at: datetime
    updated_at: datetime

    @field_validator('tags', mode='before')
    @classmethod
    def tags_default(cls, v):
        """将 None 转换为空列表"""
        return v if v is not None else []

    class Config:
        from_attributes = True


class AssetListResponse(BaseModel):
    """资产列表响应模型"""
    assets: List[AssetResponse]
    total: int


class AssetConfirmSave(BaseModel):
    """确认保存资产的请求模型"""
    project_id: str
    question: str
    transcript: str
    message_id: Optional[str] = None  # 关联的消息ID（用于更新消息保存状态）
