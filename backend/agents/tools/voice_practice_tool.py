"""
语音练习工具

供主Agent调用的工具，用于启动语音练习模式。
当用户想要用语音练习回答面试问题时，Agent会调用此工具。
"""

import logging
from typing import Optional, Dict, Any, TYPE_CHECKING
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


class VoicePracticeInput(BaseModel):
    """语音练习工具的输入参数"""
    question: str = Field(description="要练习的面试问题")
    session_id: str = Field(description="当前会话ID")


class VoicePracticeOutput(BaseModel):
    """语音练习工具的输出"""
    status: str = Field(description="状态: waiting_audio, completed, error")
    question: str = Field(description="练习的问题")
    instructions: Optional[str] = Field(None, description="给用户的指示")
    transcript: Optional[str] = Field(None, description="转录文本")
    feedback: Optional[Dict[str, Any]] = Field(None, description="STAR分析反馈")
    error: Optional[str] = Field(None, description="错误信息")


class VoicePracticeTool:
    """
    语音练习工具 - 让用户通过语音回答面试问题并获得反馈

    触发场景:
    - 用户说"我想练习这道题"
    - 用户说"开始模拟面试"
    - 用户说"用语音回答"
    - 用户点击UI上的"开始模拟"按钮

    工作流程:
    1. 接收问题和session_id
    2. 返回"waiting_audio"状态，通知前端开始录音
    3. 前端录音完成后，通过WebSocket提交音频
    4. 后端处理音频：ASR转录 → STAR分析
    5. 返回完整的练习结果
    """

    name = "voice_practice"
    description = """
    启动语音练习模式。当用户想要用语音练习回答面试问题时使用此工具。

    使用场景：
    - 用户说"我想练习这道题"
    - 用户说"开始模拟"或"开始练习"
    - 用户说"用语音回答"
    - 用户想要进行模拟面试练习

    工具会：
    1) 提示用户开始录音
    2) 等待用户提交语音回答
    3) 转录语音内容
    4) 使用STAR框架分析回答
    5) 返回详细反馈和改进建议
    """

    def __init__(self):
        self._pending_sessions: Dict[str, Dict[str, Any]] = {}

    def get_tool_definition(self) -> Dict[str, Any]:
        """获取LangChain工具定义格式"""
        return {
            "name": self.name,
            "description": self.description,
            "parameters": {
                "type": "object",
                "properties": {
                    "question": {
                        "type": "string",
                        "description": "要练习的面试问题"
                    },
                    "session_id": {
                        "type": "string",
                        "description": "当前会话ID"
                    }
                },
                "required": ["question", "session_id"]
            }
        }

    async def start_practice(
        self,
        question: str,
        session_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> VoicePracticeOutput:
        """
        启动语音练习

        这是第一阶段：通知前端开始录音。
        实际的音频处理在 process_audio 方法中完成。

        Args:
            question: 要练习的面试问题
            session_id: 会话ID
            context: 可选的上下文信息（简历、JD等）

        Returns:
            VoicePracticeOutput: 包含状态和指示
        """
        logger.info(f"启动语音练习: session={session_id}, question={question[:50]}...")

        # 保存待处理的练习会话
        self._pending_sessions[session_id] = {
            "question": question,
            "context": context,
            "status": "waiting_audio",
            "created_at": datetime.now().isoformat()
        }

        return VoicePracticeOutput(
            status="waiting_audio",
            question=question,
            instructions="请开始录音回答问题。录音完成后点击停止按钮提交。"
        )

    async def process_audio(
        self,
        session_id: str,
        audio_data: bytes,
        db: "Session"
    ) -> VoicePracticeOutput:
        """
        处理提交的音频

        这是第二阶段：接收音频后进行ASR转录和STAR分析。

        Args:
            session_id: 会话ID
            audio_data: PCM音频数据
            db: 数据库会话

        Returns:
            VoicePracticeOutput: 包含转录和反馈结果
        """
        from services.asr_service import asr_service, build_context_text
        from agents.analyzer_agent import analyzer_agent

        # 获取待处理的练习信息
        practice_info = self._pending_sessions.get(session_id)
        if not practice_info:
            return VoicePracticeOutput(
                status="error",
                question="",
                error="未找到对应的练习会话，请重新开始"
            )

        question = practice_info["question"]
        context = practice_info.get("context", {})

        try:
            # 构建上下文文本
            context_text = build_context_text(
                resume_text=context.get("resume_text"),
                jd_text=context.get("jd_text"),
                question=question
            )

            # ASR转录
            logger.info(f"开始ASR转录: session={session_id}")
            asr_result = await asr_service.transcribe_audio_bytes(
                audio_data=audio_data,
                context_text=context_text,
                language="zh"
            )

            transcript = asr_result.transcript
            if not transcript:
                return VoicePracticeOutput(
                    status="error",
                    question=question,
                    error="未能识别到语音内容，请重新录音"
                )

            logger.info(f"ASR转录完成: {transcript[:100]}...")

            # STAR分析
            logger.info(f"开始STAR分析: session={session_id}")
            feedback = await analyzer_agent.analyze(
                question=question,
                answer_transcript=transcript,
                resume_text=context.get("resume_text", ""),
                jd_text=context.get("jd_text", "")
            )

            # 清理待处理会话
            del self._pending_sessions[session_id]

            return VoicePracticeOutput(
                status="completed",
                question=question,
                transcript=transcript,
                feedback=feedback
            )

        except Exception as e:
            logger.error(f"语音练习处理失败: {e}")
            return VoicePracticeOutput(
                status="error",
                question=question,
                error=f"处理失败: {str(e)}"
            )

    def is_waiting_audio(self, session_id: str) -> bool:
        """检查会话是否在等待音频"""
        return session_id in self._pending_sessions

    def get_pending_question(self, session_id: str) -> Optional[str]:
        """获取待处理的问题"""
        practice_info = self._pending_sessions.get(session_id)
        return practice_info["question"] if practice_info else None

    def cancel_practice(self, session_id: str) -> bool:
        """取消练习"""
        if session_id in self._pending_sessions:
            del self._pending_sessions[session_id]
            logger.info(f"取消语音练习: session={session_id}")
            return True
        return False


# 全局工具实例
voice_practice_tool = VoicePracticeTool()
