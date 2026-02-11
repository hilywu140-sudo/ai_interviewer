"""
Agents 模块

基于 LangGraph 的多 Agent 架构：
- Supervisor: 主Agent，负责意图识别和路由
- Interviewer SubAgent: 面试官，负责语音练习全流程
- Chat SubAgent: 对话助手，负责答案优化、问题调研、简历优化
"""

from .state import AgentState, create_initial_state
from .graph import (
    create_interview_graph,
    get_interview_graph,
    process_message
)
from .supervisor import SupervisorAgent, supervisor_node
from .subagents import (
    InterviewerSubAgent,
    interviewer_node,
    ChatSubAgent,
    chat_node
)

__all__ = [
    # State
    "AgentState",
    "create_initial_state",
    # Graph
    "create_interview_graph",
    "get_interview_graph",
    "process_message",
    # Agents
    "SupervisorAgent",
    "supervisor_node",
    "InterviewerSubAgent",
    "interviewer_node",
    "ChatSubAgent",
    "chat_node",
]
