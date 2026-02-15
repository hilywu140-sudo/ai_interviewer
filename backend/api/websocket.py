"""
WebSocket 聊天端点

简化后的WebSocket Handler，只负责消息收发，业务逻辑交给LangGraph处理。
支持新版简化协议和流式输出。
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime
import json
import logging
import re
import asyncio

from database import get_db
from models import Message, Session as SessionModel, Project, Asset, User
from services.websocket_manager import manager
from services.callback_registry import register_callback, unregister_callback
from agents.graph import process_message
from agents.subagents.chat import chat_subagent, extract_optimized_answer
from services.auth_service import auth_service

logger = logging.getLogger(__name__)

router = APIRouter()

# 存储每个会话的取消标志
cancel_flags: dict[str, asyncio.Event] = {}
# 存储每个会话当前正在执行的处理任务
processing_tasks: dict[str, asyncio.Task] = {}


async def handle_stream_response(
    websocket: WebSocket,
    db: Session,
    session_id: str,
    project_id: str | None,
    result: dict,
    save_asset: bool = False
):
    """
    处理流式响应

    Args:
        websocket: WebSocket 连接
        db: 数据库会话
        session_id: 会话 ID
        project_id: 项目 ID
        result: LangGraph 返回的结果
        save_asset: 是否保存到 Asset

    Returns:
        bool: True 表示正常完成，False 表示被取消
    """
    # 获取或创建取消标志
    if session_id not in cancel_flags:
        cancel_flags[session_id] = asyncio.Event()
    cancel_event = cancel_flags[session_id]
    cancel_event.clear()  # 重置取消标志

    # 发送流式开始消息
    await websocket.send_json({
        "type": "assistant_message_stream_start",
        "agent_status": {
            "current_agent": "chat",
            "status": "generating"
        },
        "timestamp": datetime.now().isoformat()
    })

    # 构建流式生成器所需的 state
    stream_state = {
        "session_id": session_id,
        "user_input": result.get("user_input", ""),
        "resume_text": result.get("resume_text", ""),
        "jd_text": result.get("jd_text", ""),
        "feedback": result.get("feedback"),
        "intent": result.get("intent", "general"),
        "extracted_question": result.get("extracted_question"),
        "context_summary": result.get("context_summary"),
        # 消息上下文相关字段（用于逐字稿修改）
        "original_transcript": result.get("original_transcript"),
        "context_question": result.get("context_question")
    }

    # 流式输出
    full_content = ""
    cancelled = False
    try:
        async for chunk in chat_subagent.get_stream_generator(stream_state):
            # 检查是否被取消
            if cancel_event.is_set():
                logger.info(f"流式输出被取消: session_id={session_id}")
                cancelled = True
                break

            full_content += chunk
            # 发送流式 chunk（不记录日志以减少噪音）
            await websocket.send_json({
                "type": "assistant_message_chunk",
                "content": chunk,
                "timestamp": datetime.now().isoformat()
            })
    except asyncio.CancelledError:
        # 任务被取消，保存已生成的内容到数据库，然后发送给前端
        logger.info(f"流式输出任务被取消: session_id={session_id}, 已生成 {len(full_content)} 字符")

        # 保存已生成的部分内容到数据库（如果有内容）
        if full_content.strip():
            cancelled_message = Message(
                session_id=UUID(session_id),
                role="assistant",
                content=full_content,
                message_type="chat",
                meta={
                    "cancelled": True,
                    "mode": result.get("current_mode", "idle"),
                    "intent": result.get("intent")
                }
            )
            db.add(cancelled_message)
            db.commit()
            logger.info(f"已保存取消的消息: {len(full_content)} 字符")

        await websocket.send_json({
            "type": "generation_cancelled",
            "partial_content": full_content,
            "agent_status": {
                "current_agent": None,
                "status": "idle"
            },
            "timestamp": datetime.now().isoformat()
        })
        return False  # 返回 False 表示被取消，不重新抛出异常
    except Exception as e:
        logger.error(f"流式输出错误: {e}")
        await websocket.send_json({
            "type": "error",
            "content": f"生成回复时出错: {str(e)}",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        })
        return False

    # 如果被取消（通过 cancel_event），保存并发送取消确认消息
    if cancelled:
        # 保存已生成的部分内容到数据库（如果有内容）
        if full_content.strip():
            cancelled_message = Message(
                session_id=UUID(session_id),
                role="assistant",
                content=full_content,
                message_type="chat",
                meta={
                    "cancelled": True,
                    "mode": result.get("current_mode", "idle"),
                    "intent": result.get("intent")
                }
            )
            db.add(cancelled_message)
            db.commit()
            logger.info(f"已保存取消的消息: {len(full_content)} 字符")

        await websocket.send_json({
            "type": "generation_cancelled",
            "partial_content": full_content,  # 返回已生成的部分内容
            "agent_status": {
                "current_agent": None,
                "status": "idle"
            },
            "timestamp": datetime.now().isoformat()
        })
        return False

    # 流式结束后处理
    asset_id = None
    extracted_question = result.get("extracted_question")
    pending_save = None

    # 如果需要保存 Asset（答案优化场景），返回待保存数据让用户确认
    if save_asset and project_id:
        # 从完整内容中提取优化后的答案
        optimized_answer = extract_optimized_answer(full_content)

        if optimized_answer and extracted_question:
            # 不再自动保存，而是返回待保存数据让用户确认
            pending_save = {
                "question": extracted_question,
                "transcript": optimized_answer,  # 只保存到 transcript
                "project_id": project_id
            }
            logger.info(f"已生成待保存数据: question={extracted_question[:30]}...")

    # 保存 AI 回复到消息表
    ai_message = Message(
        session_id=UUID(session_id),
        role="assistant",
        content=full_content,
        message_type="chat",
        meta={
            "mode": result.get("current_mode", "idle"),
            "intent": result.get("intent"),
            "asset_id": asset_id,
            "pending_save": pending_save,
            "saved": False
        }
    )
    db.add(ai_message)
    db.commit()
    db.refresh(ai_message)

    # 发送流式结束消息
    await websocket.send_json({
        "type": "assistant_message_stream_end",
        "full_content": full_content,
        "asset_id": asset_id,
        "pending_save": pending_save,  # 待保存数据（用户确认后保存）
        "message_id": str(ai_message.id),  # 消息ID（用于保存后更新 meta）
        "agent_status": {
            "current_agent": None,
            "status": "idle"
        },
        "timestamp": ai_message.created_at.isoformat()
    })

    return True


@router.websocket("/ws/chat/{session_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    session_id: str,
    token: str = Query(None)
):
    """
    WebSocket 聊天端点（新版简化协议）

    认证方式: ws://example.com/ws/chat/{session_id}?token=xxx

    客户端 -> 服务器:
    {
        "type": "message" | "audio",
        "content": "消息内容",
        "audio_data": "base64音频数据（可选）",
        "timestamp": "2026-01-24T12:00:00Z"
    }

    服务器 -> 客户端:
    {
        "type": "assistant_message" | "recording_start" | "transcription" | "feedback" | "error",
        "content": "回复内容",
        "agent_status": {"current_agent": "supervisor", "status": "thinking"},
        "recording": {"question": "问题"},
        "transcription": {"text": "转录文本", "is_final": true},
        "feedback": {...},
        "timestamp": "2026-01-24T12:00:01Z"
    }
    """
    # 连接 WebSocket
    await manager.connect(websocket, session_id)

    # 获取数据库会话
    db = next(get_db())

    # 验证 Token
    current_user = None
    if token:
        valid, token_data, _ = auth_service.verify_token(token)
        if valid:
            current_user = auth_service.get_user_by_id(db, UUID(token_data.sub))

    if not current_user:
        await websocket.send_json({
            "type": "error",
            "error": "未授权，请先登录",
            "timestamp": datetime.now().isoformat()
        })
        await websocket.close(code=4001)
        return

    # 验证 session 是否存在
    session = db.query(SessionModel).filter(SessionModel.id == UUID(session_id)).first()
    if not session:
        await websocket.send_json({
            "type": "error",
            "error": "会话不存在",
            "timestamp": datetime.now().isoformat()
        })
        await websocket.close()
        return

    # 获取项目信息并验证所有权
    project = None
    resume_text = None
    jd_text = None
    practice_questions = []

    if session.project_id:
        project = db.query(Project).filter(
            Project.id == session.project_id,
            Project.user_id == current_user.id
        ).first()
        if not project:
            await websocket.send_json({
                "type": "error",
                "error": "无权访问此会话",
                "timestamp": datetime.now().isoformat()
            })
            await websocket.close(code=4003)
            return
        resume_text = project.resume_text
        jd_text = project.jd_text
        practice_questions = project.practice_questions or []

    # 从数据库加载历史消息到 ContextManager
    from services.context_manager import context_manager

    db_messages = db.query(Message).filter(
        Message.session_id == UUID(session_id)
    ).order_by(Message.created_at).all()

    context_manager.init_history_from_db(
        session_id=session_id,
        messages=[
            {
                "role": msg.role,
                "content": msg.content,
                "message_type": msg.message_type
            }
            for msg in db_messages
        ]
    )
    logger.info(f"已加载 {len(db_messages)} 条历史消息到 ContextManager")

    # 当前状态
    current_question = None
    # 当前处理任务
    current_processing_task: asyncio.Task | None = None

    # 定义消息处理函数
    async def process_and_respond(
        input_type: str,
        user_input: str,
        audio_data: str | None,
        message_context: dict | None,
        cq: str | None  # current_question
    ) -> str | None:
        """处理消息并发送响应，返回更新后的 current_question"""
        nonlocal current_question

        # 重置取消标志
        if session_id not in cancel_flags:
            cancel_flags[session_id] = asyncio.Event()
        cancel_flags[session_id].clear()

        # 定义转录完成回调函数
        async def on_transcription_callback(
            transcript: str,
            transcript_sentences: list,
            audio_file_id: str,
            current_question: str = ""
        ):
            logger.info(f">>> on_transcription_callback 被调用")
            await websocket.send_json({
                "type": "transcription",
                "transcription": {"text": transcript, "is_final": True},
                "audio_file_id": audio_file_id,
                "transcript_sentences": transcript_sentences,
                "agent_status": {"current_agent": "interviewer", "status": "analyzing"},
                "timestamp": datetime.now().isoformat()
            })
            user_answer = Message(
                session_id=UUID(session_id),
                role="user",
                content=transcript,
                message_type="voice_answer",
                audio_file_id=UUID(audio_file_id) if audio_file_id else None,
                transcript=transcript,
                meta={
                    "question": current_question,
                    "transcript_sentences": transcript_sentences
                }
            )
            db.add(user_answer)
            db.commit()

        register_callback(session_id, "on_transcription", on_transcription_callback)

        # 定义流式反馈回调函数
        async def on_feedback_stream_start_callback():
            logger.info(f">>> on_feedback_stream_start_callback 被调用")
            await websocket.send_json({
                "type": "feedback_stream_start",
                "agent_status": {"current_agent": "interviewer", "status": "analyzing"},
                "timestamp": datetime.now().isoformat()
            })

        async def on_feedback_chunk_callback(content: str):
            # 发送流式 chunk（不记录日志以减少噪音）
            await websocket.send_json({
                "type": "feedback_chunk",
                "content": content,
                "timestamp": datetime.now().isoformat()
            })

        async def on_feedback_stream_end_callback(full_content: str, feedback: dict):
            logger.info(f">>> on_feedback_stream_end_callback 被调用")
            # 不在这里发送结束消息，让主流程处理保存和发送

        register_callback(session_id, "on_feedback_stream_start", on_feedback_stream_start_callback)
        register_callback(session_id, "on_feedback_chunk", on_feedback_chunk_callback)
        register_callback(session_id, "on_feedback_stream_end", on_feedback_stream_end_callback)

        try:
            result = await process_message(
                session_id=session_id,
                user_input=user_input,
                input_type=input_type,
                audio_data=audio_data,
                resume_text=resume_text,
                jd_text=jd_text,
                practice_questions=practice_questions,
                project_id=str(project.id) if project else None,
                current_question=cq,
                message_context=message_context
            )

            # 检查是否被取消
            if cancel_flags.get(session_id) and cancel_flags[session_id].is_set():
                logger.info(f"处理被取消，跳过响应: session_id={session_id}")
                return cq

            new_question = result.get("current_question") or cq
            response_type = result.get("response_type", "message")
            response_text = result.get("response_text", "")
            response_metadata = result.get("response_metadata", {})

            if response_type == "recording_start":
                question = response_metadata.get("question", new_question)
                # 保存 recording_prompt 消息到数据库
                recording_prompt_message = Message(
                    session_id=UUID(session_id),
                    role="assistant",
                    content=response_text,
                    message_type="recording_prompt",
                    meta={"question": question}
                )
                db.add(recording_prompt_message)
                db.commit()
                await websocket.send_json({
                    "type": "recording_start",
                    "content": response_text,
                    "recording": {"question": question},
                    "agent_status": {"current_agent": "interviewer", "status": "recording"},
                    "timestamp": datetime.now().isoformat()
                })

            elif response_type == "feedback":
                feedback = result.get("feedback", {})
                asset_id = result.get("asset_id")
                audio_file_id = result.get("audio_file_id")

                # 更新对应的 recording_prompt 消息为已提交状态
                recording_prompt_msg = db.query(Message).filter(
                    Message.session_id == UUID(session_id),
                    Message.message_type == "recording_prompt"
                ).order_by(Message.created_at.desc()).first()
                if recording_prompt_msg:
                    meta = recording_prompt_msg.meta or {}
                    meta["submitted"] = True
                    recording_prompt_msg.meta = meta
                    from sqlalchemy.orm.attributes import flag_modified
                    flag_modified(recording_prompt_msg, "meta")

                # 使用 raw_content 作为消息内容
                feedback_content = feedback.get("raw_content", "分析完成")
                feedback_message = Message(
                    session_id=UUID(session_id),
                    role="assistant",
                    content=feedback_content,
                    message_type="feedback",
                    feedback=feedback,
                    meta={"question": new_question, "asset_id": asset_id, "audio_file_id": audio_file_id}
                )
                db.add(feedback_message)
                db.commit()
                # 发送流式结束消息（流式内容已通过回调发送）
                await websocket.send_json({
                    "type": "feedback_stream_end",
                    "full_content": feedback_content,
                    "feedback": feedback,
                    "asset_id": asset_id,
                    "agent_status": {"current_agent": None, "status": "idle"},
                    "timestamp": datetime.now().isoformat()
                })
                new_question = None

            elif response_type == "error":
                await websocket.send_json({
                    "type": "error",
                    "content": response_text,
                    "error": response_text,
                    "timestamp": datetime.now().isoformat()
                })

            else:
                stream_enabled = result.get("stream_enabled", False)
                save_asset = result.get("save_asset", False)

                if stream_enabled:
                    await handle_stream_response(
                        websocket=websocket,
                        db=db,
                        session_id=session_id,
                        project_id=str(project.id) if project else None,
                        result=result,
                        save_asset=save_asset
                    )
                else:
                    ai_message = Message(
                        session_id=UUID(session_id),
                        role="assistant",
                        content=response_text,
                        message_type="chat",
                        meta={"mode": result.get("current_mode", "idle")}
                    )
                    db.add(ai_message)
                    db.commit()
                    await websocket.send_json({
                        "type": "assistant_message",
                        "content": response_text,
                        "agent_status": {"current_agent": None, "status": "idle"},
                        "timestamp": datetime.now().isoformat()
                    })

            return new_question

        except asyncio.CancelledError:
            logger.info(f"处理任务被取消: session_id={session_id}")
            # 发送取消确认消息（非流式阶段取消时）
            try:
                await websocket.send_json({
                    "type": "generation_cancelled",
                    "partial_content": "",  # 非流式阶段没有已生成的内容
                    "agent_status": {"current_agent": None, "status": "idle"},
                    "timestamp": datetime.now().isoformat()
                })
            except Exception:
                pass  # WebSocket 可能已关闭
            raise
        finally:
            unregister_callback(session_id)

    try:
        while True:
            # 如果有正在执行的任务，使用 asyncio.wait 并发等待
            if current_processing_task and not current_processing_task.done():
                receive_task = asyncio.create_task(websocket.receive_text())
                done, pending = await asyncio.wait(
                    {receive_task, current_processing_task},
                    return_when=asyncio.FIRST_COMPLETED
                )

                # 如果处理任务完成
                if current_processing_task in done:
                    try:
                        current_question = current_processing_task.result()
                    except asyncio.CancelledError:
                        pass
                    except Exception as e:
                        logger.error(f"处理任务异常: {e}")
                    current_processing_task = None
                    if session_id in processing_tasks:
                        del processing_tasks[session_id]

                # 如果收到新消息
                if receive_task in done:
                    data = receive_task.result()
                else:
                    # 取消未完成的接收任务
                    receive_task.cancel()
                    try:
                        await receive_task
                    except asyncio.CancelledError:
                        pass
                    continue
            else:
                # 没有正在执行的任务，直接接收消息
                data = await websocket.receive_text()

            message_data = json.loads(data)
            message_type = message_data.get("type")
            if message_type:
                message_type = message_type.strip().lower()

            content = message_data.get("content", "")
            audio_data = message_data.get("audio_data")

            logger.info(f"收到消息: type={message_type!r}, content={content[:50] if content else 'N/A'}...")

            input_type = "text"
            user_input = content
            message_context = message_data.get("context")

            if message_type == "message":
                input_type = "text"
                user_input = content
                user_message = Message(
                    session_id=UUID(session_id),
                    role="user",
                    content=content,
                    message_type="chat",
                    meta={"context": message_context} if message_context else None
                )
                db.add(user_message)
                db.commit()

            elif message_type == "audio":
                input_type = "audio"
                user_input = ""

            elif message_type == "user_message":
                input_type = "text"
                user_input = content
                user_message = Message(
                    session_id=UUID(session_id),
                    role="user",
                    content=content,
                    message_type="chat"
                )
                db.add(user_message)
                db.commit()

            elif message_type == "start_voice_practice":
                question = message_data.get("question")
                input_type = "text"
                user_input = f"我想练习这道题：{question}" if question else "开始练习"
                current_question = question

            elif message_type == "submit_audio":
                input_type = "audio"
                user_input = ""

            elif message_type == "cancel_practice":
                current_question = None
                await websocket.send_json({
                    "type": "assistant_message",
                    "content": "已取消练习。有什么其他可以帮助你的吗？",
                    "timestamp": datetime.now().isoformat()
                })
                continue

            elif message_type == "cancel_recording":
                # 标记最近的未提交 recording_prompt 消息为已取消
                recording_prompt_msg = db.query(Message).filter(
                    Message.session_id == UUID(session_id),
                    Message.message_type == "recording_prompt"
                ).order_by(Message.created_at.desc()).first()

                if recording_prompt_msg:
                    meta = recording_prompt_msg.meta or {}
                    if not meta.get("submitted"):  # 只有未提交的才能取消
                        meta["cancelled"] = True
                        recording_prompt_msg.meta = meta
                        from sqlalchemy.orm.attributes import flag_modified
                        flag_modified(recording_prompt_msg, "meta")
                        db.commit()
                        logger.info(f"Recording cancelled for message {recording_prompt_msg.id}")
                continue

            elif message_type == "cancel":
                logger.info(f"收到取消请求: session_id={session_id}")
                if session_id in cancel_flags:
                    cancel_flags[session_id].set()

                # 检查是否有正在执行的任务
                had_running_task = current_processing_task and not current_processing_task.done()

                if had_running_task:
                    current_processing_task.cancel()
                    logger.info(f"已取消处理任务")
                    try:
                        await current_processing_task
                    except asyncio.CancelledError:
                        pass
                    current_processing_task = None

                if session_id in processing_tasks:
                    del processing_tasks[session_id]

                # 只有在没有运行中的任务时才发送 generation_cancelled
                # 如果有任务在运行，handle_stream_response 会在取消时发送（包含 partial_content）
                if not had_running_task:
                    await websocket.send_json({
                        "type": "generation_cancelled",
                        "agent_status": {"current_agent": None, "status": "idle"},
                        "timestamp": datetime.now().isoformat()
                    })
                continue

            else:
                logger.warning(f"未知消息类型: {message_type!r}")
                input_type = "text"
                user_input = content if content else ""
                if content:
                    user_message = Message(
                        session_id=UUID(session_id),
                        role="user",
                        content=content,
                        message_type="chat"
                    )
                    db.add(user_message)
                    db.commit()

            # 如果有正在执行的任务，先取消它
            if current_processing_task and not current_processing_task.done():
                logger.info(f"有新消息到达，取消当前任务")
                if session_id in cancel_flags:
                    cancel_flags[session_id].set()
                current_processing_task.cancel()
                try:
                    await current_processing_task
                except asyncio.CancelledError:
                    pass

            # 创建新的处理任务
            current_processing_task = asyncio.create_task(
                process_and_respond(input_type, user_input, audio_data, message_context, current_question)
            )
            processing_tasks[session_id] = current_processing_task

    except WebSocketDisconnect:
        manager.disconnect(websocket, session_id)
        unregister_callback(session_id)  # 清理回调
        # 清理取消标志
        if session_id in cancel_flags:
            del cancel_flags[session_id]
        # 取消并清理正在执行的任务
        if session_id in processing_tasks:
            task = processing_tasks[session_id]
            if not task.done():
                task.cancel()
            del processing_tasks[session_id]
        # 注意：不清理 ContextManager，因为用户可能重新连接
        logger.info(f"客户端断开连接: {session_id}")
    except Exception as e:
        logger.error(f"WebSocket错误: {e}")
        await websocket.send_json({
            "type": "error",
            "content": f"服务器错误: {str(e)}",
            "error": f"服务器错误: {str(e)}",
            "timestamp": datetime.now().isoformat()
        })
    finally:
        db.close()
