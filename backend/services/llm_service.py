from typing import List, Dict, Optional, AsyncGenerator
from openai import AsyncOpenAI
import tiktoken
from config import settings


class LLMService:
    """统一的 LLM 服务接口，支持多模型切换"""

    def __init__(self, provider: Optional[str] = None):
        self.provider = provider or settings.default_llm_provider

        if self.provider == "deepseek":
            self.client = AsyncOpenAI(
                api_key=settings.deepseek_api_key,
                base_url=settings.deepseek_base_url
            )
            self.default_model = "deepseek-chat"
        elif self.provider == "openai":
            self.client = AsyncOpenAI(api_key=settings.openai_api_key)
            self.default_model = "gpt-4"
        elif self.provider == "qwen":
            # 千问使用 DashScope API Key
            api_key = settings.qwen_api_key or settings.dashscope_api_key
            self.client = AsyncOpenAI(
                api_key=api_key,
                base_url=settings.qwen_base_url
            )
            self.default_model = settings.qwen_supervisor_model
        elif self.provider == "anthropic":
            # Anthropic 使用不同的客户端，暂时不实现
            raise NotImplementedError("Anthropic provider not yet implemented")
        else:
            raise ValueError(f"Unknown provider: {self.provider}")

    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000
    ) -> str:
        """
        统一的聊天补全接口

        Args:
            messages: 消息列表 [{"role": "user", "content": "..."}]
            model: 模型名称，默认使用 provider 的默认模型
            temperature: 温度参数
            max_tokens: 最大 token 数

        Returns:
            AI 回复内容
        """
        model = model or self.default_model

        try:
            # 构建请求参数
            params = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens
            }

            # 千问模型需要禁用 thinking 模式（非流式调用）
            if self.provider == "qwen":
                params["extra_body"] = {"enable_thinking": False}

            response = await self.client.chat.completions.create(**params)
            return response.choices[0].message.content
        except Exception as e:
            print(f"LLM API Error: {e}")
            raise

    async def chat_completion_stream(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000
    ) -> AsyncGenerator[str, None]:
        """
        流式聊天补全接口 - 逐 token 返回

        Args:
            messages: 消息列表 [{"role": "user", "content": "..."}]
            model: 模型名称，默认使用 provider 的默认模型
            temperature: 温度参数
            max_tokens: 最大 token 数

        Yields:
            AI 回复内容的每个 token
        """
        model = model or self.default_model

        try:
            # 构建请求参数
            params = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "stream": True
            }

            # 千问模型需要禁用 thinking 模式
            if self.provider == "qwen":
                params["extra_body"] = {"enable_thinking": False}

            response = await self.client.chat.completions.create(**params)
            async for chunk in response:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            print(f"LLM Stream API Error: {e}")
            raise

    def count_tokens(self, text: str, model: Optional[str] = None) -> int:
        """
        估算文本的 token 数量

        Args:
            text: 要计数的文本
            model: 模型名称

        Returns:
            token 数量
        """
        try:
            # 使用 cl100k_base 编码器（适用于 GPT-4 和 DeepSeek）
            encoding = tiktoken.get_encoding("cl100k_base")
            return len(encoding.encode(text))
        except Exception:
            # 简单估算：1 token ≈ 4 字符
            return len(text) // 4

    def truncate_text(self, text: str, max_tokens: int) -> str:
        """
        截断文本到指定 token 数量

        Args:
            text: 要截断的文本
            max_tokens: 最大 token 数

        Returns:
            截断后的文本
        """
        if self.count_tokens(text) <= max_tokens:
            return text

        # 简单截断策略：按字符截断
        chars_per_token = 4
        max_chars = max_tokens * chars_per_token
        return text[:max_chars] + "..."


# 全局 LLM 服务实例
llm_service = LLMService()
