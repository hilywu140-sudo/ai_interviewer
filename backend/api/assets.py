from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from database import get_db
from models.asset import Asset
from models import Project, User, Message
from schemas.asset import AssetCreate, AssetUpdate, AssetResponse, AssetListResponse, AssetConfirmSave
from dependencies.auth import get_current_user
from services.markdown_formatter import format_optimized_answer

router = APIRouter(prefix="/api/assets", tags=["assets"])


def verify_project_ownership(db: Session, project_id: UUID, user_id: UUID) -> Project:
    """验证项目所有权"""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == user_id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("", response_model=AssetResponse, status_code=201)
def create_asset(
    asset_data: AssetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """创建新资产"""
    # Verify project ownership
    verify_project_ownership(db, asset_data.project_id, current_user.id)

    # 处理 tags（确保是列表）
    tags_list = asset_data.tags if asset_data.tags else []

    asset = Asset(
        project_id=asset_data.project_id,
        question=asset_data.question,
        transcript=asset_data.transcript,
        original_message_id=asset_data.original_message_id,
        tags=tags_list,
        star_structure=asset_data.star_structure,
        parent_asset_id=asset_data.parent_asset_id,
        version=1  # 默认版本为1
    )

    # 如果有父版本，计算新版本号
    if asset_data.parent_asset_id:
        parent = db.query(Asset).filter(Asset.id == asset_data.parent_asset_id).first()
        if parent:
            asset.version = parent.version + 1

    db.add(asset)
    db.commit()
    db.refresh(asset)

    return asset


@router.get("", response_model=AssetListResponse)
def list_assets(
    project_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """列出资产（可按项目筛选）"""
    # Get all project IDs belonging to current user
    user_project_ids = db.query(Project.id).filter(
        Project.user_id == current_user.id
    ).all()
    user_project_ids = [p[0] for p in user_project_ids]

    query = db.query(Asset).filter(
        Asset.project_id.in_(user_project_ids)
    )

    if project_id:
        if project_id not in user_project_ids:
            raise HTTPException(status_code=404, detail="Project not found")
        query = query.filter(Asset.project_id == project_id)

    assets = query.order_by(Asset.created_at.desc()).all()

    return AssetListResponse(assets=assets, total=len(assets))


@router.get("/{asset_id}", response_model=AssetResponse)
def get_asset(
    asset_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取单个资产"""
    # Join with Project to verify ownership
    asset = db.query(Asset).join(Project).filter(
        Asset.id == asset_id,
        Project.user_id == current_user.id
    ).first()

    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    return asset


@router.put("/{asset_id}", response_model=AssetResponse)
def update_asset(
    asset_id: UUID,
    asset_data: AssetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """更新资产（编辑逐字稿、标签等）"""
    # Join with Project to verify ownership
    asset = db.query(Asset).join(Project).filter(
        Asset.id == asset_id,
        Project.user_id == current_user.id
    ).first()

    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # 更新字段
    if asset_data.transcript is not None:
        asset.transcript = asset_data.transcript
    if asset_data.tags is not None:
        asset.tags = asset_data.tags

    db.commit()
    db.refresh(asset)

    return asset


@router.delete("/{asset_id}", status_code=204)
def delete_asset(
    asset_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """删除资产"""
    # Join with Project to verify ownership
    asset = db.query(Asset).join(Project).filter(
        Asset.id == asset_id,
        Project.user_id == current_user.id
    ).first()

    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    db.delete(asset)
    db.commit()

    return None


@router.post("/confirm-save")
def confirm_save_asset(
    data: AssetConfirmSave,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """用户确认后保存 Asset"""
    # 验证项目所有权
    verify_project_ownership(db, UUID(data.project_id), current_user.id)

    # 格式化 transcript（优化答案/撰写逐字稿场景）
    formatted_transcript = format_optimized_answer(data.transcript) if data.transcript else ""

    # 创建新的 Asset 记录
    new_asset = Asset(
        project_id=UUID(data.project_id),
        question=data.question,
        transcript=formatted_transcript,
        version_type="edited"  # 标记为编辑版本
    )
    db.add(new_asset)
    db.commit()
    db.refresh(new_asset)

    # 如果提供了 message_id，更新对应消息的 meta.saved 状态
    if data.message_id:
        try:
            msg = db.query(Message).filter(Message.id == UUID(data.message_id)).first()
            if msg and msg.meta:
                updated_meta = dict(msg.meta)
                updated_meta["saved"] = True
                updated_meta["asset_id"] = str(new_asset.id)
                msg.meta = updated_meta
                db.commit()
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"更新消息保存状态失败: {e}")

    return {"asset_id": str(new_asset.id)}


@router.get("/{asset_id}/versions", response_model=List[AssetResponse])
def get_asset_versions(
    asset_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取资产的所有版本（按相同问题查找）"""
    # 获取当前资产，并验证所有权
    asset = db.query(Asset).join(Project).filter(
        Asset.id == asset_id,
        Project.user_id == current_user.id
    ).first()

    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # 按相同的 question 和 project_id 查找所有版本
    versions = db.query(Asset).filter(
        Asset.project_id == asset.project_id,
        Asset.question == asset.question
    ).order_by(Asset.created_at.asc()).all()

    # 重新计算版本号（按创建时间排序）
    for i, v in enumerate(versions):
        v.version = i + 1

    return versions
