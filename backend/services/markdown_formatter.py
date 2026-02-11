"""
Markdown 格式化服务

将文本格式化为易读的 Markdown 格式。
"""

import re
from typing import Optional


def format_transcript(text: str) -> str:
    """
    将逐字稿格式化为 Markdown 格式

    主要功能：
    1. 保持原有段落结构
    2. 对长段落进行合理分段
    3. 确保段落之间有空行

    Args:
        text: 原始文本

    Returns:
        格式化后的 Markdown 文本
    """
    if not text:
        return ""

    # 1. 标准化换行符
    text = text.replace('\r\n', '\n').replace('\r', '\n')

    # 2. 按现有段落分割（连续两个以上换行）
    paragraphs = re.split(r'\n{2,}', text)

    formatted_paragraphs = []
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        # 3. 如果段落很长（超过 300 字）且没有换行，尝试按句子分段
        if len(para) > 300 and '\n' not in para:
            para = _split_long_paragraph(para)

        formatted_paragraphs.append(para)

    # 4. 用双换行连接段落
    result = '\n\n'.join(formatted_paragraphs)

    return result


def _split_long_paragraph(text: str) -> str:
    """
    将长段落按句子分成多个小段落

    策略：每 2-3 句话分一段
    """
    # 按句号、问号、感叹号分割（保留分隔符）
    sentences = re.split(r'([。！？.!?])', text)

    # 重新组合句子（句号和前面的内容组合）
    combined = []
    current = ""
    for i, part in enumerate(sentences):
        current += part
        # 如果是标点符号，结束当前句子
        if part in '。！？.!?':
            combined.append(current)
            current = ""

    # 添加剩余内容
    if current.strip():
        combined.append(current)

    # 每 2-3 句话组成一段
    paragraphs = []
    current_para = []
    sentence_count = 0

    for sentence in combined:
        sentence = sentence.strip()
        if not sentence:
            continue
        current_para.append(sentence)
        sentence_count += 1

        # 每 2-3 句话分一段
        if sentence_count >= 2 and len(''.join(current_para)) > 100:
            paragraphs.append(''.join(current_para))
            current_para = []
            sentence_count = 0

    # 添加剩余句子
    if current_para:
        paragraphs.append(''.join(current_para))

    return '\n\n'.join(paragraphs)


def format_optimized_answer(text: str) -> str:
    """
    格式化优化后的答案

    AI 生成的优化答案通常已经有较好的结构，
    主要确保段落分隔正确。

    Args:
        text: 优化后的答案文本

    Returns:
        格式化后的 Markdown 文本
    """
    if not text:
        return ""

    # 标准化换行符
    text = text.replace('\r\n', '\n').replace('\r', '\n')

    # 确保段落之间有空行
    # 将单个换行后跟文字的情况改为双换行（除非是列表项）
    lines = text.split('\n')
    result_lines = []

    for i, line in enumerate(lines):
        result_lines.append(line)

        # 如果当前行有内容，下一行也有内容，且下一行不是列表项
        if (i < len(lines) - 1 and
            line.strip() and
            lines[i + 1].strip() and
            not lines[i + 1].strip().startswith(('-', '*', '•', '1.', '2.', '3.'))):
            # 检查是否已经有空行
            if line.strip() and not line.strip().endswith(':'):
                result_lines.append('')  # 添加空行

    return '\n'.join(result_lines)
