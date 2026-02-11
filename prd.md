# AI Interview Coach - 产品需求文档 (PRD)

## 文档信息
- **产品名称**: AI Interview Coach (AI 面试教练)
- **版本**: v1.0 MVP
- **最后更新**: 2026-01-27
- **文档类型**: 产品需求文档

---

## 1. 产品概述

### 1.1 产品愿景
让每一次求职从"盲目试错"变为"精准通关"。通过 AI 驱动的个性化面试辅导，帮助求职者系统性提升面试表现，获得理想 offer。

### 1.2 目标用户
- **主要用户**: 正在求职的职场人士（应届生、跳槽者）
- **使用场景**:
  - 准备重要面试前的模拟练习
  - 优化面试回答的表达方式
  - 针对特定职位进行针对性准备
  - 积累和管理面试答案资产库

### 1.3 核心问题
1. **缺乏针对性反馈**: 传统面试准备缺少专业、即时的反馈
2. **答案质量参差不齐**: 不知道如何用 STAR 框架组织回答
3. **练习效率低**: 无法模拟真实面试场景进行语音练习
4. **经验难以沉淀**: 优质回答分散在各处，难以复用

### 1.4 核心价值主张
- **智能反馈**: 基于 STAR 框架的专业面试回答分析
- **语音练习**: 真实模拟面试场景，支持语音录制和转录
- **个性化辅导**: 结合简历和 JD 提供针对性建议
- **答案资产化**: 自动保存优化后的答案，建立个人面试资产库

### 1.5 产品差异化
- **AI Agent 架构**: 多智能体协作，提供专业化服务（面试官 + 导师）
- **STAR 框架分析**: 自动评分和结构化反馈
- **实时语音练习**: 支持录音、转录、逐字稿时间戳
- **上下文管理**: 智能对话历史管理，保持连贯性

---

## 2. 用户旅程与核心流程

### 2.1 完整用户流程

```
[首页] → [创建项目] → [对话练习室] → [资产库]
   ↓          ↓              ↓            ↓
 开始使用   上传简历+JD    语音练习     查看历史答案
                          文本对话
                          答案优化
```

### 2.2 核心用户场景

#### 场景 1: 新用户首次使用
```
1. 访问首页，点击"开始使用"
2. 进入项目列表页，点击"创建新项目"
3. 填写项目信息：
   - 项目名称（如"字节跳动前端工程师"）
   - 职位描述 (JD)
   - 上传简历 PDF（可选）
4. 提交后自动创建会话，直接进入对话页面
5. 开始与 AI 对话，进行面试准备
```

#### 场景 2: 语音练习流程
```
1. 用户在对话中输入："我想练习项目经验"
2. AI (Supervisor) 识别意图，提取问题："请介绍一个你主导的项目"
3. AI (Interviewer) 提示用户开始录音
4. 用户点击录音按钮，回答问题
5. 录音结束后，AI 进行：
   - 语音转文字 (ASR)
   - STAR 框架分析
   - 生成反馈和优化建议
6. 自动保存到资产库
```

#### 场景 3: 答案优化流程
```
1. 用户输入："帮我优化这个回答：问题是XXX，我的回答是XXX"
2. AI (Supervisor) 路由到 Chat SubAgent
3. Chat Agent 分析回答，提供：
   - 原答案分析（优缺点）
   - 优化建议
   - 基于 STAR 框架的重写版本
   - 关键改进点
```

#### 场景 4: 查看和管理资产
```
1. 用户访问资产库页面
2. 查看按问题分组的历史答案
3. 可以：
   - 查看逐字稿和时间戳
   - 查看 STAR 分析结果
   - 编辑优化后的答案
   - 查看答案版本历史
```

### 2.3 关键交互模式

#### WebSocket 实时通信
- **客户端 → 服务端**:
  - `{type: 'message', content: '文本内容'}`
  - `{type: 'audio', audio_data: 'base64音频'}`

- **服务端 → 客户端**:
  - `{type: 'assistant_message', content: 'AI回复'}`
  - `{type: 'recording_start', recording: {question: '问题'}}`
  - `{type: 'transcription', transcription: {text: '转录', is_final: true}}`
  - `{type: 'feedback', feedback: {STAR分析结果}}`

---

## 3. 前端架构

### 3.1 技术栈
- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **状态管理**: React Hooks + WebSocket
- **HTTP 客户端**: Axios

### 3.2 页面结构

```
frontend/app/
├── page.tsx                          # 首页（产品介绍）
├── projects/
│   ├── page.tsx                      # 项目列表页
│   ├── new/page.tsx                  # 创建项目页
│   ├── [id]/page.tsx                 # 项目详情页
│   └── [id]/sessions/page.tsx        # 会话列表页
├── chat/
│   └── [sessionId]/page.tsx          # 统一对话练习室 ⭐
└── assets/
    └── page.tsx                      # 资产库页面
```

### 3.3 核心组件架构

#### 对话练习室组件树
```
app/chat/[sessionId]/page.tsx
├── ChatHeader                        # 顶部栏（连接状态、Agent状态）
├── MessageList                       # 消息列表
│   ├── FeedbackCard                  # STAR 分析卡片
│   └── TranscriptWithTimestamps      # 逐字稿（带时间戳）
├── AgentStatusBar                    # AI 思考状态（3点动画）
├── RecordingCard                     # 录音卡片（自动弹出）
│   └── AudioRecorder                 # 录音控制器
└── ChatInput                         # 输入区域
```

### 3.4 关键 Hooks

#### `useChat.ts` - 统一聊天 Hook
```typescript
interface ChatState {
  isConnected: boolean                // WebSocket 连接状态
  messages: ChatMessage[]             // 消息列表
  agentStatus: AgentStatus            // 'idle' | 'thinking' | 'recording' | ...
  currentAgent: CurrentAgent          // 'supervisor' | 'interviewer' | 'chat'
  recordingState: {
    isActive: boolean                 // 是否显示录音卡片
    question: string | null           // 当前问题
    duration: number                  // 录音时长
  }
}

// 核心方法
- sendMessage(content: string)        // 发送文本消息
- sendAudio(audioBlob: Blob)          // 发送音频
- connect() / disconnect()            // 连接管理
```

### 3.5 组件职责

| 组件 | 职责 |
|------|------|
| `ChatHeader` | 显示连接状态、当前 Agent、会话信息 |
| `MessageList` | 渲染消息历史，支持文本/反馈/转录等多种类型 |
| `ChatInput` | 文本输入框，发送消息 |
| `AgentStatusBar` | 显示 AI 思考状态（3点动画） |
| `RecordingCard` | 录音界面，显示问题、录音按钮、时长 |
| `FeedbackCard` | 展示 STAR 分析结果（4个维度评分 + 建议） |
| `TranscriptWithTimestamps` | 可点击的逐字稿，支持时间戳跳转 |
| `FileUpload` | 文件上传组件（拖拽、预览、删除） |
| `AssetCard` | 资产卡片（问题、答案、STAR结构） |

---

## 4. 后端架构

### 4.1 技术栈
- **框架**: FastAPI
- **AI 框架**: LangGraph (状态机)
- **数据库**: PostgreSQL
- **ORM**: SQLAlchemy
- **LLM**: 多模型支持（DeepSeek/GPT-4/Claude）
- **ASR**: 阿里云语音识别 (Transcription API)
- **存储**: 阿里云 OSS

### 4.2 分层架构

```
backend/
├── main.py                           # FastAPI 应用入口
├── config.py                         # 配置管理（环境变量）
├── database.py                       # 数据库连接
├── models/                           # 数据模型层
│   ├── project.py
│   ├── session.py
│   ├── message.py
│   ├── audio_file.py
│   └── asset.py
├── schemas/                          # Pydantic 验证模型
├── api/                              # API 路由层
│   ├── projects.py                   # 项目 CRUD
│   ├── sessions.py                   # 会话 CRUD
│   ├── assets.py                     # 资产 CRUD
│   └── websocket.py                  # WebSocket 端点 ⭐
├── agents/                           # AI Agent 层 ⭐
│   ├── graph.py                      # LangGraph 状态机
│   ├── state.py                      # 状态定义
│   ├── supervisor.py                 # Supervisor Agent
│   ├── subagents/
│   │   ├── interviewer.py            # Interviewer SubAgent
│   │   └── chat.py                   # Chat SubAgent
│   └── prompts/                      # 提示词模板
│       ├── supervisor.py
│       ├── interviewer.py
│       └── chat.py
└── services/                         # 业务逻辑层
    ├── llm_service.py                # LLM 调用封装
    ├── asr_service.py                # 语音识别服务
    ├── oss_service.py                # OSS 上传服务
    ├── pdf_parser.py                 # PDF 解析
    ├── context_manager.py            # 上下文管理 ⭐
    └── audio_converter.py            # 音频格式转换
```

### 4.3 API 端点

#### REST API
```
POST   /api/projects                  # 创建项目
GET    /api/projects                  # 获取项目列表
GET    /api/projects/{id}             # 获取项目详情
POST   /api/projects/{id}/upload-resume  # 上传简历
DELETE /api/projects/{id}             # 删除项目

POST   /api/sessions                  # 创建会话
GET    /api/sessions?project_id=xxx   # 获取会话列表
GET    /api/sessions/{id}             # 获取会话详情
GET    /api/sessions/{id}/messages    # 获取消息历史

GET    /api/assets?project_id=xxx     # 获取资产列表
POST   /api/assets                    # 创建资产
PATCH  /api/assets/{id}               # 更新资产
DELETE /api/assets/{id}               # 删除资产
```

#### WebSocket
```
WS     /ws/chat/{session_id}          # 实时对话端点
```

### 4.4 外部服务集成

| 服务 | 用途 | 配置 |
|------|------|------|
| **DeepSeek API** | 测试阶段 LLM | `DEEPSEEK_API_KEY` |
| **OpenAI API** | 生产环境 LLM | `OPENAI_API_KEY` |
| **Anthropic API** | 生产环境 LLM | `ANTHROPIC_API_KEY` |
| **阿里云 DashScope** | 语音识别 | `DASHSCOPE_API_KEY` |
| **阿里云 OSS** | 音频文件存储 | `ALIYUN_OSS_*` |
| **LangSmith** | Agent 链路追踪 | `LANGSMITH_API_KEY` |

---



## 5. 数据库架构

### 5.1 ER 图概览

```
┌─────────────┐
│   Project   │ 1───┐
└─────────────┘     │
                    │ N
                ┌───▼──────┐
                │ Session  │ 1───┐
                └──────────┘     │
                                 │ N
                    ┌────────────┼────────────┐
                    │            │            │
                ┌───▼──────┐ ┌──▼────────┐ ┌─▼──────┐
                │ Message  │ │AudioFile  │ │ Asset  │
                └──────────┘ └───────────┘ └────────┘
```

### 5.2 数据表详细设计

#### 5.2.1 Projects 表
存储面试准备项目（对应特定职位）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `user_id` | UUID | 用户ID（预留多用户支持） |
| `title` | String(255) | 项目名称（如"字节跳动前端工程师"） |
| `jd_text` | Text | 职位描述（JD）全文 |
| `resume_text` | Text | 简历文本（PDF解析后） |
| `resume_file_path` | String(500) | 简历文件路径 |
| `practice_questions` | JSON | 预设练习问题列表 `["问题1", "问题2"]` |
| `created_at` | DateTime | 创建时间 |
| `updated_at` | DateTime | 更新时间 |

**索引**: `user_id`, `created_at`

#### 5.2.2 Sessions 表
存储练习会话（一个项目可以有多个会话）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `project_id` | UUID | 外键 → projects.id (CASCADE) |
| `title` | String(255) | 会话标题（可选） |
| `status` | String(50) | 状态：active/ended |
| `started_at` | DateTime | 开始时间 |
| `ended_at` | DateTime | 结束时间（可选） |

**索引**: `project_id`, `started_at`

#### 5.2.3 Messages 表
存储对话消息（包括用户消息、AI回复、反馈）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `session_id` | UUID | 外键 → sessions.id (CASCADE) |
| `role` | String(50) | 角色：user/assistant/system |
| `content` | Text | 消息内容 |
| `message_type` | String(50) | 类型：chat/voice_answer/feedback |
| `audio_file_id` | UUID | 外键 → audio_files.id（语音消息） |
| `transcript` | Text | 转录文本 |
| `chunks` | JSON | 逐字稿分块（带时间戳） |
| `feedback` | JSON | STAR 分析结果（见下方结构） |
| `original_answer_id` | UUID | 外键 → messages.id（答案重写关联） |
| `meta` | JSON | 元数据（如 question, asset_id） |
| `created_at` | DateTime | 创建时间 |

**索引**: `session_id`, `created_at`, `message_type`

**feedback JSON 结构**:
```json
{
  "star_analysis": {
    "situation": {"score": 8, "present": true, "feedback": "..."},
    "task": {"score": 7, "present": true, "feedback": "..."},
    "action": {"score": 9, "present": true, "feedback": "..."},
    "result": {"score": 6, "present": false, "feedback": "..."}
  },
  "overall_score": 75,
  "strengths": ["优点1", "优点2"],
  "improvements": ["改进点1", "改进点2"],
  "suggested_answer": "优化后的完整回答..."
}
```

#### 5.2.4 AudioFiles 表
存储音频文件元数据

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `session_id` | UUID | 外键 → sessions.id (CASCADE) |
| `file_path` | String(500) | OSS 文件路径 |
| `file_size` | Integer | 文件大小（字节） |
| `duration` | Float | 时长（秒） |
| `format` | String(20) | 格式：webm/wav/mp3 |
| `asr_status` | String(50) | ASR状态：pending/processing/completed/failed |
| `asr_result` | JSON | ASR 结果（转录文本 + 时间戳） |
| `created_at` | DateTime | 创建时间 |

**索引**: `session_id`, `asr_status`

**asr_result JSON 结构**:
```json
{
  "transcript": "完整转录文本",
  "sentences": [
    {"id": 1, "text": "句子1", "start": 0, "end": 2500},
    {"id": 2, "text": "句子2", "start": 2500, "end": 5000}
  ]
}
```

#### 5.2.5 Assets 表
存储优化后的答案资产（用户的面试答案库）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `project_id` | UUID | 外键 → projects.id (CASCADE) |
| `question` | Text | 面试问题 |
| `optimized_answer` | Text | 优化后的答案 |
| `transcript` | Text | 原始转录（可编辑） |
| `original_message_id` | UUID | 外键 → messages.id（来源消息） |
| `tags` | JSON | 标签 `["项目经验", "技术深度"]` |
| `star_structure` | JSON | STAR 结构分析 |
| `version` | Integer | 版本号（支持迭代优化） |
| `parent_asset_id` | UUID | 外键 → assets.id（父版本） |
| `created_at` | DateTime | 创建时间 |
| `updated_at` | DateTime | 更新时间 |

**索引**: `project_id`, `created_at`, `version`

### 5.3 数据流转

```
1. 用户创建项目
   → Project 表插入记录
   → 上传简历 → PDF 解析 → 更新 resume_text

2. 创建会话
   → Session 表插入记录

3. 用户发送消息
   → Message 表插入（role=user）
   → LangGraph 处理
   → Message 表插入（role=assistant）

4. 语音练习流程
   → 用户录音 → AudioFile 表插入
   → ASR 处理 → 更新 asr_result
   → STAR 分析 → Message 表插入（feedback）
   → 自动保存 → Asset 表插入

5. 查看资产库
   → 查询 Asset 表（按 project_id 分组）
```

---

## 6. AI Agent 架构

### 6.1 LangGraph 状态机

#### 6.1.1 架构图

```
                    ┌──────────────┐
                    │   用户输入    │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  Supervisor  │ (意图识别 + 路由)
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │                         │
       ┌──────▼──────┐          ┌──────▼──────┐
       │ Interviewer │          │    Chat     │
       │  SubAgent   │          │  SubAgent   │
       └──────┬──────┘          └──────┬──────┘
              │                         │
              └────────────┬────────────┘
                           │
                    ┌──────▼───────┐
                    │   返回结果    │
                    └──────────────┘
```

#### 6.1.2 状态定义 (AgentState)

```python
class AgentState(TypedDict):
    # 会话信息
    session_id: str
    project_id: str | None

    # 背景信息
    resume_text: str | None
    jd_text: str | None
    practice_questions: list[str]

    # 对话历史
    messages: list[dict]              # [{"role": "user", "content": "..."}]
    context_summary: str | None       # 历史摘要（超过10轮时生成）
    context_token_usage: dict | None  # Token 使用统计

    # 当前输入
    user_input: str
    input_type: str                   # text/audio
    audio_data: str | None            # Base64 音频

    # 当前状态
    current_mode: str                 # idle/interviewing/chatting
    current_question: str | None      # 当前练习的问题

    # 处理结果
    transcript: str | None            # 转录文本
    transcript_sentences: list | None # 句子时间戳
    feedback: dict | None             # STAR 分析
    asset_id: str | None              # 保存的资产ID

    # 路由控制
    next_agent: str                   # supervisor/interviewer/chat/end
    response_text: str | None
    response_type: str                # message/recording_start/feedback/error
    response_metadata: dict | None
```

### 6.2 Supervisor Agent（主控制器）

#### 6.2.1 职责
- 分析用户输入意图
- 从输入中提取面试问题
- 路由到合适的 SubAgent
- 处理无关问题（拒绝）

#### 6.2.2 意图分类

| 意图类型 | 关键词 | 路由目标 | 示例 |
|---------|--------|---------|------|
| **语音练习** | "我想练习"、"开始模拟"、"语音回答" | Interviewer | "我想练习项目经验" |
| **答案优化** | "帮我优化"、"改进回答" | Chat | "帮我优化这个回答" |
| **问题调研** | "怎么回答"、"如何回答" | Chat | "怎么回答离职原因" |
| **简历优化** | "优化简历"、"简历建议" | Chat | "帮我优化简历" |
| **无关问题** | 其他 | End (拒绝) | "今天天气怎么样" |
| **简单回复** | "你好"、"谢谢" | End (直接回复) | "你好" |

#### 6.2.3 问题提取逻辑

```python
# 输入示例 → 提取结果
"我想练习项目经验" → "请介绍一个你主导的项目"
"我想练习自我介绍" → "请做一个简短的自我介绍"
"练习：为什么选择我们公司" → "为什么选择我们公司"
"请介绍你的项目经验" → "请介绍你的项目经验"（直接使用）
```

### 6.3 Interviewer SubAgent（面试官）

#### 6.3.1 职责
- 处理语音练习流程
- 调用 ASR 服务转录音频
- 执行 STAR 框架分析
- 自动保存优化答案到资产库

#### 6.3.2 处理流程

```
1. 接收用户输入
   ├─ 如果是音频 → 转录 + 分析
   ├─ 如果是文本 + 已有问题 → 开始录音
   └─ 如果是文本 + 无问题 → 提取问题 → 开始录音

2. 音频处理流程
   ├─ Base64 解码
   ├─ 格式转换（WebM → WAV）
   ├─ 上传到 OSS
   ├─ 调用阿里云 ASR
   ├─ 获取转录结果（文本 + 时间戳）
   ├─ STAR 框架分析（LLM）
   ├─ 保存到 Asset 表
   └─ 返回反馈

3. STAR 分析
   ├─ 输入：问题 + 回答 + 简历 + JD
   ├─ 输出：
   │   ├─ 4个维度评分（Situation/Task/Action/Result）
   │   ├─ 总分（0-100）
   │   ├─ 优点列表
   │   ├─ 改进建议
   │   └─ 优化后的答案
```

#### 6.3.3 STAR 分析提示词结构

```python
STAR_ANALYSIS_PROMPT = """
请分析以下面试回答，使用 STAR 框架评分：

**面试问题**: {question}
**用户回答**: {answer}
**用户简历**: {resume_text}
**目标职位**: {jd_text}

请返回 JSON 格式：
{
  "star_analysis": {
    "situation": {"score": 0-10, "present": bool, "feedback": "..."},
    "task": {...},
    "action": {...},
    "result": {...}
  },
  "overall_score": 0-100,
  "strengths": ["优点1", "优点2"],
  "improvements": ["改进点1", "改进点2"],
  "suggested_answer": "优化后的完整回答"
}
"""
```

### 6.4 Chat SubAgent（对话助手）

#### 6.4.1 职责
- 答案优化（基于 STAR 框架重写）
- 问题调研（分析面试问题，提供回答思路）
- 简历优化（根据 JD 提供修改建议）
- 通用面试相关对话

#### 6.4.2 请求类型分类

```python
def _classify_request(user_input: str) -> str:
    if "优化回答" in user_input:
        return "answer_optimization"
    elif "怎么回答" in user_input:
        return "question_research"
    elif "优化简历" in user_input:
        return "resume_optimization"
    else:
        return "general"
```

#### 6.4.3 答案优化流程

```
输入: "帮我优化这个回答：问题是XXX，我的回答是XXX"
  ↓
解析: 提取问题和原答案
  ↓
分析: 结合简历 + JD
  ↓
输出:
  ├─ 原答案分析（优缺点）
  ├─ 优化建议
  ├─ 基于 STAR 的重写版本
  └─ 关键改进点
```

---

### 6.5 上下文管理策略

#### 6.5.1 Context Manager 设计

管理对话历史和上下文摘要，策略：
- 保留最近 10 轮对话
- 超过 10 轮时生成摘要
- Token 预算：16K
- 优先级：JD > Resume > History

#### 6.5.2 Token 预算分配

| 组件 | 预算 | 优先级 |
|------|------|--------|
| System Prompt | ~500 tokens | 最高 |
| JD 文本 | 最多 2000 tokens | 高 |
| Resume 文本 | 最多 2000 tokens | 中 |
| 历史摘要 | 最多 1000 tokens | 中 |
| 最近对话 | 剩余空间 | 低 |
| 用户输入 | ~200 tokens | 最高 |

### 6.6 LangSmith 监控

#### 6.6.1 可观测性指标
- Agent 路由决策
- LLM 调用次数和 Token 使用
- ASR 处理时间
- 端到端响应时间
- 错误率和失败原因

---

## 7. 核心功能详解

### 7.1 项目管理
- 创建项目：填写名称、JD、上传简历
- 项目列表：按时间倒序，支持删除
- PDF 解析：提取文本保存到数据库

### 7.2 实时对话
- WebSocket 连接实现实时通信
- 支持文本和音频两种输入
- 多种消息类型处理

### 7.3 语音练习
- 浏览器录音（MediaRecorder API）
- 音频格式转换（WebM → WAV）
- ASR 转录（阿里云 Transcription API）
- STAR 框架分析
- 自动保存到资产库

### 7.4 答案资产库
- 自动保存优化后的答案
- 按问题分组展示
- 支持编辑和版本管理
- 标签分类

### 7.5 答案优化
- 基于 STAR 框架重写
- 结合简历和 JD 提供针对性建议
- 输出优化建议和改进点

---

## 8. 技术实现细节

### 8.1 音频处理
- 格式转换：使用 ffmpeg
- OSS 上传：阿里云对象存储
- 签名 URL：1小时有效期

### 8.2 LLM 调用
- 多模型支持：DeepSeek/GPT-4/Claude
- Token 计数：tiktoken
- 温度控制：不同场景不同温度

### 8.3 错误处理
- WebSocket 自动重连
- ASR 失败重试机制
- 友好的错误提示

---

## 9. 部署与运维

### 9.1 环境配置
需要配置数据库、LLM API、ASR API、OSS 等环境变量

### 9.2 性能优化
- 数据库索引优化
- LLM 响应缓存
- 上下文摘要缓存

### 9.3 监控指标
- 业务指标：用户数、练习次数、平均得分
- 技术指标：响应时间、成功率、Token 使用

---

## 10. 未来规划

### 10.1 短期优化（1-2个月）
- 支持更多音频格式
- 优化 STAR 分析算法
- 面试问题推荐

### 10.2 中期功能（3-6个月）
- 多用户系统
- 团队协作
- 面试模拟模式
- 移动端适配

### 10.3 长期愿景（6-12个月）
- AI 视频面试
- 行为面试分析
- 行业知识库
- 社区功能
- 企业版

---

**文档结束**

*最后更新: 2026-01-27*
*版本: v1.0 MVP*
