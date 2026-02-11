"""
DashScope 录音文件转写服务

使用阿里云 DashScope Transcription API 实现语音转文字功能。
"""

import logging
from dataclasses import dataclass, field
from http import HTTPStatus
from typing import Optional, List, Dict, Any

import dashscope
from dashscope.audio.asr import Transcription

from config import settings
from services.oss_service import oss_service

logger = logging.getLogger(__name__)


@dataclass
class ASRResult:
    """ASR转录结果"""
    transcript: str
    sentences: List[Dict[str, Any]] = field(default_factory=list)  # 句子级时间戳
    segments: List[Dict[str, Any]] = field(default_factory=list)
    emotions: List[Dict[str, Any]] = field(default_factory=list)
    duration: float = 0.0
    raw_events: List[Dict[str, Any]] = field(default_factory=list)


class ASRService:
    """
    DashScope 录音文件转写服务

    使用 Transcription API 进行语音转文字
    """

    def __init__(self):
        dashscope.api_key = settings.dashscope_api_key
        dashscope.base_http_api_url = 'https://dashscope.aliyuncs.com/api/v1'
        self.model = "fun-asr"

    def transcribe_audio_bytes_sync(
        self,
        audio_data: bytes,
        sample_rate: int = 16000,
        persist_audio: bool = False
    ) -> tuple:
        """
        同步转录音频字节数据

        Args:
            audio_data: WAV 音频字节数据
            sample_rate: 采样率，默认 16000Hz
            persist_audio: 是否持久化保存音频到 OSS（不删除）

        Returns:
            tuple: (ASRResult, (oss_key, oss_url) 或 None)
                - 如果 persist_audio=True，返回 OSS 信息用于后续回放
                - 如果 persist_audio=False，返回 None
        """
        audio_url = None
        oss_key = None
        oss_base_url = None

        try:
            # 1. 上传音频到 OSS
            logger.info(f"上传音频到 OSS，大小: {len(audio_data)} bytes, persist={persist_audio}")

            if persist_audio:
                # 持久化上传（不会自动删除）
                oss_key, oss_base_url = oss_service.upload_audio_persistent(audio_data, suffix='.wav')
                # 生成临时签名 URL 用于 ASR
                audio_url = oss_service.get_signed_url(oss_key, 3600)
            else:
                # 临时上传（转录后删除）
                audio_url = oss_service.upload_audio(audio_data, suffix='.wav')

            logger.info(f"音频 URL: {audio_url[:80]}...")

            # 2. 提交转录任务
            logger.info("提交 ASR 转录任务...")
            task_response = Transcription.async_call(
                model=self.model,
                file_urls=[audio_url]
            )

            if not task_response.output or not task_response.output.task_id:
                raise Exception(f"ASR 任务提交失败: {task_response}")

            task_id = task_response.output.task_id
            logger.info(f"ASR 任务已提交，task_id: {task_id}")

            # 3. 等待转录结果
            logger.info("等待 ASR 转录结果...")
            result = Transcription.wait(task=task_id)

            if result.status_code == HTTPStatus.OK:
                # 解析转录结果
                transcript, sentences = self._parse_result(result.output)
                logger.info(f"ASR 转录完成: {transcript[:100] if transcript else '(空)'}...")
                logger.info(f"ASR 句子数: {len(sentences)}")

                asr_result = ASRResult(transcript=transcript, sentences=sentences)

                # 返回 ASR 结果和 OSS 信息
                if persist_audio:
                    return asr_result, (oss_key, oss_base_url)
                else:
                    return asr_result, None
            else:
                error_msg = getattr(result, 'message', str(result))
                raise Exception(f"ASR 转录失败: {error_msg}")

        except Exception as e:
            logger.error(f"ASR 转录失败: {e}")
            # 如果是持久化模式且出错，也要清理 OSS 文件
            if persist_audio and oss_key:
                try:
                    oss_service.delete_audio(oss_key)
                except Exception as cleanup_error:
                    logger.warning(f"清理失败的 OSS 文件失败: {cleanup_error}")
            raise
        finally:
            # 4. 只有非持久化模式才清理 OSS 文件
            if not persist_audio and audio_url:
                try:
                    key = oss_service.get_key_from_url(audio_url)
                    if key:
                        oss_service.delete_audio(key)
                except Exception as e:
                    logger.warning(f"清理 OSS 文件失败: {e}")

    def _parse_result(self, output) -> tuple:
        """
        解析 Transcription API 返回的结果

        Args:
            output: API 返回的 output 对象

        Returns:
            tuple: (转录文本, 句子列表)
        """
        try:
            logger.info(f"ASR 原始输出: {output}")

            # 获取 results 列表
            results = None
            if hasattr(output, 'results'):
                results = output.results
            elif isinstance(output, dict) and 'results' in output:
                results = output['results']

            if results:
                transcripts = []
                all_sentences = []
                for result in results:
                    logger.info(f"ASR result item: {result}")

                    # 获取 transcription_url（支持对象和字典两种格式）
                    transcription_url = None
                    if hasattr(result, 'transcription_url'):
                        transcription_url = result.transcription_url
                    elif isinstance(result, dict) and 'transcription_url' in result:
                        transcription_url = result['transcription_url']

                    if transcription_url:
                        # 获取转录结果文件内容
                        import requests
                        logger.info(f"获取转录结果: {transcription_url[:80]}...")
                        resp = requests.get(transcription_url)
                        if resp.status_code == 200:
                            data = resp.json()
                            logger.info(f"转录结果 JSON: {data}")
                            # 解析转录结果 JSON
                            if 'transcripts' in data:
                                for t in data['transcripts']:
                                    if 'text' in t:
                                        transcripts.append(t['text'])
                                    # 解析 sentences 时间戳
                                    if 'sentences' in t:
                                        for s in t['sentences']:
                                            all_sentences.append({
                                                'id': s.get('sentence_id', len(all_sentences) + 1),
                                                'text': s.get('text', ''),
                                                'start': s.get('begin_time', 0),
                                                'end': s.get('end_time', 0)
                                            })
                            elif 'text' in data:
                                transcripts.append(data['text'])
                        else:
                            logger.error(f"获取转录结果失败: {resp.status_code}")
                return ''.join(transcripts), all_sentences

            # 尝试直接获取文本
            if hasattr(output, 'text'):
                return output.text, []

            logger.warning(f"无法解析 ASR 结果: {output}")
            return "", []

        except Exception as e:
            logger.error(f"解析 ASR 结果失败: {e}")
            return "", []

    async def transcribe_audio_bytes(
        self,
        audio_data: bytes,
        context_text: Optional[str] = None,
        language: str = "zh",
        sample_rate: int = 16000,
        persist_audio: bool = False,
        on_progress: Optional[Any] = None
    ) -> tuple:
        """
        异步转录音频字节数据（兼容现有接口）

        Args:
            audio_data: WAV 音频字节数据
            context_text: 上下文文本（暂未使用）
            language: 语言代码（暂未使用）
            sample_rate: 采样率
            persist_audio: 是否持久化保存音频到 OSS
            on_progress: 进度回调（暂未使用）

        Returns:
            tuple: (ASRResult, (oss_key, oss_url) 或 None)
        """
        import asyncio
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self.transcribe_audio_bytes_sync(audio_data, sample_rate, persist_audio)
        )


def build_context_text(
    resume_text: Optional[str] = None,
    jd_text: Optional[str] = None,
    question: Optional[str] = None
) -> str:
    """
    构建ASR上下文增强文本（保留兼容性）

    Args:
        resume_text: 简历文本
        jd_text: 职位描述
        question: 当前面试问题

    Returns:
        格式化的上下文文本
    """
    parts = []

    if resume_text:
        parts.append(f"面试候选人背景：\n{resume_text[:2000]}")

    if jd_text:
        parts.append(f"目标职位要求：\n{jd_text[:2000]}")

    if question:
        parts.append(f"面试问题：\n{question}")

    return "\n\n".join(parts)


# 全局 ASR 服务实例
asr_service = ASRService()
