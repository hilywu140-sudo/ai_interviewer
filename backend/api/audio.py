"""
音频处理API

提供音频上传、ASR转录等功能的REST API端点。
"""

import os
import base64
import logging
from uuid import UUID
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session

from database import get_db
from models import AudioFile, Session as SessionModel, Project
from schemas.audio import (
    AudioUploadResponse,
    TranscribeRequest,
    TranscribeResponse,
    ASRStatus
)
from services.asr_service import asr_service, build_context_text
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/audio", tags=["audio"])


def ensure_audio_storage_dir():
    """确保音频存储目录存在"""
    os.makedirs(settings.audio_storage_path, exist_ok=True)


@router.post("/upload", response_model=AudioUploadResponse)
async def upload_audio(
    session_id: UUID = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    上传音频文件

    支持的格式：PCM, WAV, MP3, WebM
    音频将保存到本地存储，并创建AudioFile记录。
    """
    # 验证session存在
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # 验证文件格式
    allowed_extensions = {".pcm", ".wav", ".mp3", ".webm"}
    file_ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的音频格式。支持的格式: {', '.join(allowed_extensions)}"
        )

    # 确保存储目录存在
    ensure_audio_storage_dir()

    # 生成文件路径
    import uuid as uuid_module
    file_id = uuid_module.uuid4()
    file_name = f"{session_id}_{file_id}{file_ext}"
    file_path = os.path.join(settings.audio_storage_path, file_name)

    # 保存文件
    content = await file.read()
    file_size = len(content)

    with open(file_path, "wb") as f:
        f.write(content)

    # 创建数据库记录
    audio_file = AudioFile(
        id=file_id,
        session_id=session_id,
        file_path=file_path,
        file_size=file_size,
        format=file_ext.lstrip("."),
        asr_status=ASRStatus.PENDING.value
    )
    db.add(audio_file)
    db.commit()
    db.refresh(audio_file)

    logger.info(f"音频文件上传成功: {file_path}, size={file_size}")

    return audio_file


@router.post("/upload-base64", response_model=AudioUploadResponse)
async def upload_audio_base64(
    session_id: UUID,
    audio_data: str,
    format: str = "pcm",
    db: Session = Depends(get_db)
):
    """
    上传Base64编码的音频数据

    适用于WebSocket场景，前端直接发送base64编码的音频。
    """
    # 验证session存在
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # 解码音频数据
    try:
        audio_bytes = base64.b64decode(audio_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"无效的Base64数据: {e}")

    # 确保存储目录存在
    ensure_audio_storage_dir()

    # 生成文件路径
    import uuid as uuid_module
    file_id = uuid_module.uuid4()
    file_name = f"{session_id}_{file_id}.{format}"
    file_path = os.path.join(settings.audio_storage_path, file_name)

    # 保存文件
    with open(file_path, "wb") as f:
        f.write(audio_bytes)

    # 创建数据库记录
    audio_file = AudioFile(
        id=file_id,
        session_id=session_id,
        file_path=file_path,
        file_size=len(audio_bytes),
        format=format,
        asr_status=ASRStatus.PENDING.value
    )
    db.add(audio_file)
    db.commit()
    db.refresh(audio_file)

    logger.info(f"Base64音频上传成功: {file_path}, size={len(audio_bytes)}")

    return audio_file


@router.post("/{audio_id}/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(
    audio_id: UUID,
    context_text: Optional[str] = None,
    language: str = "zh",
    db: Session = Depends(get_db)
):
    """
    触发ASR转录

    Args:
        audio_id: 音频文件ID
        context_text: 上下文文本（可选，用于增强识别）
        language: 语言代码，默认中文
    """
    # 获取音频文件记录
    audio_file = db.query(AudioFile).filter(AudioFile.id == audio_id).first()
    if not audio_file:
        raise HTTPException(status_code=404, detail="Audio file not found")

    # 检查文件是否存在
    if not os.path.exists(audio_file.file_path):
        raise HTTPException(status_code=404, detail="Audio file not found on disk")

    # 更新状态为处理中
    audio_file.asr_status = ASRStatus.PROCESSING.value
    db.commit()

    try:
        # 如果没有提供上下文，尝试从session关联的project获取
        if not context_text:
            session = db.query(SessionModel).filter(
                SessionModel.id == audio_file.session_id
            ).first()
            if session and session.project_id:
                project = db.query(Project).filter(
                    Project.id == session.project_id
                ).first()
                if project:
                    context_text = build_context_text(
                        resume_text=project.resume_text,
                        jd_text=project.jd_text
                    )

        # 调用ASR服务
        result = await asr_service.transcribe_audio(
            audio_path=audio_file.file_path,
            context_text=context_text,
            language=language
        )

        # 更新数据库记录
        audio_file.asr_status = ASRStatus.COMPLETED.value
        audio_file.asr_result = {
            "transcript": result.transcript,
            "segments": result.segments,
            "emotions": result.emotions,
            "duration": result.duration
        }
        db.commit()

        logger.info(f"ASR转录完成: audio_id={audio_id}, transcript_len={len(result.transcript)}")

        return TranscribeResponse(
            audio_id=audio_id,
            transcript=result.transcript,
            segments=result.segments,
            emotions=result.emotions,
            duration=result.duration,
            status=ASRStatus.COMPLETED.value
        )

    except Exception as e:
        # 更新状态为失败
        audio_file.asr_status = ASRStatus.FAILED.value
        audio_file.asr_result = {"error": str(e)}
        db.commit()

        logger.error(f"ASR转录失败: audio_id={audio_id}, error={e}")
        raise HTTPException(status_code=500, detail=f"ASR转录失败: {e}")


@router.get("/{audio_id}/status")
async def get_audio_status(audio_id: UUID, db: Session = Depends(get_db)):
    """查询音频转录状态"""
    audio_file = db.query(AudioFile).filter(AudioFile.id == audio_id).first()
    if not audio_file:
        raise HTTPException(status_code=404, detail="Audio file not found")

    return {
        "audio_id": audio_id,
        "status": audio_file.asr_status,
        "created_at": audio_file.created_at
    }


@router.get("/{audio_id}/result", response_model=TranscribeResponse)
async def get_transcribe_result(audio_id: UUID, db: Session = Depends(get_db)):
    """获取转录结果"""
    audio_file = db.query(AudioFile).filter(AudioFile.id == audio_id).first()
    if not audio_file:
        raise HTTPException(status_code=404, detail="Audio file not found")

    if audio_file.asr_status != ASRStatus.COMPLETED.value:
        raise HTTPException(
            status_code=400,
            detail=f"转录尚未完成，当前状态: {audio_file.asr_status}"
        )

    asr_result = audio_file.asr_result or {}

    return TranscribeResponse(
        audio_id=audio_id,
        transcript=asr_result.get("transcript", ""),
        segments=asr_result.get("segments", []),
        emotions=asr_result.get("emotions", []),
        duration=asr_result.get("duration", 0.0),
        status=audio_file.asr_status
    )


@router.delete("/{audio_id}")
async def delete_audio(audio_id: UUID, db: Session = Depends(get_db)):
    """删除音频文件"""
    audio_file = db.query(AudioFile).filter(AudioFile.id == audio_id).first()
    if not audio_file:
        raise HTTPException(status_code=404, detail="Audio file not found")

    # 删除物理文件
    if os.path.exists(audio_file.file_path):
        os.remove(audio_file.file_path)

    # 删除数据库记录
    db.delete(audio_file)
    db.commit()

    logger.info(f"音频文件删除成功: audio_id={audio_id}")

    return {"message": "Audio file deleted successfully"}


@router.get("/{audio_id}/url")
async def get_audio_url(
    audio_id: UUID,
    expires_in: int = Query(3600, ge=60, le=86400, description="URL 有效期（秒），默认 1 小时，最长 24 小时"),
    db: Session = Depends(get_db)
):
    """
    获取音频文件的签名 URL（用于回放）

    返回一个有时效的 OSS 签名 URL，客户端可以直接用于音频播放。
    """
    audio_file = db.query(AudioFile).filter(AudioFile.id == audio_id).first()
    if not audio_file:
        raise HTTPException(status_code=404, detail="Audio file not found")

    if not audio_file.oss_key:
        raise HTTPException(status_code=404, detail="Audio not available in OSS")

    # 生成签名 URL
    from services.oss_service import oss_service
    try:
        signed_url = oss_service.get_signed_url(audio_file.oss_key, expires_in)
    except Exception as e:
        logger.error(f"生成签名 URL 失败: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate signed URL: {e}")

    return {
        "audio_id": str(audio_id),
        "url": signed_url,
        "expires_in": expires_in
    }


@router.post("/cleanup")
async def trigger_cleanup(
    batch_size: int = Query(100, ge=1, le=1000, description="每批处理数量"),
    db: Session = Depends(get_db)
):
    """
    手动触发清理过期音频文件

    可由 cron job 定期调用，删除超过保留期限的音频文件。
    """
    from services.cleanup_service import cleanup_service

    result = cleanup_service.cleanup_expired_audio(db, batch_size)
    return result
