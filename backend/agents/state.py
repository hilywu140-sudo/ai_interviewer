"""
LangGraph 状态定义

定义整个面试助手系统的状态结构，用于在各个Agent之间传递数据。
"""

from typing import TypedDict, List, Optional, Literal, Annotated, Any
from operator import add


class AgentState(TypedDict):
    """
    面试助手的全局状态

    状态在各个节点之间传递，每个节点可以读取和更新状态。
    """

    # === 会话上下文 ===
    session_id: str                              # 会话ID
    project_id: Optional[str]                    # 项目ID
    resume_text: Optional[str]                   # 简历文本
    jd_text: Optional[str]                       # 职位描述
    practice_questions: Optional[List[str]]      # 练习问题列表

    # === 对话历史 ===
    messages: Annotated[list, add]               # 消息累加器

    # === 当前输入 ===
    user_input: Optional[str]                    # 用户当前输入的文本
    input_type: Literal["text", "audio", "command"]  # 输入类型

    # === 当前状态 ===
    current_mode: Literal["idle", "interviewing", "chatting"]

    # === 面试相关 ===
    current_question: Optional[str]              # 当前练习的问题
    audio_data: Optional[str]                    # Base64音频数据
    transcript: Optional[str]                    # ASR转录结果
    transcript_sentences: Optional[List[dict]]   # ASR句子级时间戳
    feedback: Optional[dict]                     # STAR分析结果
    audio_file_id: Optional[str]                 # 音频文件ID（OSS持久化）
    asset_id: Optional[str]                      # 资产ID（优化答案）

    # === 意图路由 ===
    intent: Optional[Literal[
        "voice_practice",        # 语音练习
        "answer_optimization",   # 答案优化
        "question_research",     # 问题调研
        "resume_optimization",   # 简历优化
        "script_writing",        # 写逐字稿
        "general"                # 通用面试对话
    ]]
    extracted_question: Optional[str]  # 从用户输入提取的面试问题

    # === 消息上下文（用于逐字稿修改）===
    message_context: Optional[dict]           # 完整的消息上下文
    context_question: Optional[str]           # 上下文中的面试问题
    original_transcript: Optional[str]        # 原始逐字稿（用于优化参考）
    context_asset_id: Optional[str]           # 原始 Asset ID（用于版本关联）

    # === 路由控制 ===
    next_agent: Literal["supervisor", "interviewer", "chat", "end"]

    # === 响应输出 ===
    response_text: Optional[str]                 # 要返回给用户的文本
    response_type: Literal["message", "stream_message", "recording_start", "transcription", "feedback", "error"]
    response_metadata: Optional[dict]            # 额外的响应元数据

    # === 流式输出控制 ===
    stream_enabled: Optional[bool]               # 是否启用流式输出
    save_asset: Optional[bool]                   # 是否保存到 Asset

    # === 上下文管理 ===
    context_summary: Optional[str]               # 历史对话摘要
    context_token_usage: Optional[dict]          # Token 使用统计


def create_initial_state(
    session_id: str,
    project_id: Optional[str] = None,
    resume_text: Optional[str] = None,
    jd_text: Optional[str] = None,
    practice_questions: Optional[List[str]] = None
) -> AgentState:
    """
    创建初始状态

    Args:
        session_id: 会话ID
        project_id: 项目ID
        resume_text: 简历文本
        jd_text: 职位描述
        practice_questions: 练习问题列表

    Returns:
        初始化的AgentState
    """
    return AgentState(
        # 会话上下文
        session_id=session_id,
        project_id=project_id,
        resume_text=resume_text,
        jd_text=jd_text,
        practice_questions=practice_questions,
        # 对话历史
        messages=[],
        # 当前输入
        user_input=None,
        input_type="text",
        # 当前状态
        current_mode="idle",
        # 面试相关
        current_question=None,
        audio_data=None,
        transcript=None,
        transcript_sentences=None,
        feedback=None,
        audio_file_id=None,
        asset_id=None,
        # 意图路由
        intent=None,
        extracted_question=None,
        # 消息上下文（用于逐字稿修改）
        message_context=None,
        context_question=None,
        original_transcript=None,
        context_asset_id=None,
        # 路由控制
        next_agent="supervisor",
        # 响应输出
        response_text=None,
        response_type="message",
        response_metadata=None,
        # 流式输出控制
        stream_enabled=False,
        save_asset=False,
        # 上下文管理
        context_summary=None,
        context_token_usage=None
    )
