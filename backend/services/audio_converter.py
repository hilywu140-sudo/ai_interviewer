"""
音频格式转换服务

将 WebM 格式转换为 WAV 格式，供 ASR 服务使用。
"""

import subprocess
import tempfile
import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def convert_webm_to_wav(webm_data: bytes, sample_rate: int = 16000) -> bytes:
    """
    将 WebM 音频转换为 WAV 格式

    Args:
        webm_data: WebM 格式的音频字节数据
        sample_rate: 目标采样率，默认 16000Hz

    Returns:
        WAV 格式的音频字节数据（16-bit, mono）
    """
    # 创建临时文件
    with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as webm_file:
        webm_file.write(webm_data)
        webm_path = webm_file.name

    wav_path = webm_path.replace('.webm', '.wav')

    try:
        # 使用 ffmpeg 转换为 WAV
        cmd = [
            'ffmpeg',
            '-i', webm_path,
            '-acodec', 'pcm_s16le',   # 16-bit PCM
            '-ar', str(sample_rate),   # 采样率
            '-ac', '1',                # 单声道
            '-y',                      # 覆盖输出文件
            wav_path
        ]

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode != 0:
            logger.error(f"ffmpeg 转换失败: {result.stderr}")
            raise RuntimeError(f"音频转换失败: {result.stderr}")

        # 读取 WAV 数据
        with open(wav_path, 'rb') as f:
            wav_data = f.read()

        logger.info(f"音频转换成功: {len(webm_data)} bytes WebM -> {len(wav_data)} bytes WAV")
        return wav_data

    except subprocess.TimeoutExpired:
        logger.error("ffmpeg 转换超时")
        raise RuntimeError("音频转换超时")
    except FileNotFoundError:
        logger.error("ffmpeg 未安装或不在 PATH 中")
        raise RuntimeError("ffmpeg 未安装，请先安装 ffmpeg")
    finally:
        # 清理临时文件
        if os.path.exists(webm_path):
            os.remove(webm_path)
        if os.path.exists(wav_path):
            os.remove(wav_path)


def is_webm_format(data: bytes) -> bool:
    """
    检测数据是否为 WebM 格式

    WebM 文件以 EBML header 开头，magic bytes: 1A 45 DF A3
    """
    if len(data) < 4:
        return False
    # WebM/Matroska magic bytes
    return data[:4] == b'\x1a\x45\xdf\xa3'


def is_wav_format(data: bytes) -> bool:
    """
    检测数据是否为 WAV 格式

    WAV 文件以 RIFF header 开头
    """
    if len(data) < 12:
        return False
    return data[:4] == b'RIFF' and data[8:12] == b'WAVE'


def convert_audio_if_needed(audio_data: bytes, sample_rate: int = 16000) -> bytes:
    """
    如果音频是 WebM 格式，转换为 WAV；否则直接返回

    Args:
        audio_data: 音频字节数据
        sample_rate: 目标采样率

    Returns:
        WAV 格式的音频数据
    """
    if is_webm_format(audio_data):
        logger.info("检测到 WebM 格式，开始转换为 WAV...")
        return convert_webm_to_wav(audio_data, sample_rate)
    elif is_wav_format(audio_data):
        logger.info("音频已是 WAV 格式，无需转换")
        return audio_data
    else:
        logger.warning("未知音频格式，尝试直接使用")
        return audio_data
