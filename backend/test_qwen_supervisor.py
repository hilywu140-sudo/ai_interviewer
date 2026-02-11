"""
测试千问 Supervisor 集成

验证 Supervisor 节点是否正确使用千问模型
"""

import asyncio
import sys
import os
import time

SUPERVISOR_SYSTEM_PROMPT = """你是一个面试助手的路由器，负责理解用户意图并决定由哪个专门的助手来处理。

你有两个专门的助手可以调用：
1. **interviewer** - 面试官助手：负责语音练习，包括录音、转录和STAR框架分析
2. **chat** - 对话助手：负责答案优化、问题调研、简历优化等面试相关的对话

你的职责：
- 分析用户的输入
- 判断用户意图
- 决定调用哪个助手，或者直接回复
- 当用户想练习时，从输入中提取具体的面试问题

重要限制：
- 只处理与面试准备相关的请求
- 对于与面试无关的问题（如闲聊、其他领域问题），礼貌拒绝
"""

SUPERVISOR_ROUTING_PROMPT = """根据用户的输入，判断应该由哪个助手处理。

当前问题: {ueser_input}

请分析用户意图，返回以下JSON格式：
{{
    "intent": "语音练习/答案优化/问题调研/简历优化/无关问题/简单回复",
    "next_agent": "interviewer/chat/end",
    "extracted_question": "如果是语音练习，从用户输入中提取的具体面试问题（可选）",
    "response": "如果next_agent是end，这里填写直接回复的内容",
    "reasoning": "简要说明判断理由"
}}

路由规则：
1. 语音练习相关（"我想练习"、"开始模拟"、"用语音回答"、"练习xxx问题"）→ interviewer
   - 如果用户说"我想练习项目经验"，提取问题为"请介绍一个你主导的项目"
   - 如果用户说"我想练习自我介绍"，提取问题为"请做一个简短的自我介绍"
   - 如果用户说"练习：为什么选择我们公司"，提取问题为"为什么选择我们公司"
   - 如果用户直接说一个面试问题（如"请介绍你的项目经验"），也路由到 interviewer
2. 面试辅助相关（"帮我优化"、"怎么回答"、"优化简历"、"分析一下"）→ chat
3. 与面试无关的问题 → end，response填写："我是面试助手，只能帮助你准备面试相关的问题。你可以让我帮你练习面试问题、优化回答或者分析简历。"
4. 简单问候/确认（"你好"、"谢谢"、"好的"）→ end，response填写友好的回复

只返回JSON，不要其他内容。
"""

# 设置 UTF-8 编码（Windows 兼容）
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agents.supervisor import supervisor_llm
from config import settings


async def test_qwen_supervisor():
    """测试千问 Supervisor"""

    print("=" * 60)
    print("测试千问 Supervisor 集成")
    print("=" * 60)

    # 检查配置
    print(f"\n配置信息:")
    print(f"  - Qwen Base URL: {settings.qwen_base_url}")
    print(f"  - Qwen Model: {settings.qwen_supervisor_model}")
    print(f"  - API Key: {'已设置' if settings.qwen_api_key or settings.dashscope_api_key else '未设置'}")

    # 测试简单的意图识别
    test_cases = [
        "我想练习自我介绍",
        "帮我优化一下这个答案",
        "今天天气怎么样？"
    ]

    print(f"\n开始测试 {len(test_cases)} 个用例...")

    total_time = 0
    for i, user_input in enumerate(test_cases, 1):
        print(f"\n[测试 {i}/{len(test_cases)}]")
        print(f"用户输入: {user_input}")

        try:
            # 构造简单的提示
            messages = [
                {
                    "role": "system",
                    "content": SUPERVISOR_SYSTEM_PROMPT
                },
                {
                    "role": "user",
                    "content": SUPERVISOR_ROUTING_PROMPT
                }
            ]

            # 调用千问 API（计时）
            start_time = time.time()
            response = await supervisor_llm.chat_completion(
                messages=messages,
                temperature=0.1
            )
            elapsed_time = time.time() - start_time
            total_time += elapsed_time

            print(f"\n千问完整响应:")
            print("-" * 60)
            print(response)
            print("-" * 60)
            print(f"响应时间: {elapsed_time:.2f}s")
            print("✓ 测试通过")

        except Exception as e:
            print(f"✗ 测试失败: {e}")
            return False

    print("\n" + "=" * 60)
    print("所有测试通过！千问 Supervisor 集成成功")
    print("=" * 60)
    print(f"\n性能统计:")
    print(f"  - 总测试用例: {len(test_cases)}")
    print(f"  - 总耗时: {total_time:.2f}s")
    print(f"  - 平均响应时间: {total_time/len(test_cases):.2f}s")
    return True


if __name__ == "__main__":
    success = asyncio.run(test_qwen_supervisor())
    sys.exit(0 if success else 1)
