"""
非交互式测试 LangGraph Agent

使用方法:
    cd backend
    python test_agent_simple.py "我想练习请介绍一个你主导的项目"
"""

import asyncio
import sys
from uuid import uuid4

# 添加当前目录到路径
sys.path.insert(0, '.')

async def test_message(user_input: str):
    """测试单条消息"""
    from agents.graph import process_message

    print("=" * 50)
    print("AI 面试助手 - 单次测试")
    print("=" * 50)

    session_id = str(uuid4())
    print(f"会话ID: {session_id[:8]}...")
    print(f"用户输入: {user_input}")
    print("-" * 50)

    # 模拟项目数据
    resume_text = """
    张三 - 软件工程师 | 5年经验
    工作经历:
    - ABC科技公司 (2020-至今): 高级后端工程师，主导用户系统重构
    - XYZ互联网 (2018-2020): 后端工程师，参与电商平台开发
    技能: Python, Java, MySQL, Redis, Docker
    """

    jd_text = """
    高级后端工程师
    职责: 负责核心系统架构设计，带领团队完成项目交付
    要求: 5年以上后端开发经验，熟悉分布式系统
    """

    practice_questions = [
        "请介绍一个你主导的项目",
        "你遇到过最大的技术挑战是什么",
        "你的优缺点是什么"
    ]

    print("正在调用 Agent...")

    try:
        result = await process_message(
            session_id=session_id,
            user_input=user_input,
            input_type="text",
            audio_data=None,
            resume_text=resume_text,
            jd_text=jd_text,
            practice_questions=practice_questions,
            project_id=None
        )

        print("\n" + "=" * 50)
        print("响应结果:")
        print("=" * 50)
        print(f"类型: {result.get('response_type', 'unknown')}")
        print(f"模式: {result.get('current_mode', 'unknown')}")
        print("-" * 50)
        print("内容:")
        print(result.get('response_text', '(无内容)'))

        if result.get('response_metadata'):
            print("-" * 50)
            print(f"元数据: {result.get('response_metadata')}")

        if result.get('feedback'):
            print("-" * 50)
            print(f"反馈: {result.get('feedback')}")

    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # 默认测试消息
    test_input = "我想练习请介绍一个你主导的项目"

    # 如果有命令行参数，使用参数
    if len(sys.argv) > 1:
        test_input = " ".join(sys.argv[1:])

    asyncio.run(test_message(test_input))
