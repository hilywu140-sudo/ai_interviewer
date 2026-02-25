"""
Interviewer SubAgent (面试官)

负责语音练习全流程：提问→录音→ASR→STAR分析→反馈
"""

import json
import logging
from typing import Dict, Any, Optional

from agents.state import AgentState
from agents.prompts.interviewer import INTERVIEWER_SYSTEM_PROMPT, STAR_ANALYSIS_PROMPT
from services.llm_service import llm_service
from services.asr_service import asr_service, build_context_text

logger = logging.getLogger(__name__)


class InterviewerSubAgent:
    """
    面试官SubAgent - 负责语音练习全流程

    工作流程：
    1. 接收问题 → 提示用户开始录音
    2. 接收音频 → 调用ASR转录
    3. 转录完成 → 调用STAR分析
    4. 分析完成 → 返回反馈结果
    """

    async def process(self, state: AgentState) -> AgentState:
        """
        处理面试练习流程

        Args:
            state: 当前状态

        Returns:
            更新后的状态
        """
        input_type = state.get("input_type", "text")
        audio_data = state.get("audio_data")
        current_question = state.get("current_question")
        user_input = state.get("user_input", "")

        logger.info(f"Interviewer 收到: input_type={input_type}, has_audio={bool(audio_data)}, audio_len={len(audio_data) if audio_data else 0}, current_question={current_question}")

        # 情况1: 收到音频数据 - 进行转录和分析
        if input_type == "audio" and audio_data:
            logger.info("进入音频处理流程...")
            return await self._process_audio(state)

        # 情况2: Supervisor 已经提取了问题 - 直接开始练习
        if current_question:
            return await self._set_question_and_start(state, current_question)

        # 情况3: 用户想开始练习但没有具体问题 - 提示输入问题
        if self._is_practice_request(user_input):
            return await self._start_practice(state)

        # 情况4: 用户提供了问题文本 - 设置问题并提示录音
        if user_input:
            # 尝试从用户输入中提取问题
            question = self._extract_question_from_input(user_input)
            if question:
                return await self._set_question_and_start(state, question)

        # 默认: 提示用户如何开始
        return {
            **state,
            "response_text": "请告诉我你想练习的面试问题，比如「我想练习自我介绍」或「请介绍一个你主导的项目」。",
            "response_type": "message",
            "next_agent": "end"
        }

    def _is_practice_request(self, user_input: str) -> bool:
        """判断是否是练习请求"""
        practice_keywords = ["练习", "模拟", "开始", "录音", "语音"]
        return any(kw in user_input for kw in practice_keywords)

    def _extract_question_from_input(self, user_input: str) -> str | None:
        """
        从用户输入中提取面试问题

        例如：
        - "请介绍你的项目经验" -> "请介绍你的项目经验"
        - "我想练习：为什么选择我们公司" -> "为什么选择我们公司"
        """
        # 如果输入看起来像一个面试问题，直接返回
        question_indicators = ["请", "介绍", "说说", "谈谈", "为什么", "如何", "怎么", "什么"]
        if any(indicator in user_input for indicator in question_indicators):
            # 清理输入
            question = user_input.strip()
            # 移除常见前缀
            prefixes = ["练习：", "练习:", "我想练习", "帮我练习"]
            for prefix in prefixes:
                if question.startswith(prefix):
                    question = question[len(prefix):].strip()
            return question if question else None
        return None

    async def _start_practice(self, state: AgentState) -> AgentState:
        """开始练习流程"""
        current_question = state.get("current_question")
        practice_questions = state.get("practice_questions", [])

        # 如果没有当前问题，提示用户输入具体问题
        if not current_question:
            if practice_questions:
                current_question = practice_questions[0]
            else:
                return {
                    **state,
                    "response_text": "好的，请告诉我你想练习的具体面试问题，比如：\n\n- 请介绍一个你主导的项目\n- 你最大的优点和缺点是什么\n- 为什么选择我们公司\n\n或者直接说出你想练习的问题。",
                    "response_type": "message",
                    "next_agent": "end"
                }

        return {
            **state,
            "current_question": current_question,
            "response_text": f"好的，让我们练习这道题：\n\n**{current_question}**\n\n请点击录音按钮开始回答。",
            "response_type": "recording_start",
            "response_metadata": {"question": current_question},
            "next_agent": "end"
        }

    async def _set_question_and_start(self, state: AgentState, question: str) -> AgentState:
        """设置问题并开始练习"""
        return {
            **state,
            "current_question": question,
            "response_text": f"好的，让我们练习这道题：\n\n**{question}**\n\n请点击录音按钮开始回答。",
            "response_type": "recording_start",
            "response_metadata": {"question": question},
            "next_agent": "end"
        }

    async def _process_audio(self, state: AgentState) -> AgentState:
        """处理音频：转录 + STAR分析 + 自动保存资产 + 保存音频文件"""
        import base64
        from datetime import datetime, timedelta
        from uuid import UUID

        audio_data = state.get("audio_data", "")
        current_question = state.get("current_question", "")
        resume_text = state.get("resume_text", "")
        jd_text = state.get("jd_text", "")
        project_id = state.get("project_id")
        session_id = state.get("session_id")

        if not current_question:
            return {
                **state,
                "response_text": "请先选择要练习的问题。",
                "response_type": "error",
                "next_agent": "end"
            }

        try:
            # 1. 解码音频
            audio_bytes = base64.b64decode(audio_data)

            # 检测音频格式
            audio_format = "unknown"
            if audio_bytes[:4] == b'RIFF':
                audio_format = "WAV"
            elif audio_bytes[:4] == b'\x1a\x45\xdf\xa3':
                audio_format = "WebM"
            elif audio_bytes[:3] == b'ID3' or audio_bytes[:2] == b'\xff\xfb':
                audio_format = "MP3"

            logger.info(f"音频大小: {len(audio_bytes)} bytes, 格式: {audio_format}")

            # 2. ASR转录（paraformer-v2 原生支持 WebM，无需转换）
            logger.info("开始ASR转录（持久化模式）...")
            context_text = build_context_text(
                resume_text=resume_text,
                jd_text=jd_text,
                question=current_question
            )

            asr_result, oss_info = await asr_service.transcribe_audio_bytes(
                audio_data=audio_bytes,  # 直接传原始 WebM 数据
                context_text=context_text,
                language="zh",
                persist_audio=True  # 持久化保存音频
            )

            transcript = asr_result.transcript
            transcript_sentences = asr_result.sentences  # 获取句子时间戳
            if not transcript:
                return {
                    **state,
                    "response_text": "未能识别到语音内容，请重新录音。",
                    "response_type": "error",
                    "next_agent": "end"
                }

            logger.info(f"转录完成: {transcript[:100]}...")
            logger.info(f"句子数: {len(transcript_sentences)}")

            # 4. 保存 AudioFile 记录
            audio_file_id = None
            logger.info(f"检查 OSS 信息: oss_info={oss_info is not None}, session_id={session_id}")
            if oss_info and session_id:
                oss_key, oss_url = oss_info
                logger.info(f"OSS 信息: oss_key={oss_key}, oss_url={oss_url[:50] if oss_url else None}...")
                try:
                    from models.audio_file import AudioFile
                    from database import SessionLocal

                    db = SessionLocal()
                    try:
                        audio_file = AudioFile(
                            session_id=UUID(session_id) if isinstance(session_id, str) else session_id,
                            file_path=oss_url,  # 使用 OSS URL 作为 file_path
                            oss_key=oss_key,
                            oss_url=oss_url,
                            file_size=len(audio_bytes),
                            format="wav",
                            asr_status="completed",
                            asr_result={"transcript": transcript, "sentences": transcript_sentences},
                            expires_at=datetime.utcnow() + timedelta(days=30)  # 30天后过期
                        )
                        db.add(audio_file)
                        db.commit()
                        db.refresh(audio_file)
                        audio_file_id = str(audio_file.id)
                        logger.info(f"AudioFile 已保存: {audio_file_id}, oss_key={oss_key}")
                    finally:
                        db.close()
                except Exception as e:
                    logger.error(f"保存 AudioFile 失败: {e}")
            else:
                logger.warning(f"跳过 AudioFile 保存: oss_info={oss_info}, session_id={session_id}")

            # 5. 立即发送转录结果（在 STAR 分析之前）
            # 使用回调注册表，避免将函数放入 state（无法序列化）
            from services.callback_registry import invoke_callback
            logger.info(">>> 调用 on_transcription 回调，发送转录消息...")
            await invoke_callback(
                session_id=session_id,
                callback_name="on_transcription",
                transcript=transcript,
                transcript_sentences=transcript_sentences,
                audio_file_id=audio_file_id,
                current_question=current_question
            )

            # 6. STAR分析（流式输出）
            logger.info("开始STAR分析（流式）...")
            feedback = await self._analyze_answer(
                question=current_question,
                answer=transcript,
                resume_text=resume_text,
                jd_text=jd_text,
                session_id=session_id
            )

            # 7. 自动保存到资产库
            asset_id = None
            if project_id and feedback:
                try:
                    from models.asset import Asset
                    from database import SessionLocal
                    from services.markdown_formatter import format_transcript

                    db = SessionLocal()
                    try:
                        # 格式化逐字稿为 Markdown
                        formatted_transcript = format_transcript(transcript)

                        asset = Asset(
                            project_id=project_id,
                            question=current_question,
                            transcript=formatted_transcript,
                            star_structure={"analysis": feedback.get("analysis", "")},
                            version=1,
                            version_type="recording"  # 标记为录音版本
                        )
                        db.add(asset)
                        db.commit()
                        db.refresh(asset)
                        asset_id = str(asset.id)
                        logger.info(f"资产已保存: {asset_id}")
                    finally:
                        db.close()
                except Exception as e:
                    logger.error(f"保存资产失败: {e}")

            # 8. 返回结果（仅 feedback，transcription 已通过回调发送）
            logger.info(f"Interviewer 返回结果: audio_file_id={audio_file_id}, asset_id={asset_id}, response_type=feedback")
            return {
                **state,
                "transcript": transcript,
                "transcript_sentences": transcript_sentences,
                "feedback": feedback,
                "asset_id": asset_id,
                "audio_file_id": audio_file_id,  # 新增：返回音频文件ID
                "response_text": feedback.get("raw_content", "分析完成"),
                "response_type": "feedback",
                "response_metadata": {
                    "transcript": transcript,
                    "transcript_sentences": transcript_sentences,
                    "feedback": feedback,
                    "asset_id": asset_id,
                    "audio_file_id": audio_file_id  # 新增
                },
                "current_question": None,  # 重置问题
                "audio_data": None,  # 清除音频数据
                "current_mode": "idle",
                "next_agent": "end"
            }

        except Exception as e:
            logger.error(f"音频处理失败: {e}")
            return {
                **state,
                "response_text": f"处理失败: {str(e)}",
                "response_type": "error",
                "next_agent": "end"
            }

    async def _analyze_answer(
        self,
        question: str,
        answer: str,
        resume_text: str,
        jd_text: str,
        session_id: str = None
    ) -> Dict[str, Any]:
        """
        使用STAR框架分析回答（流式输出）

        Returns:
            STAR分析结果（XML格式解析）
        """
        prompt = STAR_ANALYSIS_PROMPT.format(
            question=question,
            answer=answer,
            resume_text=resume_text if resume_text else "无",
            jd_text=jd_text if jd_text else "无"
        )

        messages = [
            {"role": "system", "content": INTERVIEWER_SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ]

        # 如果有 session_id，使用流式输出
        if session_id:
            from services.callback_registry import invoke_callback

            # 发送流式开始消息
            await invoke_callback(
                session_id=session_id,
                callback_name="on_feedback_stream_start"
            )

            full_content = ""
            async for chunk in llm_service.chat_completion_stream(
                messages=messages,
                temperature=0.3
            ):
                full_content += chunk
                # 发送流式 chunk
                await invoke_callback(
                    session_id=session_id,
                    callback_name="on_feedback_chunk",
                    content=chunk
                )

            # 发送流式结束消息
            feedback = self._parse_xml_feedback(full_content)
            await invoke_callback(
                session_id=session_id,
                callback_name="on_feedback_stream_end",
                full_content=full_content,
                feedback=feedback
            )

            return feedback
        else:
            # 非流式输出（用于测试）
            response = await llm_service.chat_completion(
                messages=messages,
                temperature=0.3
            )
            return self._parse_xml_feedback(response)

    def _parse_xml_feedback(self, response: str) -> Dict[str, Any]:
        """解析 XML 格式的反馈"""
        import re

        result = {
            "analysis": "",
            "strengths": "",
            "improvements": "",
            "encouragement": "",
            "raw_content": response  # 保存原始内容用于前端渲染
        }

        # 解析 <analysis> 标签
        analysis_match = re.search(r'<analysis>([\s\S]*?)</analysis>', response)
        if analysis_match:
            result["analysis"] = analysis_match.group(1).strip()

        # 解析 <strengths> 标签
        strengths_match = re.search(r'<strengths>([\s\S]*?)</strengths>', response)
        if strengths_match:
            result["strengths"] = strengths_match.group(1).strip()

        # 解析 <improvements> 标签
        improvements_match = re.search(r'<improvements>([\s\S]*?)</improvements>', response)
        if improvements_match:
            result["improvements"] = improvements_match.group(1).strip()

        # 解析 <encouragement> 标签
        encouragement_match = re.search(r'<encouragement>([\s\S]*?)</encouragement>', response)
        if encouragement_match:
            result["encouragement"] = encouragement_match.group(1).strip()

        return result


# 全局实例
interviewer_subagent = InterviewerSubAgent()


async def interviewer_node(state: AgentState) -> AgentState:
    """
    LangGraph节点函数

    Args:
        state: 当前状态

    Returns:
        更新后的状态
    """
    return await interviewer_subagent.process(state)
