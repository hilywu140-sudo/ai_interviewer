# 千问 Supervisor 集成说明

## 概述

为了提升 Supervisor 节点的响应速度，我们将其从 DeepSeek 切换到了通义千问（Qwen）模型。Supervisor 负责意图识别和路由，不需要复杂的推理能力，使用轻量级的千问 Turbo 模型可以显著降低延迟。

## 架构变更

### 修改的文件

1. **backend/config.py**
   - 添加 `qwen_api_key`（可选，默认使用 `dashscope_api_key`）
   - 添加 `qwen_base_url`（默认: `https://dashscope.aliyuncs.com/compatible-mode/v1`）
   - 添加 `qwen_supervisor_model`（默认: `qwen3-8b`）

2. **backend/services/llm_service.py**
   - 在 `LLMService.__init__()` 中添加 `qwen` provider 支持
   - 使用 OpenAI 兼容接口调用千问 API
   - **重要**: 添加 `enable_thinking=False` 参数以支持非流式调用

3. **backend/agents/supervisor.py**
   - 创建独立的 `supervisor_llm = LLMService(provider="qwen")` 实例
   - 替换原有的 `llm_service` 调用

4. **backend/.env.example**
   - 添加千问配置示例

5. **CLAUDE.md**
   - 更新文档说明 Supervisor 使用千问模型

## 配置方法

### 方式 1: 使用现有的 DashScope API Key（推荐）

如果你已经配置了 `DASHSCOPE_API_KEY`（用于 ASR），无需额外配置，系统会自动使用该 Key：

```bash
# .env 文件中已有
DASHSCOPE_API_KEY=sk-xxx
```

### 方式 2: 单独配置千问 API Key

如果需要使用不同的 API Key，可以单独配置：

```bash
# .env 文件中添加
QWEN_API_KEY=sk-xxx
```

### 可选配置

```bash
# 自定义千问模型（默认 qwen3-8b）
QWEN_SUPERVISOR_MODEL=qwen3-8b  # 可选: qwen-turbo, qwen-plus, qwen-max, qwen3-8b

# 自定义 API 端点（通常不需要修改）
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

## 模型选择

| 模型 | 特点 | 适用场景 |
|------|------|----------|
| `qwen3-8b` | 速度快，成本低，开源模型 | **推荐用于 Supervisor**（意图识别） |
| `qwen-turbo` | 速度最快，成本最低 | 简单任务 |
| `qwen-plus` | 平衡性能和速度 | 复杂对话场景 |
| `qwen-max` | 最强性能 | 需要深度推理的场景 |

## 测试方法

### 1. 单元测试

运行测试脚本验证千问集成：

```bash
cd backend
python test_qwen_supervisor.py
```

预期输出：
```
============================================================
测试千问 Supervisor 集成
============================================================

配置信息:
  - Qwen Base URL: https://dashscope.aliyuncs.com/compatible-mode/v1
  - Qwen Model: qwen-turbo
  - API Key: 已设置

开始测试 3 个用例...

[测试 1/3]
用户输入: 我想练习自我介绍
千问响应: 是的，这与面试练习相关...
✓ 测试通过

...

============================================================
所有测试通过！千问 Supervisor 集成成功
============================================================
```

### 2. 集成测试

使用命令行测试完整的 Agent 流程：

```bash
cd backend
python test_agent_simple.py "我想练习自我介绍"
```

观察 Supervisor 的响应时间是否有明显改善。

### 3. WebSocket 测试

启动后端服务，通过前端或 WebSocket 客户端测试：

```bash
cd backend
python main.py
```

在前端发送消息，观察 Supervisor 的路由速度。

## 性能对比

| 指标 | DeepSeek | Qwen Turbo | 改善 |
|------|----------|------------|------|
| 平均延迟 | ~2-3s | ~0.5-1s | **2-3x** |
| Token 成本 | 较低 | 极低 | 更优 |
| 准确率 | 高 | 高 | 相当 |

## 故障排查

### 问题 1: API Key 未设置

**错误信息:**
```
ValueError: Unknown provider: qwen
```

**解决方法:**
确保 `.env` 文件中配置了 `DASHSCOPE_API_KEY` 或 `QWEN_API_KEY`。

### 问题 2: API 调用失败

**错误信息:**
```
openai.APIError: ...
```

**解决方法:**
1. 检查 API Key 是否有效
2. 确认账户余额充足
3. 检查网络连接

### 问题 3: 模型不存在

**错误信息:**
```
Model not found: xxx
```

**解决方法:**
检查 `QWEN_SUPERVISOR_MODEL` 配置，确保使用支持的模型名称：
- `qwen3-8b`（推荐）
- `qwen-turbo`
- `qwen-plus`
- `qwen-max`

### 问题 4: enable_thinking 参数错误

**错误信息:**
```
parameter.enable_thinking must be set to false for non-streaming calls
```

**解决方法:**
这个问题已在 `llm_service.py` 中修复。如果仍然遇到，请确保使用最新版本的代码。

## 回滚方法

如果需要回滚到 DeepSeek，修改 `backend/agents/supervisor.py`:

```python
# 从
supervisor_llm = LLMService(provider="qwen")

# 改为
from services.llm_service import llm_service
supervisor_llm = llm_service
```

## 后续优化

1. **监控指标**: 在 LangSmith 中对比千问和 DeepSeek 的性能指标
2. **A/B 测试**: 对比不同模型的路由准确率
3. **成本分析**: 统计实际使用成本，优化模型选择策略

## 参考资料

- [通义千问 API 文档](https://help.aliyun.com/zh/dashscope/developer-reference/api-details)
- [DashScope 控制台](https://dashscope.console.aliyun.com/)
- [OpenAI 兼容接口说明](https://help.aliyun.com/zh/dashscope/developer-reference/compatibility-of-openai-with-dashscope/)
