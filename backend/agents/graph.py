"""
LangGraph 图定义

定义面试助手的状态机流程图，集成 LangSmith 追踪。
"""

import logging
from typing import Literal
from uuid import uuid4

from langgraph.graph import StateGraph, END

from .state import AgentState
from .supervisor import supervisor_node
from .subagents.interviewer import interviewer_node
from .subagents.chat import chat_node

# LangSmith 追踪
try:
    from langsmith.run_helpers import get_current_run_tree
    LANGSMITH_AVAILABLE = True
except ImportError:
    LANGSMITH_AVAILABLE = False
    get_current_run_tree = None

logger = logging.getLogger(__name__)

# 全局图实例缓存
_graph_instance = None
_tracing_initialized = False


def route_to_subagent(state: AgentState) -> Literal["interviewer", "chat", "end"]:
    """
    路由函数：根据state中的next_agent决定下一个节点

    Args:
        state: 当前状态

    Returns:
        下一个节点的名称
    """
    next_agent = state.get("next_agent", "end")
    logger.debug(f"路由决策: next_agent={next_agent}")

    if next_agent == "interviewer":
        return "interviewer"
    elif next_agent == "chat":
        return "chat"
    else:
        return "end"


def should_continue(state: AgentState) -> Literal["supervisor", "end"]:
    """
    判断SubAgent完成后是否需要继续

    当前设计：SubAgent完成后直接结束，不回到supervisor
    未来可以扩展为多轮对话

    Args:
        state: 当前状态

    Returns:
        下一个节点的名称
    """
    # 当前设计：SubAgent完成后直接结束
    return "end"


def _init_tracing():
    """初始化 LangSmith 追踪"""
    global _tracing_initialized
    if _tracing_initialized:
        return

    try:
        from services.langsmith_tracing import setup_langsmith_tracing
        setup_langsmith_tracing()
        _tracing_initialized = True
    except Exception as e:
        logger.warning(f"LangSmith 追踪初始化失败: {e}")


def create_interview_graph() -> StateGraph:
    """
    创建面试助手的LangGraph

    流程：
    1. supervisor 分析用户意图
    2. 根据意图路由到 interviewer 或 chat
    3. SubAgent 处理完成后结束

    Returns:
        编译后的StateGraph
    """
    # 初始化 LangSmith 追踪
    _init_tracing()

    # 创建图
    graph = StateGraph(AgentState)

    # 添加节点
    graph.add_node("supervisor", supervisor_node)
    graph.add_node("interviewer", interviewer_node)
    graph.add_node("chat", chat_node)

    # 设置入口点
    graph.set_entry_point("supervisor")

    # 添加条件边：从supervisor路由到不同的SubAgent
    graph.add_conditional_edges(
        "supervisor",
        route_to_subagent,
        {
            "interviewer": "interviewer",
            "chat": "chat",
            "end": END
        }
    )

    # SubAgent完成后的路由
    # 当前设计：直接结束
    graph.add_conditional_edges(
        "interviewer",
        should_continue,
        {
            "supervisor": "supervisor",
            "end": END
        }
    )

    graph.add_conditional_edges(
        "chat",
        should_continue,
        {
            "supervisor": "supervisor",
            "end": END
        }
    )

    # 编译图（不使用状态持久化，避免旧状态干扰）
    # 会话历史已由 ContextManager 管理
    compiled_graph = graph.compile()

    logger.info("LangGraph 面试助手图已创建")
    return compiled_graph


def get_interview_graph() -> StateGraph:
    """
    获取面试助手图的单例实例

    Returns:
        编译后的StateGraph
    """
    global _graph_instance
    if _graph_instance is None:
        _graph_instance = create_interview_graph()
    return _graph_instance


async def process_message(
    session_id: str,
    user_input: str,
    input_type: str = "text",
    audio_data: str | None = None,
    resume_text: str | None = None,
    jd_text: str | None = None,
    practice_questions: list | None = None,
    project_id: str | None = None,
    current_question: str | None = None,
    message_context: dict | None = None  # 消息上下文（用于逐字稿修改）
) -> dict:
    """
    处理用户消息的便捷函数

    Args:
        session_id: 会话ID
        user_input: 用户输入
        input_type: 输入类型 (text/audio/command)
        audio_data: Base64编码的音频数据
        resume_text: 简历文本
        jd_text: 职位描述
        practice_questions: 练习问题列表
        project_id: 项目ID
        current_question: 当前练习的问题
        message_context: 消息上下文，包含 question, original_transcript, asset_id

    Returns:
        处理结果字典，包含response_text, response_type, response_metadata等
    """
    from services.context_manager import context_manager

    graph = get_interview_graph()

    # 获取历史消息和摘要
    history = context_manager.get_history(session_id)
    context_summary = context_manager.get_summary(session_id)

    # 构建输入状态
    # 如果有消息上下文，提取其中的问题和原始逐字稿
    context_question = message_context.get("question") if message_context else None
    context_original_transcript = message_context.get("original_transcript") if message_context else None
    context_asset_id = message_context.get("asset_id") if message_context else None

    input_state = {
        "session_id": session_id,
        "project_id": project_id,
        "resume_text": resume_text,
        "jd_text": jd_text,
        "practice_questions": practice_questions or [],
        "messages": [{"role": m.role, "content": m.content} for m in history],
        "user_input": user_input,
        "input_type": input_type,
        "current_mode": "idle",
        "current_question": current_question,
        "audio_data": audio_data,
        "transcript": None,
        "feedback": None,
        "next_agent": "supervisor",
        "response_text": None,
        "response_type": "message",
        "response_metadata": None,
        "context_summary": context_summary,
        "context_token_usage": None,
        # 消息上下文相关字段（用于逐字稿修改）
        "message_context": message_context,
        "context_question": context_question,
        "original_transcript": context_original_transcript,
        "context_asset_id": context_asset_id
    }

    # 生成唯一的运行ID用于追踪
    run_id = str(uuid4())

    # 配置（用于状态持久化和追踪）
    config = {
        "configurable": {
            "thread_id": session_id
        },
        # LangSmith 追踪元数据
        "metadata": {
            "session_id": session_id,
            "project_id": project_id,
            "input_type": input_type,
            "user_input_preview": user_input[:100] if user_input else "",
            "has_audio": audio_data is not None,
            "history_count": len(history)
        },
        "run_id": run_id,
        "run_name": f"interview_session_{session_id[:8]}"
    }

    # 执行图
    result = None
    langsmith_trace_id = None
    langsmith_parent_run_id = None

    try:
        async for event in graph.astream(input_state, config):
            # 尝试获取当前的 LangSmith run tree
            if LANGSMITH_AVAILABLE and langsmith_trace_id is None:
                try:
                    current_run = get_current_run_tree()
                    if current_run:
                        langsmith_trace_id = str(current_run.trace_id) if current_run.trace_id else None
                        langsmith_parent_run_id = str(current_run.id) if current_run.id else None
                        logger.debug(f"获取到 LangSmith trace_id: {langsmith_trace_id}, parent_run_id: {langsmith_parent_run_id}")
                except Exception as e:
                    logger.debug(f"获取 LangSmith run tree 失败: {e}")

            # 获取最后一个事件的状态
            for node_name, node_state in event.items():
                result = node_state
                logger.debug(f"节点 {node_name} 执行完成")
                # 调试：检查 audio_file_id 是否在状态中
                if node_state.get("audio_file_id"):
                    logger.info(f"节点 {node_name} 返回 audio_file_id: {node_state.get('audio_file_id')}")
    except Exception as e:
        logger.error(f"LangGraph 执行错误: {e}")
        return {
            "response_text": f"处理失败: {str(e)}",
            "response_type": "error",
            "response_metadata": None
        }

    if result is None:
        return {
            "response_text": "处理失败，请重试。",
            "response_type": "error",
            "response_metadata": None
        }

    # 保存消息到历史
    context_manager.add_message(session_id, "user", user_input)
    if result.get("response_text"):
        context_manager.add_message(
            session_id,
            "assistant",
            result["response_text"],
            result.get("response_type")
        )

    # 调试：打印最终结果中的关键字段
    logger.info(f"process_message 最终结果: audio_file_id={result.get('audio_file_id')}, asset_id={result.get('asset_id')}, response_type={result.get('response_type')}")

    return {
        "response_text": result.get("response_text", ""),
        "response_type": result.get("response_type", "message"),
        "response_metadata": result.get("response_metadata"),
        "transcript": result.get("transcript"),
        "transcript_sentences": result.get("transcript_sentences"),  # 句子级时间戳
        "feedback": result.get("feedback"),
        "asset_id": result.get("asset_id"),  # 资产ID
        "audio_file_id": result.get("audio_file_id"),  # 音频文件ID
        "current_question": result.get("current_question"),
        "current_mode": result.get("current_mode"),
        "context_token_usage": result.get("context_token_usage"),
        # 流式输出相关字段
        "stream_enabled": result.get("stream_enabled", False),
        "save_asset": result.get("save_asset", False),
        "intent": result.get("intent"),
        "extracted_question": result.get("extracted_question"),
        "user_input": result.get("user_input"),
        "resume_text": result.get("resume_text"),
        "jd_text": result.get("jd_text"),
        "context_summary": result.get("context_summary"),
        # 消息上下文相关字段（用于逐字稿修改）
        "original_transcript": result.get("original_transcript"),
        "context_question": result.get("context_question"),
        "context_asset_id": result.get("context_asset_id"),
        # LangSmith trace context（用于流式输出时关联到同一个 trace）
        "langsmith_trace_id": langsmith_trace_id,
        "langsmith_parent_run_id": langsmith_parent_run_id
    }
