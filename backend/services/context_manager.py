"""
上下文管理服务

负责管理对话历史、Token 预算分配、智能截断和摘要生成。
"""

from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, field
import logging

logger = logging.getLogger(__name__)


@dataclass
class TokenBudget:
    """Token 预算配置"""
    total: int = 16000           # 总预算
    system_prompt: int = 1000    # 系统提示词预留
    jd_max: int = 4000           # JD 最大 token
    resume_max: int = 4000       # 简历最大 token
    summary_max: int = 1000      # 摘要最大 token
    history_min: int = 2000      # 历史最小保留
    current_input: int = 500     # 当前输入预留

    @property
    def available_for_context(self) -> int:
        """可用于上下文的 token 数"""
        return self.total - self.system_prompt - self.current_input


@dataclass
class Message:
    """消息结构"""
    role: str           # "user" | "assistant"
    content: str
    token_count: int = 0
    message_type: Optional[str] = None  # "chat" | "voice_answer" | "feedback"


@dataclass
class ContextResult:
    """上下文构建结果"""
    messages: List[Dict[str, str]]       # 最终的消息列表
    jd_text: str                          # 处理后的 JD
    resume_text: str                      # 处理后的简历
    summary: Optional[str]                # 历史摘要（如有）
    history_messages: List[Message]       # 保留的历史消息
    token_usage: Dict[str, int]           # 各部分 token 使用情况
    truncated: Dict[str, bool]            # 各部分是否被截断


class ContextManager:
    """
    上下文管理器

    职责：
    1. 管理对话历史（保留最近 N 轮）
    2. 按优先级分配 token 预算（JD > 简历 > 历史）
    3. 超过阈值时生成摘要
    4. 构建最终的 LLM 消息列表
    """

    def __init__(
        self,
        budget: Optional[TokenBudget] = None,
        max_history_rounds: int = 10,
        summary_trigger_rounds: int = 10
    ):
        self.budget = budget or TokenBudget()
        self.max_history_rounds = max_history_rounds
        self.summary_trigger_rounds = summary_trigger_rounds

        # 会话级缓存
        self._session_summaries: Dict[str, str] = {}
        self._session_history: Dict[str, List[Message]] = {}

    def _count_tokens(self, text: str) -> int:
        """计算文本 token 数"""
        if not text:
            return 0
        from services.llm_service import llm_service
        return llm_service.count_tokens(text)

    def _truncate_text(self, text: str, max_tokens: int) -> str:
        """基础截断"""
        from services.llm_service import llm_service
        return llm_service.truncate_text(text, max_tokens)

    def _smart_truncate_jd(self, jd_text: str, max_tokens: int) -> str:
        """
        智能截断 JD
        优先保留：职责、要求、技能、经验
        """
        if self._count_tokens(jd_text) <= max_tokens:
            return jd_text

        paragraphs = jd_text.split('\n\n')
        priority_keywords = ['职责', '要求', '技能', '经验', '学历', '能力', '负责']

        prioritized = []
        other = []
        for p in paragraphs:
            if any(kw in p for kw in priority_keywords):
                prioritized.append(p)
            else:
                other.append(p)

        result_parts = []
        current_tokens = 0
        for p in prioritized + other:
            p_tokens = self._count_tokens(p)
            if current_tokens + p_tokens <= max_tokens:
                result_parts.append(p)
                current_tokens += p_tokens
            else:
                remaining = max_tokens - current_tokens
                if remaining > 100:
                    result_parts.append(self._truncate_text(p, remaining))
                break

        return '\n\n'.join(result_parts)

    def _smart_truncate_resume(self, resume_text: str, max_tokens: int) -> str:
        """
        智能截断简历
        优先保留：工作经历、项目经验、技能
        """
        if self._count_tokens(resume_text) <= max_tokens:
            return resume_text

        paragraphs = resume_text.split('\n\n')
        priority_keywords = ['工作', '项目', '经历', '技能', '教育', '经验', '负责']

        prioritized = []
        other = []
        for p in paragraphs:
            if any(kw in p for kw in priority_keywords):
                prioritized.append(p)
            else:
                other.append(p)

        result_parts = []
        current_tokens = 0
        for p in prioritized + other:
            p_tokens = self._count_tokens(p)
            if current_tokens + p_tokens <= max_tokens:
                result_parts.append(p)
                current_tokens += p_tokens
            else:
                remaining = max_tokens - current_tokens
                if remaining > 100:
                    result_parts.append(self._truncate_text(p, remaining))
                break

        return '\n\n'.join(result_parts)

    def _fit_history(
        self,
        history: List[Message],
        max_tokens: int
    ) -> Tuple[List[Message], int]:
        """
        将历史消息适配到 token 预算内
        策略：从最新消息开始，向前添加直到预算用尽
        """
        if not history:
            return [], 0

        result = []
        total_tokens = 0

        for msg in reversed(history):
            msg_tokens = msg.token_count or self._count_tokens(msg.content)
            if total_tokens + msg_tokens <= max_tokens:
                result.insert(0, msg)
                total_tokens += msg_tokens
            else:
                break

        return result, total_tokens

    async def _generate_summary(
        self,
        session_id: str,
        old_messages: List[Message]
    ) -> str:
        """生成历史对话摘要"""
        if not old_messages:
            return ""

        from services.llm_service import llm_service

        conversation = "\n".join([
            f"{msg.role}: {msg.content[:200]}..."
            for msg in old_messages[:20]
        ])

        summary_prompt = f"""请将以下面试练习对话总结为简洁的摘要。

## 对话内容
{conversation}

## 摘要要求
请用3-5句话总结，包含：
1. 用户练习了哪些面试问题
2. 回答的主要优点和不足
3. AI给出的关键改进建议

直接输出摘要文本："""

        messages = [
            {"role": "system", "content": "你是一个对话摘要助手，负责总结面试练习对话。"},
            {"role": "user", "content": summary_prompt}
        ]

        try:
            summary = await llm_service.chat_completion(
                messages=messages,
                temperature=0.3,
                max_tokens=500
            )
            return summary.strip()
        except Exception as e:
            logger.error(f"生成摘要失败: {e}")
            return ""

    async def build_context(
        self,
        session_id: str,
        system_prompt: str,
        user_input: str,
        jd_text: Optional[str] = None,
        resume_text: Optional[str] = None,
        history: Optional[List[Message]] = None,
        existing_summary: Optional[str] = None
    ) -> ContextResult:
        """
        构建 LLM 上下文
        按优先级分配 token：JD > 简历 > 历史
        """
        token_usage = {}
        truncated = {}

        system_tokens = self._count_tokens(system_prompt)
        input_tokens = self._count_tokens(user_input)
        token_usage["system_prompt"] = system_tokens
        token_usage["current_input"] = input_tokens

        available = self.budget.total - system_tokens - input_tokens

        # 处理 JD（最高优先级）
        jd_processed = ""
        jd_tokens = 0
        if jd_text:
            jd_max = min(self.budget.jd_max, available)
            if self._count_tokens(jd_text) > jd_max:
                jd_processed = self._smart_truncate_jd(jd_text, jd_max)
                truncated["jd"] = True
            else:
                jd_processed = jd_text
                truncated["jd"] = False
            jd_tokens = self._count_tokens(jd_processed)
            available -= jd_tokens
        token_usage["jd"] = jd_tokens

        # 处理简历（次高优先级）
        resume_processed = ""
        resume_tokens = 0
        if resume_text:
            resume_max = min(self.budget.resume_max, available)
            if self._count_tokens(resume_text) > resume_max:
                resume_processed = self._smart_truncate_resume(resume_text, resume_max)
                truncated["resume"] = True
            else:
                resume_processed = resume_text
                truncated["resume"] = False
            resume_tokens = self._count_tokens(resume_processed)
            available -= resume_tokens
        token_usage["resume"] = resume_tokens

        # 处理摘要和历史
        history_messages = history or self._session_history.get(session_id, [])
        summary = existing_summary or self._session_summaries.get(session_id)

        total_rounds = len(history_messages) // 2
        if total_rounds > self.summary_trigger_rounds and not summary:
            old_messages = history_messages[:-self.max_history_rounds * 2]
            if old_messages:
                summary = await self._generate_summary(session_id, old_messages)
                self._session_summaries[session_id] = summary
                logger.info(f"为会话 {session_id} 生成摘要")

        summary_processed = None
        summary_tokens = 0
        if summary:
            summary_max = min(self.budget.summary_max, available)
            if self._count_tokens(summary) > summary_max:
                summary_processed = self._truncate_text(summary, summary_max)
            else:
                summary_processed = summary
            summary_tokens = self._count_tokens(summary_processed)
            available -= summary_tokens
        token_usage["summary"] = summary_tokens

        recent_history = history_messages[-self.max_history_rounds * 2:]
        history_max = max(self.budget.history_min, available)
        history_processed, history_tokens = self._fit_history(recent_history, history_max)
        token_usage["history"] = history_tokens
        truncated["history"] = len(history_processed) < len(recent_history)

        messages = self._build_messages(
            system_prompt=system_prompt,
            jd_text=jd_processed,
            resume_text=resume_processed,
            summary=summary_processed,
            history=history_processed,
            user_input=user_input
        )

        logger.debug(f"上下文构建完成: {token_usage}")

        return ContextResult(
            messages=messages,
            jd_text=jd_processed,
            resume_text=resume_processed,
            summary=summary_processed,
            history_messages=history_processed,
            token_usage=token_usage,
            truncated=truncated
        )

    def _build_messages(
        self,
        system_prompt: str,
        jd_text: str,
        resume_text: str,
        summary: Optional[str],
        history: List[Message],
        user_input: str
    ) -> List[Dict[str, str]]:
        """构建最终的消息列表"""
        messages = []

        enhanced_system = system_prompt
        if jd_text or resume_text or summary:
            enhanced_system += "\n\n## 背景信息\n"
            if jd_text:
                enhanced_system += f"\n### 目标职位要求\n{jd_text}\n"
            if resume_text:
                enhanced_system += f"\n### 用户简历\n{resume_text}\n"
            if summary:
                enhanced_system += f"\n### 之前的对话摘要\n{summary}\n"

        messages.append({"role": "system", "content": enhanced_system})

        for msg in history:
            messages.append({"role": msg.role, "content": msg.content})

        messages.append({"role": "user", "content": user_input})

        return messages

    def add_message(
        self,
        session_id: str,
        role: str,
        content: str,
        message_type: Optional[str] = None
    ):
        """添加消息到会话历史"""
        if session_id not in self._session_history:
            self._session_history[session_id] = []

        msg = Message(
            role=role,
            content=content,
            token_count=self._count_tokens(content),
            message_type=message_type
        )
        self._session_history[session_id].append(msg)

    def get_history(self, session_id: str) -> List[Message]:
        """获取会话历史"""
        return self._session_history.get(session_id, [])

    def get_summary(self, session_id: str) -> Optional[str]:
        """获取会话摘要"""
        return self._session_summaries.get(session_id)

    def clear_session(self, session_id: str):
        """清除会话数据"""
        self._session_history.pop(session_id, None)
        self._session_summaries.pop(session_id, None)

    def init_history_from_db(self, session_id: str, messages: List[Dict]):
        """从数据库初始化历史"""
        self._session_history[session_id] = [
            Message(
                role=m.get("role", "user"),
                content=m.get("content", ""),
                token_count=self._count_tokens(m.get("content", "")),
                message_type=m.get("message_type")
            )
            for m in messages
        ]


# 全局实例
context_manager = ContextManager()
