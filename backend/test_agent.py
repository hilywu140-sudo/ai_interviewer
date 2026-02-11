"""
命令行测试 LangGraph Agent

使用方法:
    cd backend
    python test_agent.py
"""

import asyncio
import sys
from uuid import uuid4

# 添加当前目录到路径
sys.path.insert(0, '.')

async def main():
    # 导入必要模块
    from agents.graph import process_message

    print("=" * 50)
    print("AI 面试助手 - 命令行测试")
    print("=" * 50)
    print("\n输入 'quit' 或 'exit' 退出")
    print("输入 'help' 查看帮助")
    print("\n示例输入:")
    print("  - 我想练习'请介绍一个你主导的项目'")
    print("  - 帮我优化这个回答：在上一家公司...")
    print("  - 这个问题怎么回答：你的优缺点是什么")
    print("=" * 50)

    # 生成会话ID
    session_id = str(uuid4())
    print(f"\n会话ID: {session_id[:8]}...")

    # 模拟项目数据
    resume_text = """
    张三
    软件工程师 | 5年经验

    工作经历:
    - ABC科技公司 (2020-至今): 高级后端工程师
      - 主导了用户系统重构，性能提升50%
      - 设计并实现了微服务架构

    - XYZ互联网 (2018-2020): 后端工程师
      - 参与电商平台开发
      - 负责订单系统维护

    技能: Python, Java, MySQL, Redis, Docker
    """

    jd_text = """
    高级后端工程师

    职责:
    - 负责核心系统架构设计
    - 带领团队完成项目交付
    - 优化系统性能

    要求:
    - 5年以上后端开发经验
    - 熟悉分布式系统
    - 良好的沟通能力
    """

    practice_questions = [
        "请介绍一个你主导的项目",
        "你遇到过最大的技术挑战是什么",
        "你的优缺点是什么"
    ]

    while True:
        try:
            # 获取用户输入
            user_input = input("\n你: ").strip()

            if not user_input:
                continue

            if user_input.lower() in ['quit', 'exit', 'q']:
                print("\n再见！")
                break

            if user_input.lower() == 'help':
                print("\n可用命令:")
                print("  quit/exit/q - 退出程序")
                print("  help - 显示帮助")
                print("\n你可以输入任何面试相关的问题，例如:")
                print("  - 我想练习xxx问题")
                print("  - 帮我优化这个回答")
                print("  - 这个问题怎么回答")
                continue

            # 调用 Agent 处理
            print("\nAI正在思考...")

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

            # 显示结果
            response_type = result.get("response_type", "message")
            response_text = result.get("response_text", "")

            print(f"\nAI ({response_type}):")
            print("-" * 40)
            print(response_text)

            # 如果是录音开始，显示额外信息
            if response_type == "recording_start":
                metadata = result.get("response_metadata", {})
                question = metadata.get("question", "")
                print(f"\n[等待录音] 问题: {question}")
                print("(命令行模式无法录音，请使用前端界面)")

            # 如果有反馈，显示详情
            if result.get("feedback"):
                feedback = result["feedback"]
                print(f"\n[STAR分析] 总分: {feedback.get('overall_score', 0)}")

        except KeyboardInterrupt:
            print("\n\n已中断")
            break
        except Exception as e:
            print(f"\n错误: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
