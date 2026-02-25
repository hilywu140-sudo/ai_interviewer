"""
Chat SubAgent (对话助手)

负责答案优化、问题调研、简历优化等面试相关的对话辅助。
支持流式输出。
"""

import logging
import re
from typing import Dict, Any, AsyncGenerator, Optional

from agents.state import AgentState
from agents.prompts.chat import (
    CHAT_SYSTEM_PROMPT,
    ANSWER_OPTIMIZATION_PROMPT,
    ANSWER_OPTIMIZATION_WITH_REFERENCE_PROMPT,
    QUESTION_RESEARCH_PROMPT,
    RESUME_OPTIMIZATION_PROMPT,
    SCRIPT_WRITING_PROMPT,
    INTERVIEW_CHAT_PROMPT
)
from services.llm_service import llm_service

logger = logging.getLogger(__name__)


def extract_optimized_answer(content: str) -> Optional[str]:
    """从 LLM 输出中提取优化内容（支持 optimized 和 script 标签）"""
    # 优先查找 <optimized> 标签（answer_optimization）
    match = re.search(r'<optimized>(.*?)</optimized>', content, re.DOTALL)
    if match:
        return match.group(1).strip()

    # 如果没有找到，尝试查找 <script> 标签（script_writing）
    match = re.search(r'<script>(.*?)</script>', content, re.DOTALL)
    if match:
        return match.group(1).strip()

    return None


def extract_question_from_content(content: str) -> Optional[str]:
    """从 LLM 输出中提取问题（用于保存 Asset）"""
    # 尝试从 analysis 标签中提取问题相关信息
    # 这里简单返回 None，实际问题应该从 state 中获取
    return None


class ChatSubAgent:
    """
    对话SubAgent - 负责面试相关的对话辅助

    功能：
    1. 答案优化：根据STAR框架优化用户的回答
    2. 问题调研：分析面试问题，提供回答思路和要点
    3. 简历优化：根据JD优化简历内容

    限制：
    - 只回答与面试相关的问题
    - 拒绝回答无关话题
    """

    async def process(self, state: AgentState) -> AgentState:
        """
        处理对话请求

        注意：此方法不调用 LLM，只设置流式输出标志。
        实际的 LLM 调用由 WebSocket 层通过 get_stream_generator() 进行。

        Args:
            state: 当前状态

        Returns:
            更新后的状态
        """
        user_input = state.get("user_input", "")
        resume_text = state.get("resume_text", "")

        # 从 Supervisor 获取 intent 和 extracted_question
        intent = state.get("intent", "interview_chat")
        extracted_question = state.get("extracted_question")

        # 验证 intent
        valid_intents = ["answer_optimization", "question_research", "resume_optimization", "script_writing", "interview_chat"]
        if intent not in valid_intents:
            logger.warning(f"Unexpected intent '{intent}', falling back to 'interview_chat'")
            intent = "interview_chat"

        # 简历优化需要检查是否有简历
        if intent == "resume_optimization" and not resume_text:
            # 没有简历时直接返回提示，不使用流式
            return {
                **state,
                "response_text": "请先上传你的简历，我才能帮你进行优化。你可以在项目设置中上传简历文件。",
                "response_type": "message",
                "next_agent": "end",
                "stream_enabled": False,
                "save_asset": False,
                "intent": intent,
                "extracted_question": extracted_question
            }

        # 所有 Chat 场景都使用流式输出
        # process() 不调用 LLM，由 WebSocket 通过 get_stream_generator() 调用
        stream_enabled = True
        save_asset = (intent == "answer_optimization" or intent == "script_writing")

        logger.info(f"Chat SubAgent: intent={intent}, stream_enabled={stream_enabled}, save_asset={save_asset}")

        return {
            **state,
            "response_text": "",  # 流式输出时不预先生成响应
            "response_type": "stream_message",
            "next_agent": "end",
            "stream_enabled": stream_enabled,
            "save_asset": save_asset,
            "intent": intent,
            "extracted_question": extracted_question
        }

    def _fallback_extract_question(self, user_input: str) -> str | None:
        """
        兜底的问题提取方法

        当 Supervisor 未能提取问题时使用

        Args:
            user_input: 用户输入

        Returns:
            提取的问题或 None
        """
        for prefix in ["怎么回答", "如何回答", "分析一下", "这个问题"]:
            if prefix in user_input:
                return user_input.split(prefix)[-1].strip().strip("：:？?")
        return None

    async def _optimize_answer(
        self,
        user_input: str,
        resume_text: str,
        jd_text: str,
        previous_feedback: Dict[str, Any] | None,
        extracted_question: str | None
    ) -> str:
        """优化面试回答"""
        # 优先使用 Supervisor 提取的问题，否则尝试从输入中解析
        question = extracted_question
        answer = user_input

        if not question:
            # 兜底：尝试从用户输入中提取问题和答案
            # 格式可能是: "帮我优化这个回答：问题是xxx，我的回答是xxx"
            if "问题" in user_input and "回答" in user_input:
                parts = user_input.split("回答")
                if len(parts) >= 2:
                    question_part = parts[0]
                    answer = parts[1].strip()
                    if "问题" in question_part:
                        question = question_part.split("问题")[-1].strip().strip("：:是")

        prompt = ANSWER_OPTIMIZATION_PROMPT.format(
            question=question or "（用户未指定具体问题）",
            original_answer=answer,
            resume_text=resume_text if resume_text else "无",
            jd_text=jd_text if jd_text else "无"
        )

        system_prompt = CHAT_SYSTEM_PROMPT

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ]

        return await llm_service.chat_completion(messages=messages, temperature=0.7)

    async def _research_question(
        self,
        user_input: str,
        resume_text: str,
        jd_text: str,
        extracted_question: str | None
    ) -> str:
        """分析面试问题"""
        # 优先使用 Supervisor 提取的问题
        question = extracted_question

        if not question:
            # 兜底：从用户输入中提取问题
            question = self._fallback_extract_question(user_input) or user_input

        prompt = QUESTION_RESEARCH_PROMPT.format(
            question=question,
            resume_text=resume_text if resume_text else "无",
            jd_text=jd_text if jd_text else "无"
        )

        system_prompt = CHAT_SYSTEM_PROMPT

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ]

        return await llm_service.chat_completion(messages=messages, temperature=0.7)

    async def _optimize_resume(
        self,
        user_input: str,
        resume_text: str,
        jd_text: str,
        extracted_question: str | None
    ) -> str:
        """优化简历"""
        if not resume_text:
            return "请先上传你的简历，我才能帮你进行优化。你可以在项目设置中上传简历文件。"

        prompt = RESUME_OPTIMIZATION_PROMPT.format(
            resume_text=resume_text,
            jd_text=jd_text if jd_text else "无",
            user_question=user_input
        )

        system_prompt = CHAT_SYSTEM_PROMPT

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ]

        return await llm_service.chat_completion(messages=messages, temperature=0.7)

    # ========== 流式输出方法 ==========

    async def get_stream_generator(
        self,
        state: AgentState
    ) -> AsyncGenerator[str, None]:
        """
        获取流式输出生成器

        Args:
            state: 当前状态

        Yields:
            LLM 输出的每个 token
        """
        user_input = state.get("user_input", "")
        resume_text = state.get("resume_text", "")
        jd_text = state.get("jd_text", "")
        feedback = state.get("feedback")
        intent = state.get("intent", "general")
        extracted_question = state.get("extracted_question")
        # 获取消息上下文中的原始逐字稿
        original_transcript = state.get("original_transcript")
        context_question = state.get("context_question")

        # 如果有上下文问题，优先使用上下文问题
        if context_question:
            extracted_question = context_question

        if intent == "answer_optimization":
            async for chunk in self._optimize_answer_stream(
                user_input, resume_text, jd_text, feedback, extracted_question, original_transcript
            ):
                yield chunk
        elif intent == "question_research":
            async for chunk in self._research_question_stream(
                user_input, resume_text, jd_text, extracted_question
            ):
                yield chunk
        elif intent == "resume_optimization":
            async for chunk in self._optimize_resume_stream(
                user_input, resume_text, jd_text, extracted_question
            ):
                yield chunk
        elif intent == "script_writing":
            async for chunk in self._write_script_stream(
                user_input, resume_text, jd_text, extracted_question
            ):
                yield chunk
        elif intent == "interview_chat":
            async for chunk in self._interview_chat_stream(
                user_input, resume_text, jd_text, state
            ):
                yield chunk

    async def _optimize_answer_stream(
        self,
        user_input: str,
        resume_text: str,
        jd_text: str,
        previous_feedback: Dict[str, Any] | None,
        extracted_question: str | None,
        original_transcript: str | None = None
    ) -> AsyncGenerator[str, None]:
        """流式优化面试回答

        Args:
            user_input: 用户输入（可能是修改后的逐字稿）
            resume_text: 简历文本
            jd_text: 职位描述
            previous_feedback: 之前的反馈
            extracted_question: 提取的面试问题
            original_transcript: 原始逐字稿（用于对比优化）
        """
        question = extracted_question
        answer = user_input

        if not question:
            if "问题" in user_input and "回答" in user_input:
                parts = user_input.split("回答")
                if len(parts) >= 2:
                    question_part = parts[0]
                    answer = parts[1].strip()
                    if "问题" in question_part:
                        question = question_part.split("问题")[-1].strip().strip("：:是")

        # 根据是否有原始逐字稿选择不同的 Prompt
        if original_transcript:
            # 有原始逐字稿，使用带参考的优化 Prompt
            prompt = ANSWER_OPTIMIZATION_WITH_REFERENCE_PROMPT.format(
                question=question or "（用户未指定具体问题）",
                original_transcript=original_transcript,
                user_edit=answer,
                resume_text=resume_text if resume_text else "无",
                jd_text=jd_text if jd_text else "无"
            )
            logger.info(f"使用带原始逐字稿参考的优化 Prompt，问题: {question}")
        else:
            # 没有原始逐字稿，使用普通优化 Prompt
            prompt = ANSWER_OPTIMIZATION_PROMPT.format(
                question=question or "（用户未指定具体问题）",
                original_answer=answer,
                resume_text=resume_text if resume_text else "无",
                jd_text=jd_text if jd_text else "无"
            )

        messages = [
            {"role": "system", "content": CHAT_SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ]

        async for chunk in llm_service.chat_completion_stream(messages=messages, temperature=0.7):
            yield chunk

    async def _research_question_stream(
        self,
        user_input: str,
        resume_text: str,
        jd_text: str,
        extracted_question: str | None
    ) -> AsyncGenerator[str, None]:
        """流式分析面试问题"""
        question = extracted_question
        if not question:
            question = self._fallback_extract_question(user_input) or user_input

        prompt = QUESTION_RESEARCH_PROMPT.format(
            question=question,
            resume_text=resume_text if resume_text else "无",
            jd_text=jd_text if jd_text else "无"
        )

        messages = [
            {"role": "system", "content": CHAT_SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ]

        async for chunk in llm_service.chat_completion_stream(messages=messages, temperature=0.7):
            yield chunk

    async def _optimize_resume_stream(
        self,
        user_input: str,
        resume_text: str,
        jd_text: str,
        extracted_question: str | None
    ) -> AsyncGenerator[str, None]:
        """流式优化简历"""
        if not resume_text:
            yield "请先上传你的简历，我才能帮你进行优化。你可以在项目设置中上传简历文件。"
            return

        prompt = RESUME_OPTIMIZATION_PROMPT.format(
            resume_text=resume_text,
            jd_text=jd_text if jd_text else "无",
            user_question=user_input
        )

        messages = [
            {"role": "system", "content": CHAT_SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ]

        async for chunk in llm_service.chat_completion_stream(messages=messages, temperature=0.7):
            yield chunk

    async def _write_script_stream(
        self,
        user_input: str,
        resume_text: str,
        jd_text: str,
        extracted_question: str | None
    ) -> AsyncGenerator[str, None]:
        """流式写逐字稿 - 从头生成完整的面试回答"""
        # 优先使用 Supervisor 提取的问题
        question = extracted_question or user_input

        # 如果没有简历，提示用户
        if not resume_text:
            yield "为了生成更贴合你个人经历的回答，建议先上传简历。不过我也可以根据职位要求先给你一个通用版本的回答框架。\n\n"

        prompt = SCRIPT_WRITING_PROMPT.format(
            question=question,
            resume_text=resume_text[:3000] if resume_text else "（未提供简历，将生成通用回答框架）",
            jd_text=jd_text if jd_text else "（未提供职位描述）"
        )

        messages = [
            {"role": "system", "content": CHAT_SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ]

        async for chunk in llm_service.chat_completion_stream(messages=messages, temperature=0.7):
            yield chunk

    async def _interview_chat_stream(
        self,
        user_input: str,
        resume_text: str,
        jd_text: str,
        state: AgentState
    ) -> AsyncGenerator[str, None]:
        """流式面试咨询对话"""
        from services.context_manager import context_manager

        session_id = state.get("session_id", "")
        context_summary = state.get("context_summary")

        # 构建背景信息
        background_info = ""
        if resume_text or jd_text:
            background_info = "\n\n## 用户背景信息\n"
            if jd_text:
                background_info += f"\n**目标职位**:\n{jd_text[:1500]}\n"
            if resume_text:
                background_info += f"\n**用户简历摘要**:\n{resume_text[:1500]}\n"

        system_prompt = INTERVIEW_CHAT_PROMPT + background_info

        # 使用 ContextManager 构建上下文
        context_result = await context_manager.build_context(
            session_id=session_id,
            system_prompt=system_prompt,
            user_input=user_input,
            jd_text="",  # 已经在 system_prompt 中包含
            resume_text="",  # 已经在 system_prompt 中包含
            existing_summary=context_summary
        )

        async for chunk in llm_service.chat_completion_stream(
            messages=context_result.messages,
            temperature=0.7
        ):
            yield chunk


# 全局实例
chat_subagent = ChatSubAgent()


async def chat_node(state: AgentState) -> AgentState:
    """
    LangGraph节点函数

    Args:
        state: 当前状态

    Returns:
        更新后的状态
    """
    return await chat_subagent.process(state)
