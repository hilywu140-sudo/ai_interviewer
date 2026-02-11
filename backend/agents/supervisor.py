"""
Supervisor (主Agent)

负责理解用户意图并路由到合适的SubAgent。
使用千问 8B 模型以提升响应速度。
"""

import json
import logging
from typing import Dict, Any, List

from .state import AgentState
from .prompts.supervisor import SUPERVISOR_SYSTEM_PROMPT, SUPERVISOR_ROUTING_PROMPT
from services.llm_service import LLMService

logger = logging.getLogger(__name__)

# Supervisor 专用的千问 LLM 实例
supervisor_llm = LLMService(provider="qwen")


class SupervisorAgent:
    """
    主Agent - 负责理解用户意图并路由到合适的SubAgent

    路由规则：
    1. 语音练习相关 → Interviewer SubAgent
    2. 面试辅助相关 → Chat SubAgent
    3. 与面试无关的问题 → 直接拒绝
    """

    async def route(self, state: AgentState) -> AgentState:
        """
        分析用户意图并决定路由

        Args:
            state: 当前状态

        Returns:
            更新后的状态，包含next_agent和可能的response
        """
        user_input = state.get("user_input", "")
        input_type = state.get("input_type", "text")
        current_mode = state.get("current_mode", "idle")
        current_question = state.get("current_question")

        # 如果是音频输入，直接路由到interviewer
        if input_type == "audio":
            logger.info("收到音频输入，路由到 interviewer")
            return {
                **state,
                "next_agent": "interviewer",
                "current_mode": "interviewing"
            }

        # 如果当前正在面试中且收到文本，也路由到interviewer
        if current_mode == "interviewing" and current_question:
            logger.info("当前在面试模式，继续路由到 interviewer")
            return {
                **state,
                "next_agent": "interviewer"
            }

        # 使用LLM判断意图
        try:
            routing_result = await self._analyze_intent(
                user_input=user_input,
                input_type=input_type,
                current_mode=current_mode,
                current_question=current_question,
                messages=state.get("messages", [])
            )

            next_agent = routing_result.get("next_agent", "end")
            response = routing_result.get("response")
            intent = routing_result.get("intent", "general")
            extracted_question = routing_result.get("extracted_question")

            logger.info(f"路由决策: intent={intent}, next_agent={next_agent}, extracted_question={extracted_question}")

            # 更新状态
            new_state = {
                **state,
                "next_agent": next_agent,
                "intent": intent,
                "extracted_question": extracted_question
            }

            # 如果是直接回复，设置response
            if next_agent == "end" and response:
                new_state["response_text"] = response
                new_state["response_type"] = "message"

            # 更新模式
            if next_agent == "interviewer":
                new_state["current_mode"] = "interviewing"
                # 如果提取到了问题，设置 current_question
                if extracted_question:
                    new_state["current_question"] = extracted_question
            elif next_agent == "chat":
                new_state["current_mode"] = "chatting"

            return new_state

        except Exception as e:
            logger.error(f"路由分析失败: {e}")
            # 出错时默认路由到chat
            return {
                **state,
                "next_agent": "chat",
                "current_mode": "chatting"
            }

    async def _analyze_intent(
        self,
        user_input: str,
        input_type: str,
        current_mode: str,
        current_question: str | None,
        messages: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        使用LLM分析用户意图

        Args:
            user_input: 用户输入
            input_type: 输入类型
            current_mode: 当前模式
            current_question: 当前问题
            messages: 对话历史

        Returns:
            包含intent, next_agent, extracted_question, response, reasoning的字典
        """
        # 格式化最近的对话历史
        recent_history = self._format_recent_history(messages[-6:]) if messages else "无"

        prompt = SUPERVISOR_ROUTING_PROMPT.format(
            user_input=user_input,
            input_type=input_type,
            current_mode=current_mode,
            current_question=current_question or "无",
            recent_history=recent_history
        )

        messages = [
            {"role": "system", "content": SUPERVISOR_SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ]

        response = await supervisor_llm.chat_completion(
            messages=messages,
            temperature=0.1  # 低温度，更确定性的输出
        )

        # 解析JSON响应
        try:
            # 尝试提取JSON
            response_text = response.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]

            result = json.loads(response_text.strip())
            return result
        except json.JSONDecodeError as e:
            logger.warning(f"JSON解析失败: {e}, response: {response}")
            # 返回默认值
            return {
                "intent": "general",
                "next_agent": "chat",
                "extracted_question": None,
                "response": None,
                "reasoning": "JSON解析失败，默认路由到chat"
            }

    def _format_recent_history(self, messages: List[Dict[str, Any]]) -> str:
        """
        格式化最近的对话历史

        Args:
            messages: 消息列表

        Returns:
            格式化后的历史字符串
        """
        if not messages:
            return "无"

        formatted = []
        for msg in messages:
            role = "用户" if msg.get("role") == "user" else "助手"
            content = msg.get("content", "")[:200]  # 截断长消息
            formatted.append(f"{role}: {content}")

        return "\n".join(formatted)


# 全局实例
supervisor_agent = SupervisorAgent()


async def supervisor_node(state: AgentState) -> AgentState:
    """
    LangGraph节点函数

    Args:
        state: 当前状态

    Returns:
        更新后的状态
    """
    return await supervisor_agent.route(state)
