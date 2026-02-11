"""
回调注册表

用于在 LangGraph 执行过程中触发回调，避免将函数放入 state（无法序列化）。
"""

import logging
from typing import Callable, Dict, Any, Optional
import asyncio

logger = logging.getLogger(__name__)

# 全局回调注册表：session_id -> callback_name -> callback_function
_callbacks: Dict[str, Dict[str, Callable]] = {}


def register_callback(session_id: str, callback_name: str, callback: Callable):
    """
    注册回调函数

    Args:
        session_id: 会话ID
        callback_name: 回调名称（如 'on_transcription'）
        callback: 回调函数
    """
    if session_id not in _callbacks:
        _callbacks[session_id] = {}
    _callbacks[session_id][callback_name] = callback
    logger.debug(f"注册回调: session_id={session_id}, callback_name={callback_name}")


def unregister_callback(session_id: str, callback_name: str = None):
    """
    注销回调函数

    Args:
        session_id: 会话ID
        callback_name: 回调名称，如果为 None 则注销该会话的所有回调
    """
    if session_id in _callbacks:
        if callback_name:
            _callbacks[session_id].pop(callback_name, None)
            logger.debug(f"注销回调: session_id={session_id}, callback_name={callback_name}")
        else:
            del _callbacks[session_id]
            logger.debug(f"注销所有回调: session_id={session_id}")


def get_callback(session_id: str, callback_name: str) -> Optional[Callable]:
    """
    获取回调函数

    Args:
        session_id: 会话ID
        callback_name: 回调名称

    Returns:
        回调函数，如果不存在则返回 None
    """
    return _callbacks.get(session_id, {}).get(callback_name)


async def invoke_callback(session_id: str, callback_name: str, **kwargs) -> bool:
    """
    调用回调函数

    Args:
        session_id: 会话ID
        callback_name: 回调名称
        **kwargs: 传递给回调函数的参数

    Returns:
        是否成功调用
    """
    callback = get_callback(session_id, callback_name)
    if callback:
        logger.info(f">>> 调用回调: session_id={session_id}, callback_name={callback_name}")
        try:
            if asyncio.iscoroutinefunction(callback):
                await callback(**kwargs)
            else:
                callback(**kwargs)
            return True
        except Exception as e:
            logger.error(f"回调执行失败: {e}")
            return False
    else:
        logger.warning(f"回调不存在: session_id={session_id}, callback_name={callback_name}")
        return False
