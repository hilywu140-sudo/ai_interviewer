"""
音频相关的Pydantic模型

用于音频上传、ASR转录、语音练习等功能的请求/响应模型。
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID
from enum import Enum


class AudioFormat(str, Enum):
    """支持的音频格式"""
    PCM = "pcm"
    WAV = "wav"
    MP3 = "mp3"
    WEBM = "webm"


class ASRStatus(str, Enum):
    """ASR转录状态"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


# ============ 音频上传相关 ============

class AudioUploadResponse(BaseModel):
    """音频上传响应"""
    id: UUID
    file_path: str
    file_size: int
    duration_seconds: Optional[float] = None
    format: str
    asr_status: str = "pending"
    created_at: datetime

    class Config:
        from_attributes = True


# ============ ASR转录相关 ============

class TranscribeRequest(BaseModel):
    """ASR转录请求"""
    audio_id: UUID
    context_text: Optional[str] = Field(
        None,
        description="上下文文本，用于增强识别（如简历+JD）"
    )
    language: str = Field(
        default="zh",
        description="语言代码"
    )


class TranscribeResponse(BaseModel):
    """ASR转录响应"""
    audio_id: UUID
    transcript: str
    segments: List[Dict[str, Any]] = []
    emotions: List[Dict[str, Any]] = []
    duration: float = 0.0
    status: str


# ============ 语音练习相关 ============

class PracticeFeedback(BaseModel):
    """语音练习反馈结果"""
    analysis: str = Field(default="", description="有理有据的文字分析")
    overall_score: int = Field(ge=0, le=100)
    strengths: List[str] = []
    improvements: List[str] = []
    suggested_answer: Optional[str] = None


class VoicePracticeRequest(BaseModel):
    """语音练习请求（WebSocket消息）"""
    question: str = Field(..., description="要练习的面试问题")
    session_id: UUID


class VoicePracticeResult(BaseModel):
    """语音练习结果"""
    question: str
    transcript: str
    feedback: PracticeFeedback
    emotions: List[Dict[str, Any]] = []
    audio_id: Optional[UUID] = None


# ============ WebSocket消息类型 ============

class WSMessageType(str, Enum):
    """WebSocket消息类型"""
    # 客户端 → 服务器
    USER_MESSAGE = "user_message"
    START_VOICE_PRACTICE = "start_voice_practice"
    SUBMIT_AUDIO = "submit_audio"
    CANCEL_PRACTICE = "cancel_practice"

    # 服务器 → 客户端
    ASSISTANT_MESSAGE = "assistant_message"
    TRANSCRIPTION_PROGRESS = "transcription_progress"
    PRACTICE_RESULT = "practice_result"
    ERROR = "error"


class WSMessage(BaseModel):
    """WebSocket消息基类"""
    type: str
    timestamp: Optional[datetime] = None


class WSStartVoicePractice(WSMessage):
    """开始语音练习消息"""
    type: str = WSMessageType.START_VOICE_PRACTICE
    question: str


class WSSubmitAudio(WSMessage):
    """提交音频消息"""
    type: str = WSMessageType.SUBMIT_AUDIO
    audio_data: str  # base64编码的PCM音频


class WSTranscriptionProgress(WSMessage):
    """转录进度消息"""
    type: str = WSMessageType.TRANSCRIPTION_PROGRESS
    text: str
    is_final: bool = False


class WSPracticeResult(WSMessage):
    """练习结果消息"""
    type: str = WSMessageType.PRACTICE_RESULT
    transcript: str
    feedback: PracticeFeedback
    emotions: List[Dict[str, Any]] = []


class WSAssistantMessage(WSMessage):
    """助手消息"""
    type: str = WSMessageType.ASSISTANT_MESSAGE
    content: str
    action: Optional[str] = None  # 可选动作指令，如 "start_recording"
    message_id: Optional[UUID] = None
    metadata: Optional[Dict[str, Any]] = None


class WSError(WSMessage):
    """错误消息"""
    type: str = WSMessageType.ERROR
    error: str
    code: Optional[str] = None
