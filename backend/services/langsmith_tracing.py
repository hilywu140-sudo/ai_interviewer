"""
LangSmith 追踪配置

用于监控 LangGraph 链路的执行情况。
"""

import os
import logging
from functools import wraps
from typing import Optional, Callable, Any

logger = logging.getLogger(__name__)

_tracing_enabled = False


def setup_langsmith_tracing():
    """
    设置 LangSmith 追踪

    通过环境变量配置 LangSmith，LangGraph 会自动使用这些配置。
    """
    global _tracing_enabled

    from config import settings

    if not settings.langsmith_api_key:
        logger.info("LangSmith API Key 未配置，追踪功能已禁用")
        return False

    if not settings.langsmith_tracing:
        logger.info("LangSmith 追踪已在配置中禁用")
        return False

    # 设置环境变量（LangSmith 通过环境变量读取配置）
    os.environ["LANGSMITH_API_KEY"] = settings.langsmith_api_key
    os.environ["LANGSMITH_PROJECT"] = settings.langsmith_project
    os.environ["LANGSMITH_TRACING"] = "true"

    # 可选：设置端点（默认是 https://api.smith.langchain.com）
    # os.environ["LANGSMITH_ENDPOINT"] = "https://api.smith.langchain.com"

    _tracing_enabled = True
    logger.info(f"LangSmith 追踪已启用，项目: {settings.langsmith_project}")

    return True


def is_tracing_enabled() -> bool:
    """检查追踪是否已启用"""
    return _tracing_enabled


def get_langsmith_client():
    """
    获取 LangSmith 客户端

    Returns:
        LangSmith Client 或 None（如果未配置）
    """
    if not _tracing_enabled:
        return None

    try:
        from langsmith import Client
        return Client()
    except Exception as e:
        logger.warning(f"无法创建 LangSmith 客户端: {e}")
        return None


def trace_function(
    name: Optional[str] = None,
    run_type: str = "chain",
    metadata: Optional[dict] = None
):
    """
    装饰器：追踪函数执行

    Args:
        name: 追踪名称（默认使用函数名）
        run_type: 运行类型 (chain, llm, tool, retriever, etc.)
        metadata: 额外的元数据

    Example:
        @trace_function(name="analyze_answer", run_type="chain")
        async def analyze_answer(question, answer):
            ...
    """
    def decorator(func: Callable) -> Callable:
        if not _tracing_enabled:
            return func

        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            try:
                from langsmith import traceable

                traced_func = traceable(
                    name=name or func.__name__,
                    run_type=run_type,
                    metadata=metadata or {}
                )(func)

                return await traced_func(*args, **kwargs)
            except ImportError:
                return await func(*args, **kwargs)

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            try:
                from langsmith import traceable

                traced_func = traceable(
                    name=name or func.__name__,
                    run_type=run_type,
                    metadata=metadata or {}
                )(func)

                return traced_func(*args, **kwargs)
            except ImportError:
                return func(*args, **kwargs)

        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator


def create_run_tree(
    name: str,
    run_type: str = "chain",
    inputs: Optional[dict] = None,
    metadata: Optional[dict] = None
):
    """
    创建一个运行树用于手动追踪

    Args:
        name: 运行名称
        run_type: 运行类型
        inputs: 输入数据
        metadata: 元数据

    Returns:
        RunTree 对象或 None

    Example:
        run = create_run_tree("process_audio", inputs={"audio_size": len(audio_data)})
        if run:
            try:
                result = await process_audio(audio_data)
                run.end(outputs={"transcript": result})
            except Exception as e:
                run.end(error=str(e))
            run.post()
    """
    if not _tracing_enabled:
        return None

    try:
        from langsmith.run_trees import RunTree

        return RunTree(
            name=name,
            run_type=run_type,
            inputs=inputs or {},
            extra={"metadata": metadata or {}}
        )
    except Exception as e:
        logger.warning(f"无法创建 RunTree: {e}")
        return None
