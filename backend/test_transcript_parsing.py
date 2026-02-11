"""
测试 ASR 转录结果解析功能

测试将阿里云 Transcription API 返回的 JSON 解析为带时间戳的句子列表
"""

import json
import sys
import io
from typing import List, Dict, Any

# 设置 stdout 编码为 utf-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# 模拟的转录结果 JSON（来自实际 API 返回）
SAMPLE_TRANSCRIPTION_JSON = {
    'file_url': 'https://ai-interview-coach.oss-cn-beijing.aliyuncs.com/audio/test.wav',
    'properties': {
        'audio_format': 'pcm_s16le',
        'channels': [0],
        'original_sampling_rate': 16000,
        'original_duration_in_milliseconds': 32820
    },
    'transcripts': [{
        'channel_id': 0,
        'content_duration_in_milliseconds': 27440,
        'text': '接下来我将和大家分享我在选股相关工作工作中的实践与思考。整体围绕定义、价值问题、解法、效果及复盘展开，核心是解决选股精准度的核心痛点。首先关于选股的定义，我理解的选股是基于用户投资目标、风险偏好，结合行业景气度、个股基本面等多维度，从全市场股票之中筛选符合标准、具备潜在空间的个股。过程本质是价值识别加风险匹配，是衔接投资的策略与实际实施的。核心环节。',
        'sentences': [
            {
                'begin_time': 4350,
                'end_time': 9150,
                'text': '接下来我将和大家分享我在选股相关工作工作中的实践与思考。',
                'sentence_id': 1
            },
            {
                'begin_time': 9270,
                'end_time': 15670,
                'text': '整体围绕定义、价值问题、解法、效果及复盘展开，核心是解决选股精准度的核心痛点。',
                'sentence_id': 2
            },
            {
                'begin_time': 15750,
                'end_time': 26350,
                'text': '首先关于选股的定义，我理解的选股是基于用户投资目标、风险偏好，结合行业景气度、个股基本面等多维度，从全市场股票之中筛选符合标准、具备潜在空间的个股。',
                'sentence_id': 3
            },
            {
                'begin_time': 26750,
                'end_time': 31990,
                'text': '过程本质是价值识别加风险匹配，是衔接投资的策略与实际实施的。',
                'sentence_id': 4
            },
            {
                'begin_time': 32360,
                'end_time': 32760,
                'text': '核心环节。',
                'sentence_id': 5
            }
        ]
    }]
}


def parse_transcription_json(data: dict) -> tuple[str, List[Dict[str, Any]]]:
    """
    解析转录结果 JSON，提取文本和带时间戳的句子列表

    这是从 asr_service.py 中提取的核心解析逻辑

    Args:
        data: 转录结果 JSON 字典

    Returns:
        tuple: (完整文本, 句子列表)
            句子列表格式: [{'id': int, 'text': str, 'start': int, 'end': int}, ...]
    """
    transcripts = []
    all_sentences = []

    if 'transcripts' in data:
        for t in data['transcripts']:
            # 提取完整文本
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
        # 兼容简单格式
        transcripts.append(data['text'])

    return ''.join(transcripts), all_sentences


def format_timestamp(ms: int) -> str:
    """毫秒转 MM:SS 格式"""
    total_seconds = ms // 1000
    minutes = total_seconds // 60
    seconds = total_seconds % 60
    return f"{minutes:02d}:{seconds:02d}"


def display_sentences_with_timestamps(sentences: List[Dict[str, Any]]) -> None:
    """格式化显示带时间戳的句子"""
    print("\n" + "=" * 60)
    print("带时间戳的逐字稿")
    print("=" * 60)

    for s in sentences:
        start_ts = format_timestamp(s['start'])
        end_ts = format_timestamp(s['end'])
        print(f"\n[{start_ts} - {end_ts}] (句子 {s['id']})")
        print(f"  {s['text']}")


def test_parse_transcription():
    """测试解析转录结果"""
    print("\n" + "=" * 60)
    print("测试 1: 解析标准转录结果 JSON")
    print("=" * 60)

    transcript, sentences = parse_transcription_json(SAMPLE_TRANSCRIPTION_JSON)

    print(f"\n完整文本 ({len(transcript)} 字符):")
    print(f"  {transcript[:100]}...")

    print(f"\n句子数量: {len(sentences)}")

    # 验证句子数量
    assert len(sentences) == 5, f"期望 5 个句子，实际 {len(sentences)} 个"

    # 验证第一个句子
    first = sentences[0]
    assert first['id'] == 1
    assert first['start'] == 4350
    assert first['end'] == 9150
    assert '选股' in first['text']

    print("\n[PASS] 句子解析正确")

    # 显示带时间戳的句子
    display_sentences_with_timestamps(sentences)

    return sentences


def test_empty_transcription():
    """测试空转录结果"""
    print("\n" + "=" * 60)
    print("测试 2: 空转录结果")
    print("=" * 60)

    empty_data = {'transcripts': []}
    transcript, sentences = parse_transcription_json(empty_data)

    assert transcript == ""
    assert sentences == []
    print("\n[PASS] 空结果处理正确")


def test_no_sentences():
    """测试没有句子时间戳的情况"""
    print("\n" + "=" * 60)
    print("测试 3: 只有文本，没有句子时间戳")
    print("=" * 60)

    data_without_sentences = {
        'transcripts': [{
            'text': '这是一段测试文本。',
            'channel_id': 0
        }]
    }

    transcript, sentences = parse_transcription_json(data_without_sentences)

    assert transcript == '这是一段测试文本。'
    assert sentences == []
    print(f"\n文本: {transcript}")
    print("[PASS] 无句子时间戳处理正确")


def test_simple_format():
    """测试简单格式（直接包含 text 字段）"""
    print("\n" + "=" * 60)
    print("测试 4: 简单格式（直接 text 字段）")
    print("=" * 60)

    simple_data = {'text': '简单格式的文本内容'}

    transcript, sentences = parse_transcription_json(simple_data)

    assert transcript == '简单格式的文本内容'
    assert sentences == []
    print(f"\n文本: {transcript}")
    print("[PASS] 简单格式处理正确")


def test_multiple_channels():
    """测试多通道转录"""
    print("\n" + "=" * 60)
    print("测试 5: 多通道转录")
    print("=" * 60)

    multi_channel_data = {
        'transcripts': [
            {
                'channel_id': 0,
                'text': '第一通道内容。',
                'sentences': [
                    {'sentence_id': 1, 'text': '第一通道内容。', 'begin_time': 0, 'end_time': 2000}
                ]
            },
            {
                'channel_id': 1,
                'text': '第二通道内容。',
                'sentences': [
                    {'sentence_id': 1, 'text': '第二通道内容。', 'begin_time': 1000, 'end_time': 3000}
                ]
            }
        ]
    }

    transcript, sentences = parse_transcription_json(multi_channel_data)

    assert transcript == '第一通道内容。第二通道内容。'
    assert len(sentences) == 2
    print(f"\n合并文本: {transcript}")
    print(f"句子数量: {len(sentences)}")
    print("[PASS] 多通道处理正确")


def test_frontend_format():
    """测试前端期望的数据格式"""
    print("\n" + "=" * 60)
    print("测试 6: 验证前端期望的数据格式")
    print("=" * 60)

    _, sentences = parse_transcription_json(SAMPLE_TRANSCRIPTION_JSON)

    # 前端 TranscriptSentence 接口期望的字段
    required_fields = ['id', 'text', 'start', 'end']

    for s in sentences:
        for field in required_fields:
            assert field in s, f"缺少字段: {field}"

        # 验证类型
        assert isinstance(s['id'], int), f"id 应为 int，实际为 {type(s['id'])}"
        assert isinstance(s['text'], str), f"text 应为 str，实际为 {type(s['text'])}"
        assert isinstance(s['start'], int), f"start 应为 int，实际为 {type(s['start'])}"
        assert isinstance(s['end'], int), f"end 应为 int，实际为 {type(s['end'])}"

    print("\n前端期望格式:")
    print("  interface TranscriptSentence {")
    print("    id: number")
    print("    text: string")
    print("    start: number  // 毫秒")
    print("    end: number    // 毫秒")
    print("  }")

    print(f"\n实际数据示例:")
    print(f"  {json.dumps(sentences[0], ensure_ascii=False, indent=2)}")

    print("\n[PASS] 数据格式符合前端要求")


def run_all_tests():
    """运行所有测试"""
    print("\n" + "=" * 60)
    print("ASR 转录结果解析测试")
    print("=" * 60)

    try:
        test_parse_transcription()
        test_empty_transcription()
        test_no_sentences()
        test_simple_format()
        test_multiple_channels()
        test_frontend_format()

        print("\n" + "=" * 60)
        print("[PASS] 所有测试通过!")
        print("=" * 60)

    except AssertionError as e:
        print(f"\n[FAIL] 测试失败: {e}")
        raise
    except Exception as e:
        print(f"\n[ERROR] 测试出错: {e}")
        raise


if __name__ == "__main__":
    run_all_tests()
