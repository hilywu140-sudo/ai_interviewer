# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Interview Coach - A personal AI interview preparation assistant that helps job seekers transform from "blind trial-and-error" to "precise success". The MVP focuses on validating feedback quality and answer rewriting capabilities.

**Tech Stack:**
- Backend: Python FastAPI + LangGraph + PostgreSQL
- Frontend: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- LLM: Multi-model support (DeepSeek for testing, GPT-4/Claude for production)
- ASR: Aliyun Speech Recognition

## Development Commands

### Backend (FastAPI)
```bash
cd backend

# Setup
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run development server (with auto-reload)
python main.py

# Access API docs
# http://localhost:8000/docs
```

### Frontend (Next.js)
```bash
cd frontend

# Setup
npm install

# Development
npm run dev          # Start dev server at http://localhost:3000
npm run build        # Production build
npm start            # Start production server
npm run lint         # Run ESLint
```

### Database
```bash
# Create database
createdb ai_interviewer

# Tables are auto-created on first run via SQLAlchemy
# See backend/main.py: Base.metadata.create_all(bind=engine)
```

## Architecture

### Backend Structure

**Core Pattern: Layered Architecture**
- `models/` - SQLAlchemy ORM models (5 tables: projects, sessions, messages, audio_files, assets)
- `schemas/` - Pydantic schemas for request/response validation
- `api/` - FastAPI route handlers (projects, sessions)
- `agents/` - LangGraph state machine and agent nodes (Phase 2+)
- `services/` - Business logic (PDF parsing, ASR, LLM calls)

**Database Models:**
- `Project`: Stores resume, JD, practice questions
- `Session`: Practice session linked to project
- `Message`: Conversation history with role, content, feedback (JSONB)
- `AudioFile`: Audio recordings with ASR status and results
- `Asset`: Optimized answers saved to user's library

**Key Files:**
- `main.py` - FastAPI app entry, auto-creates DB tables on startup
- `config.py` - Pydantic settings from `.env` (database, API keys)
- `database.py` - SQLAlchemy engine and `get_db()` dependency

### Frontend Structure

**Pattern: Next.js App Router (Server/Client Components)**
- `app/` - File-based routing with layouts
- `lib/api-client.ts` - Axios wrapper for backend API calls
- `lib/types.ts` - TypeScript interfaces matching backend schemas
- `components/` - Reusable React components (Phase 2+)

**API Proxy:** `next.config.js` rewrites `/api/*` to `http://localhost:8000/api/*`

### LangGraph Multi-Agent System (已实现)

**架构: Supervisor + SubAgents**
```
用户输入 → Supervisor (意图识别)
    ├→ "我想练习xxx" → Interviewer SubAgent → recording_start
    ├→ "帮我优化xxx" → Chat SubAgent → assistant_message
    └→ 无关问题 → 直接拒绝 → assistant_message
```

**Agent 节点:**
1. **Supervisor**: 分析用户意图，路由到对应 SubAgent（使用千问 Turbo 模型加速）
2. **Interviewer SubAgent**: 处理语音练习流程，返回 `recording_start` 提示录音
3. **Chat SubAgent**: 处理答案优化、问题调研等文本交互

**核心文件:**
- `agents/graph.py` - LangGraph 状态机定义和 `process_message()` 入口
- `agents/state.py` - 状态定义
- `agents/nodes/` - 各 Agent 节点实现

**命令行测试:**
```bash
cd backend
# 非交互式测试（推荐）
python test_agent_simple.py "我想练习请介绍一个你主导的项目"

# 交互式测试
python test_agent.py
```

### Frontend 组件架构 (已重构)

**统一练习室页面:** `/chat/[sessionId]`

```
app/chat/[sessionId]/page.tsx        # 主页面
├── components/chat/
│   ├── ChatHeader.tsx               # 顶部栏（连接状态、Agent状态）
│   ├── MessageList.tsx              # 消息列表
│   ├── ChatInput.tsx                # 输入区域
│   ├── AgentStatusBar.tsx           # AI思考状态（3点动画）
│   └── RecordingCard.tsx            # 录音卡片（自动弹出，手动开始）
├── hooks/
│   └── useChat.ts                   # 统一的聊天 Hook
└── lib/
    └── types.ts                     # 类型定义
```

**useChat Hook 状态:**
```typescript
interface ChatState {
  isConnected: boolean
  messages: ChatMessage[]
  agentStatus: 'idle' | 'thinking' | 'recording' | 'transcribing' | 'analyzing'
  currentAgent: 'supervisor' | 'interviewer' | 'chat' | null
  recordingState: { isActive: boolean, question: string | null, duration: number }
}
```

### WebSocket 协议 (简化版)

**客户端 → 服务端:**
```typescript
{ type: 'message', content: '文本内容', timestamp: '...' }
{ type: 'audio', audio_data: 'base64音频', timestamp: '...' }
```

**服务端 → 客户端:**
```typescript
// 普通消息
{ type: 'assistant_message', content: '...', agent_status: {...} }
{ type: 'recording_start', recording: { question: '...' }, agent_status: {...} }
{ type: 'transcription', transcription: { text: '...', is_final: true } }
{ type: 'feedback', feedback: { overall_score: 85, ... } }
{ type: 'error', error: '错误信息' }

// 流式消息（Chat SubAgent 输出）
{ type: 'assistant_message_stream_start', agent_status: {...}, timestamp: '...' }
{ type: 'assistant_message_chunk', content: '部分内容', timestamp: '...' }
{ type: 'assistant_message_stream_end', full_content: '完整内容', asset_id: '...', timestamp: '...' }
```

## Configuration

### Backend `.env` (required)
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/ai_interviewer

# LLM Providers
OPENAI_API_KEY=sk-...           # For GPT models
ANTHROPIC_API_KEY=sk-ant-...    # For Claude models
DEEPSEEK_API_KEY=sk-...         # For testing phase
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEFAULT_LLM_PROVIDER=deepseek   # 当前使用的 LLM 提供商

# Qwen (通义千问 - Supervisor 节点加速)
# 注意: 如果不设置 QWEN_API_KEY，会自动使用 DASHSCOPE_API_KEY
# QWEN_API_KEY=sk-...           # 可选，默认使用 DASHSCOPE_API_KEY
# QWEN_SUPERVISOR_MODEL=qwen3-8b  # 可选，默认 qwen3-8b (可选: qwen3-8b, qwen-turbo, qwen-plus, qwen-max)

# ASR (语音识别)
DASHSCOPE_API_KEY=sk-...        # 阿里云百炼平台 ASR
ALIYUN_ACCESS_KEY_ID=...
ALIYUN_ACCESS_KEY_SECRET=...
ALIYUN_OSS_BUCKET=...
ALIYUN_OSS_ENDPOINT=oss-cn-shanghai.aliyuncs.com

# LangSmith (LangGraph 监控)
LANGSMITH_API_KEY=lsv2_pt_...   # 从 https://smith.langchain.com/ 获取
LANGSMITH_PROJECT=ai-interviewer
LANGSMITH_TRACING=true          # 启用追踪

# Application
APP_ENV=development
SECRET_KEY=your-secret-key
CORS_ORIGINS=http://localhost:3000
```

### Frontend `.env.local`
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Development Phases

**Phase 1 (Complete):** Basic CRUD for projects/sessions, PDF parsing, frontend scaffolding

**Phase 2 (Complete):** LangGraph multi-agent integration, WebSocket real-time chat, Supervisor 意图路由

**Phase 3 (Current):** Audio recording (MediaRecorder API), ASR integration, 语音练习完整流程

**Phase 4:** Feedback generation (STAR analysis), answer rewriting (Markdown diff)

**Phase 5:** Asset library, performance optimization

## Key Design Decisions

1. **Multi-model LLM Strategy**: Use DeepSeek for testing, switch to GPT-4/Claude for production via config
2. **JSONB for Flexibility**: `chunks`, `feedback`, `asr_result` use JSONB to avoid schema migrations
3. **WebSocket for Real-time**: Chat uses WebSocket, file uploads use REST
4. **Context Budget Management**: Truncate resume/JD to fit token limits, prioritize recent messages
5. **Timestamp Granularity**: ASR returns sentence-level, LLM post-processes to "argument+explanation" chunks

## Important Patterns

### Adding New API Endpoints
1. Create route in `api/` with `APIRouter`
2. Define Pydantic schemas in `schemas/`
3. Use `Depends(get_db)` for database access
4. Register router in `main.py` with `app.include_router()`

### Frontend API Calls
```typescript
// Use api-client.ts wrappers
import { projectsApi } from '@/lib/api-client'
const project = await projectsApi.create({ title, jd_text })
```

### Database Queries
```python
# Use SQLAlchemy ORM with get_db() dependency
from database import get_db
from models import Project

def get_project(project_id: UUID, db: Session = Depends(get_db)):
    return db.query(Project).filter(Project.id == project_id).first()
```

## Testing Strategy

- **LLM Testing**: Use DeepSeek API during development (lower cost)
- **Production**: Evaluate and switch to GPT-4/Claude based on quality metrics
- **Model Switching**: Centralized in `services/llm_service.py` (to be implemented)

## Recent Development Log

### 2026-02-05: 练习记录交互优化 + 逐字稿载入功能

**完成的工作:**

1. **练习记录侧边栏交互优化**
   - 点击问题文字 → 查看 Asset 详情（打开 AssetDetailPanel）
   - 点击飞机按钮 → 载入逐字稿到输入框
   - `components/sidebar/ChatSidebar.tsx` 添加 `onSelectAsset` 回调和飞机图标按钮

2. **逐字稿载入输入框交互**
   - 点击载入按钮后，输入框显示：`根据[问题]和逐字稿，请输入你的需求`
   - 前缀部分不可删除，用户输入替换"请输入你的需求"
   - 快捷按钮点击时自动拼接前缀
   - 蓝色提示条显示"已载入逐字稿"，带取消按钮

3. **MessageContext 上下文传递**
   - `lib/types.ts` 定义 `MessageContext` 类型（question, transcript, asset_id）
   - `hooks/useChat.ts` 添加 `messageContext` 状态和 `setMessageContext` 方法
   - 发送消息时自动携带逐字稿内容到后端

4. **ChatInput 组件增强**
   - 支持前缀模式：当有 messageContext 时显示不可编辑前缀
   - 自动聚焦并选中"请输入你的需求"部分
   - 发送按钮仅在有额外内容时可用

**交互流程:**
```
1. 用户点击练习记录中的飞机按钮
   ↓
2. 输入框显示：「根据[为什么离职...]和逐字稿，请输入你的需求」
   ↓
3. 用户输入 "帮我优化" 或点击快捷按钮
   ↓
4. 输入框变为：「根据[为什么离职...]和逐字稿，帮我优化」
   ↓
5. 发送后，后端收到完整内容 + 逐字稿上下文
```

**关键文件变更:**
- `components/chat/ChatInput.tsx` - 前缀显示逻辑、上下文提示条
- `components/sidebar/ChatSidebar.tsx` - 飞机按钮、onSelectAsset 回调
- `app/chat/[sessionId]/page.tsx` - handleFillInput 只设置 context
- `hooks/useChat.ts` - messageContext 状态管理
- `lib/types.ts` - MessageContext 类型定义

---

### 2026-02-05: 流式输出重构 + 练习记录版本管理

**完成的工作:**

1. **Chat SubAgent 流式输出**
   - `services/llm_service.py` 添加 `chat_completion_stream()` 方法
   - `agents/subagents/chat.py` 所有输出改为流式（答案优化、问题调研、简历优化、通用对话）
   - 前端实现打字机效果显示

2. **答案优化 XML 标签格式**
   - `agents/prompts/chat.py` 修改 `ANSWER_OPTIMIZATION_PROMPT` 使用 XML 标签
   - 输出格式: `<analysis>分析</analysis><optimized>优化答案</optimized><reason>理由</reason>`
   - `extract_optimized_answer()` 函数提取 `<optimized>` 标签内容

3. **STAR 分析简化**
   - `agents/prompts/interviewer.py` 移除 `suggested_answer` 字段
   - 录音分析后只返回分析结果，不再自动生成优化答案
   - 用户需要优化时通过聊天请求"帮我优化这个回答"

4. **WebSocket 流式消息协议**
   - 新增消息类型: `assistant_message_stream_start`, `assistant_message_chunk`, `assistant_message_stream_end`
   - `api/websocket.py` 添加 `handle_stream_response()` 函数
   - 流式结束后自动保存 Asset 并返回 `asset_id`

5. **Asset 版本类型管理**
   - `models/asset.py` 添加 `version_type` 字段 ("recording" | "edited")
   - 录音转录保存为 "recording" 类型
   - 聊天优化保存为 "edited" 类型
   - 前端显示版本类型标签（蓝色=录音，绿色=优化）

6. **前端组件更新**
   - `hooks/useChat.ts` 添加流式消息处理和状态 (`isStreaming`, `streamingContent`)
   - `components/chat/MessageList.tsx` 实现打字机效果和编辑按钮
   - `components/chat/OptimizedAnswerEditor.tsx` **新建** 优化结果编辑弹窗
   - `components/FeedbackCard.tsx` 移除优化答案显示
   - `components/sidebar/AssetSidebar.tsx` 添加版本类型标签
   - `components/sidebar/AssetDetailPanel.tsx` 添加版本类型标签

**WebSocket 流式协议:**
```typescript
// 服务端 → 客户端（流式）
{ type: 'assistant_message_stream_start', agent_status: {...}, timestamp: '...' }
{ type: 'assistant_message_chunk', content: '部分内容', timestamp: '...' }
{ type: 'assistant_message_stream_end', full_content: '完整内容', asset_id: '...', timestamp: '...' }
```

**数据库迁移:**
```sql
ALTER TABLE assets ADD COLUMN version_type VARCHAR(20) DEFAULT 'recording';
UPDATE assets SET version_type = 'recording' WHERE version_type IS NULL;
```

**关键文件变更:**
- `services/llm_service.py` - 添加流式方法
- `agents/subagents/chat.py` - 流式输出 + XML 解析
- `agents/prompts/chat.py` - XML 标签格式
- `agents/prompts/interviewer.py` - 移除 suggested_answer
- `api/websocket.py` - 流式消息处理
- `models/asset.py` + `schemas/asset.py` - version_type 字段
- `hooks/useChat.ts` - 流式状态管理
- `components/chat/OptimizedAnswerEditor.tsx` - **新建**

### 2026-01-25: ASR 服务重构（使用 Transcription API）

**完成的工作:**

1. **ASR 服务架构变更**
   - 从 Recognition API（实时识别）切换到 Transcription API（录音文件转写）
   - 使用 `paraformer-v2` 模型，原生支持 WebM 格式
   - 音频格式：WebM（无需转换）

2. **新增 OSS 上传服务**
   - 创建 `services/oss_service.py` - 阿里云 OSS 文件上传
   - 使用签名 URL（有效期 1 小时）解决权限问题
   - 转录完成后自动清理 OSS 临时文件

3. **音频处理流程**
   ```
   前端录音 (WebM) → Base64 编码 → WebSocket 传输
       ↓
   后端解码 → OSS 上传 → 生成签名 URL
       ↓
   Transcription.async_call() → 提交任务 → Transcription.wait() → 获取结果
       ↓
   解析转录文本 → STAR 分析 → 返回反馈
   ```

4. **修复的问题**
   - `current_question` 状态传递问题（WebSocket → LangGraph）
   - OSS 内网地址改为外网地址
   - OSS 权限问题（使用签名 URL）
   - 转录结果解析（支持对象和字典两种格式）

5. **关键文件变更**
   - `services/oss_service.py` - **新建** OSS 上传服务
   - `services/asr_service.py` - **重写** 使用 Transcription API，支持 WebM 原生格式
   - `agents/graph.py` - 添加 `current_question` 参数传递
   - `api/websocket.py` - 传递 `current_question` 到 LangGraph

**配置要求:**
```bash
# OSS 配置（必需）
ALIYUN_ACCESS_KEY_ID=xxx
ALIYUN_ACCESS_KEY_SECRET=xxx
ALIYUN_OSS_BUCKET=your-bucket-name
ALIYUN_OSS_ENDPOINT=oss-cn-beijing.aliyuncs.com  # 使用外网地址

# DashScope ASR
DASHSCOPE_API_KEY=sk-xxx
```

**依赖安装:**
```bash
pip install oss2  # 阿里云 OSS SDK
```

### 2026-01-24: Frontend 重构 + LangSmith 监控

**完成的工作:**

1. **LangGraph Multi-Agent 架构实现**
   - Supervisor 意图识别 → 路由到 Interviewer/Chat SubAgent
   - 支持语音练习、答案优化、问题调研等场景

2. **Frontend 重构**
   - 统一练习室页面 `/chat/[sessionId]`
   - 新建 `useChat.ts` Hook 替代 `useWebSocket.ts`
   - 新建组件: ChatHeader, MessageList, ChatInput, AgentStatusBar, RecordingCard
   - 删除旧页面: `app/practice/`, `app/sessions/`

3. **WebSocket 协议简化**
   - 客户端只发送 `message` 和 `audio` 两种类型
   - 服务端返回 `assistant_message`, `recording_start`, `transcription`, `feedback`, `error`

4. **LangSmith 监控配置**
   - 添加 LANGSMITH_API_KEY, LANGSMITH_PROJECT, LANGSMITH_TRACING 到 .env
   - 可在 https://smith.langchain.com/ 查看 LangGraph 链路追踪

5. **命令行测试脚本**
   - `test_agent_simple.py` - 非交互式测试
   - `test_agent.py` - 交互式测试

**已知问题:**
- 交互式脚本 `test_agent.py` 在后台模式下无法运行（EOF 错误），需在前台终端运行

- 对话使用中文