"""
Supervisor 交互式测试工具

用于测试 Supervisor 节点的意图识别准确率和路由决策质量。
支持交互式输入，显示完整的 LLM 响应和路由结果。
"""

import asyncio
import sys
import os
import time
import json
from datetime import datetime

# 设置 UTF-8 编码（Windows 兼容）
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agents.supervisor import supervisor_agent, supervisor_llm
from agents.state import create_initial_state
from config import settings


# 全局变量：用于捕获 LLM 原始响应
llm_raw_response = None


async def intercepted_chat_completion(*args, **kwargs):
    """拦截 LLM 调用，捕获原始响应"""
    global llm_raw_response
    original_method = supervisor_llm.__class__.chat_completion
    response = await original_method(supervisor_llm, *args, **kwargs)
    llm_raw_response = response
    return response


def print_welcome():
    """打印欢迎信息"""
    print("=" * 60)
    print("Supervisor 交互式测试工具")
    print("=" * 60)
    print()
    print("配置信息:")
    print(f"  - 模型: {settings.qwen_supervisor_model}")
    print(f"  - API: {settings.qwen_base_url}")
    print()
    print("使用说明:")
    print("  - 输入问题后按回车查看 Supervisor 的路由决策")
    print("  - 输入 'quit' 或 'exit' 退出")
    print("  - 输入 'reset' 重置上下文状态")
    print("  - 输入 'stats' 显示统计信息")
    print("  - 支持连续对话测试（保持 current_mode 和 current_question）")
    print()
    print("=" * 60)
    print()


def print_results(user_input, context_state, result_state, elapsed_time, parsed_json):
    """打印测试结果"""
    print()
    print("=" * 60)
    print("[测试结果]")
    print("=" * 60)
    print()
    print(f"用户输入: {user_input}")
    print(f"当前上下文: mode={context_state.get('current_mode', 'idle')}, "
          f"question={context_state.get('current_question', 'None')}")
    print()

    # LLM 原始响应
    print("--- LLM 原始响应 (JSON) ---")
    if parsed_json:
        print(json.dumps(parsed_json, indent=4, ensure_ascii=False))
    else:
        print("(无法解析 JSON)")
        print(f"原始响应: {llm_raw_response}")
    print()

    # 路由决策结果
    print("--- 路由决策结果 ---")

    if parsed_json:
        intent = parsed_json.get("intent", "未知")
        print(f"✓ 意图识别: {intent}")

    next_agent = result_state.get("next_agent", "未知")
    print(f"✓ 路由目标: {next_agent}")

    extracted_question = result_state.get("current_question")
    if extracted_question:
        print(f"✓ 提取的问题: {extracted_question}")

    response_text = result_state.get("response_text")
    if response_text:
        # 截断过长的回复
        display_text = response_text if len(response_text) <= 60 else response_text[:60] + "..."
        print(f"✓ 直接回复: {display_text}")

    # 模式变化
    old_mode = context_state.get("current_mode", "idle")
    new_mode = result_state.get("current_mode", old_mode)
    if old_mode != new_mode:
        print(f"✓ 模式切换: {old_mode} → {new_mode}")
    else:
        print(f"✓ 模式保持: {new_mode}")

    print(f"✓ 响应时间: {elapsed_time:.2f}s")
    print()
    print("=" * 60)
    print()


def print_stats(stats):
    """打印统计信息"""
    print()
    print("=" * 60)
    print("[统计信息]")
    print("=" * 60)
    print(f"  - 总测试次数: {stats['total_tests']}")
    print(f"  - 总耗时: {stats['total_time']:.2f}s")
    if stats['total_tests'] > 0:
        print(f"  - 平均响应时间: {stats['total_time']/stats['total_tests']:.2f}s")
    print(f"  - JSON 解析成功率: {stats['json_success']}/{stats['total_tests']}")
    print("=" * 60)
    print()


async def main():
    """主函数"""
    # Monkey patch LLM 调用
    supervisor_llm.chat_completion = intercepted_chat_completion

    # 打印欢迎信息
    print_welcome()

    # 上下文状态
    context_state = {
        "current_mode": "idle",
        "current_question": None
    }

    # 统计信息
    stats = {
        "total_tests": 0,
        "total_time": 0.0,
        "json_success": 0
    }

    # 主循环
    while True:
        try:
            # 获取用户输入
            user_input = input("请输入测试问题: ").strip()

            if not user_input:
                continue

            # 处理快捷命令
            if user_input.lower() in ['quit', 'exit']:
                print("\n再见！")
                break

            if user_input.lower() == 'reset':
                context_state = {
                    "current_mode": "idle",
                    "current_question": None
                }
                print("\n✓ 上下文已重置")
                continue

            if user_input.lower() == 'stats':
                print_stats(stats)
                continue

            # 构造状态
            state = create_initial_state(
                session_id="test-session",
                project_id=None,
                resume_text=None,
                jd_text=None,
                practice_questions=None
            )

            # 更新用户输入和上下文
            state["user_input"] = user_input
            state["input_type"] = "text"
            state["current_mode"] = context_state.get("current_mode", "idle")
            state["current_question"] = context_state.get("current_question")

            # 重置全局变量
            global llm_raw_response
            llm_raw_response = None

            # 调用 Supervisor.route()
            start_time = time.time()
            result_state = await supervisor_agent.route(state)
            elapsed_time = time.time() - start_time

            # 解析 JSON 响应
            parsed_json = None
            if llm_raw_response:
                try:
                    # 尝试提取 JSON
                    response_text = llm_raw_response.strip()
                    if response_text.startswith("```json"):
                        response_text = response_text[7:]
                    if response_text.startswith("```"):
                        response_text = response_text[3:]
                    if response_text.endswith("```"):
                        response_text = response_text[:-3]

                    parsed_json = json.loads(response_text.strip())
                    stats['json_success'] += 1
                except json.JSONDecodeError:
                    pass

            # 更新统计
            stats['total_tests'] += 1
            stats['total_time'] += elapsed_time

            # 打印结果
            print_results(user_input, context_state, result_state, elapsed_time, parsed_json)

            # 更新上下文
            context_state["current_mode"] = result_state.get("current_mode", "idle")
            context_state["current_question"] = result_state.get("current_question")

        except KeyboardInterrupt:
            print("\n\n用户中断，退出...")
            break
        except Exception as e:
            print(f"\n✗ 错误: {e}")
            import traceback
            traceback.print_exc()
            continue

    # 显示最终统计
    if stats['total_tests'] > 0:
        print_stats(stats)


if __name__ == "__main__":
    asyncio.run(main())
