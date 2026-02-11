# AI Interview Coach - 系统架构文档

## 系统概览

AI Interview Coach 是一个基于 LangGraph 多智能体架构的面试辅导系统，提供语音练习、答案优化、问题调研等功能。

### 技术栈

- **后端**: Python 3.12 + FastAPI + LangGraph + PostgreSQL
- **前端**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **LLM**: DeepSeek (开发) / GPT-4 / Claude (生产)
- **ASR**: 阿里云 DashScope Transcription API
- **存储**: 阿里云 OSS (音频临时存储)

---

## 后端架构

### 1. 分层架构

```
┌─────────────────────────────────────────────────────────┐
│                    FastAPI Application                   │
├─────────────────────────────────────────────────────────┤
│  API Layer (api/)                                        │
│  ├── REST Endpoints (projects, sessions)                │
│  └── WebSocket Endpoint (/ws/chat/{session_id})         │
├─────────────────────────────────────────────────────────┤
│  Agent Layer (agents/)                                   │
│  ├── LangGraph State Machine                            │
│  ├── Supervisor (意图识别与路由)                         │
│  └── SubAgents (Interviewer, Chat)                      │
├─────────────────────────────────────────────────────────┤
│  Service Layer (services/)                               │
│  ├── LLM Service (多模型支持)                            │
│  ├── ASR Service (语音转文字)                            │
│  ├── OSS Service (文件上传)                              │
│  └── Audio Converter (格式转换)                          │
├─────────────────────────────────────────────────────────┤
│  Data Layer (models/, database.py)                      │
│  ├── SQLAlchemy ORM Models                              │
│  └── PostgreSQL Database                                │
└─────────────────────────────────────────────────────────┘
```

### 2. LangGraph 多智能体系统

#### 架构图

```
                    ┌──────────────┐
                    │   用户输入    │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  Supervisor  │
                    │  (意图识别)   │
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
                    │   响应输出    │
                    └──────────────┘
```

#### Agent 职责

| Agent | 职责 | 输入 | 输出 |
|-------|------|------|------|
| **Supervisor** | 分析用户意图，路由到对应 SubAgent | 用户文本/音频 | `next_agent: interviewer/chat/end` |
| **Interviewer** | 处理语音练习流程：提问 → 录音 → ASR → STAR 分析 | 问题/音频数据 | `recording_start` / `feedback` |
| **Chat** | 处理文本交互：答案优化、问题调研、简历优化 | 用户问题 | `assistant_message` |

#### 状态定义 (AgentState)

```python
class AgentState(TypedDict):
    # 会话信息
    session_id: str
    project_id: Optional[str]

    # 用户输入
    user_input: str
    input_type: str  # "text" | "audio"
    audio_data: Optional[str]  # Base64 编码

    # 上下文
    resume_text: Optional[str]
    jd_text: Optional[str]
    practice_questions: List[str]
    current_question: Optional[str]

    # 处理结果
    transcript: Optional[str]
    feedback: Optional[Dict]

    # 路由控制
    next_agent: str  # "supervisor" | "interviewer" | "chat" | "end"

    # 响应
    response_text: str
    response_type: str  # "message" | "recording_start" | "feedback" | "error"
    response_metadata: Optional[Dict]
```

### 3. 语音练习完整流程

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. 用户发起练习                                                  │
│    用户: "我想练习请介绍一个你主导的项目"                         │
│    ↓                                                             │
│    Supervisor 识别意图 → 路由到 Interviewer                      │
│    ↓                                                             │
│    Interviewer 返回: response_type="recording_start"             │
│    前端弹出录音卡片                                               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 2. 用户录音并提交                                                │
│    前端: MediaRecorder 录制 WebM 格式                            │
│    ↓                                                             │
│    Base64 编码 → WebSocket 发送 { type: "audio", audio_data }   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 3. 后端音频处理                                                  │
│    WebSocket 接收 → 传递 current_question 到 LangGraph          │
│    ↓                                                             │
│    Supervisor 路由到 Interviewer                                 │
│    ↓                                                             │
│    Interviewer._process_audio():                                │
│      ├─ Base64 解码                                              │
│      ├─ ffmpeg 转换 (WebM → WAV)                                │
│      ├─ OSS 上传 → 生成签名 URL                                 │
│      ├─ Transcription.async_call(file_urls=[signed_url])        │
│      ├─ Transcription.wait() → 获取 transcription_url           │
│      ├─ 下载并解析转录结果 JSON                                  │
│      ├─ STAR 分析 (调用 LLM)                                     │
│      └─ 清理 OSS 临时文件                                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 4. 返回反馈                                                      │
│    WebSocket 发送:                                               │
│      ├─ { type: "transcription", text: "...", is_final: true }  │
│      └─ { type: "feedback", feedback: { overall_score: 85 } }   │
│    ↓                                                             │
│    前端显示转录文本 + STAR 分析结果                               │
└─────────────────────────────────────────────────────────────────┘
```

### 4. ASR 服务架构

#### 技术选型

- **API**: DashScope Transcription API (录音文件转写)
- **模型**: `fun-asr`
- **音频格式**: WAV (16kHz, 16-bit, mono)
- **存储**: 阿里云 OSS (临时存储，转录后删除)

#### 数据流

```
WebM 音频 (前端)
    ↓
Base64 编码
    ↓
WebSocket 传输
    ↓
后端解码 (bytes)
    ↓
ffmpeg 转换 (WebM → WAV)
    ↓
OSS 上传 → 签名 URL (有效期 1 小时)
    ↓
Transcription.async_call(file_urls=[signed_url])
    ↓
Transcription.wait(task_id) → 获取 transcription_url
    ↓
HTTP GET transcription_url → 下载 JSON
    ↓
解析 JSON → 提取转录文本
    ↓
清理 OSS 文件
```

#### 关键代码

**services/asr_service.py**
```python
class ASRService:
    def transcribe_audio_bytes_sync(self, audio_data: bytes) -> ASRResult:
        # 1. 上传到 OSS
        audio_url = oss_service.upload_audio(audio_data, suffix='.wav')

        # 2. 提交转录任务
        task_response = Transcription.async_call(
            model='fun-asr',
            file_urls=[audio_url]
        )

        # 3. 等待结果
        result = Transcription.wait(task=task_response.output.task_id)

        # 4. 解析转录文本
        transcript = self._parse_result(result.output)

        # 5. 清理 OSS 文件
        oss_service.delete_audio(key)

        return ASRResult(transcript=transcript)
```

**services/oss_service.py**
```python
class OSSService:
    def upload_audio(self, audio_data: bytes, suffix: str = '.wav') -> str:
        key = f"audio/{uuid.uuid4()}{suffix}"
        self.bucket.put_object(key, audio_data)

        # 生成签名 URL (有效期 1 小时)
        signed_url = self.bucket.sign_url('GET', key, 3600)
        return signed_url
```

---

## 前端架构

### 1. 页面结构

```
app/
├── chat/[sessionId]/
│   └── page.tsx              # 统一练习室页面
├── components/chat/
│   ├── ChatHeader.tsx        # 顶部栏（连接状态、Agent 状态）
│   ├── MessageList.tsx       # 消息列表
│   ├── ChatInput.tsx         # 输入区域
│   ├── AgentStatusBar.tsx    # AI 思考状态（3 点动画）
│   └── RecordingCard.tsx     # 录音卡片（自动弹出）
└── hooks/
    └── useChat.ts            # 统一聊天 Hook
```

### 2. useChat Hook 状态管理

```typescript
interface ChatState {
  isConnected: boolean
  messages: ChatMessage[]
  agentStatus: 'idle' | 'thinking' | 'recording' | 'transcribing' | 'analyzing'
  currentAgent: 'supervisor' | 'interviewer' | 'chat' | null
  recordingState: {
    isActive: boolean
    isRecording: boolean
    question: string | null
    duration: number
  }
  transcription: {
    text: string | null
    isFinal: boolean
  }
}
```

### 3. WebSocket 协议

#### 客户端 → 服务端

```typescript
// 文本消息
{
  type: 'message',
  content: '用户输入的文本',
  timestamp: '2026-01-25T12:00:00Z'
}

// 音频消息
{
  type: 'audio',
  audio_data: 'base64编码的WebM音频',
  timestamp: '2026-01-25T12:00:00Z'
}
```

#### 服务端 → 客户端

```typescript
// 普通消息
{
  type: 'assistant_message',
  content: 'AI 回复内容',
  agent_status: { current_agent: 'chat', status: 'idle' },
  timestamp: '2026-01-25T12:00:01Z'
}

// 开始录音
{
  type: 'recording_start',
  content: '请点击录音按钮开始回答',
  recording: { question: '请介绍一个你主导的项目' },
  agent_status: { current_agent: 'interviewer', status: 'recording' },
  timestamp: '2026-01-25T12:00:01Z'
}

// 转录结果
{
  type: 'transcription',
  transcription: { text: '转录文本', is_final: true },
  agent_status: { current_agent: 'interviewer', status: 'analyzing' },
  timestamp: '2026-01-25T12:00:05Z'
}

// STAR 分析反馈
{
  type: 'feedback',
  feedback: {
    overall_score: 85,
    star_analysis: {
      situation: { score: 8, present: true, feedback: '...' },
      task: { score: 9, present: true, feedback: '...' },
      action: { score: 8, present: true, feedback: '...' },
      result: { score: 9, present: true, feedback: '...' }
    },
    strengths: ['...'],
    improvements: ['...'],
    suggested_answer: '...'
  },
  agent_status: { current_agent: null, status: 'idle' },
  timestamp: '2026-01-25T12:00:10Z'
}

// 错误消息
{
  type: 'error',
  error: '错误信息',
  content: '错误信息',
  timestamp: '2026-01-25T12:00:01Z'
}
```

---

## 数据库设计

### 核心表结构

```sql
-- 项目表
CREATE TABLE projects (
    id UUID PRIMARY KEY,
    title VARCHAR(255),
    resume_text TEXT,
    jd_text TEXT,
    practice_questions JSONB,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- 会话表
CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    title VARCHAR(255),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- 消息表
CREATE TABLE messages (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES sessions(id),
    role VARCHAR(50),  -- 'user' | 'assistant'
    content TEXT,
    message_type VARCHAR(50),  -- 'chat' | 'voice_answer' | 'feedback'
    feedback JSONB,  -- STAR 分析结果
    meta JSONB,  -- 额外元数据
    created_at TIMESTAMP
);

-- 音频文件表（预留）
CREATE TABLE audio_files (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES sessions(id),
    file_path VARCHAR(500),
    asr_status VARCHAR(50),
    asr_result JSONB,
    created_at TIMESTAMP
);

-- 资产库表（预留）
CREATE TABLE assets (
    id UUID PRIMARY KEY,
    user_id UUID,
    question TEXT,
    optimized_answer TEXT,
    tags JSONB,
    created_at TIMESTAMP
);
```

---

## 配置管理

### 环境变量

```bash
# 数据库
DATABASE_URL=postgresql://user:password@localhost:5432/ai_interviewer

# LLM
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=sk-...
DEFAULT_LLM_PROVIDER=deepseek

# ASR
DASHSCOPE_API_KEY=sk-...
ALIYUN_ACCESS_KEY_ID=...
ALIYUN_ACCESS_KEY_SECRET=...
ALIYUN_OSS_BUCKET=ai-interview-coach
ALIYUN_OSS_ENDPOINT=oss-cn-beijing.aliyuncs.com

# LangSmith 监控
LANGSMITH_API_KEY=lsv2_pt_...
LANGSMITH_PROJECT=ai-interviewer
LANGSMITH_TRACING=true

# 应用
APP_ENV=development
SECRET_KEY=your-secret-key
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

---

## 部署架构

### 开发环境

```
┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Backend       │
│   Next.js       │     │   FastAPI       │
│   localhost:3000│     │   localhost:8002│
└─────────────────┘     └────────┬────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
            ┌───────▼──────┐ ┌──▼──────┐ ┌──▼──────┐
            │ PostgreSQL   │ │ OSS     │ │ LLM API │
            │ localhost    │ │ Aliyun  │ │ DeepSeek│
            └──────────────┘ └─────────┘ └─────────┘
```

### 生产环境（规划）

```
┌─────────────────┐
│   CDN / Vercel  │
│   (Frontend)    │
└────────┬────────┘
         │
┌────────▼────────┐
│   Load Balancer │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼────┐
│FastAPI│ │FastAPI│
│ Pod 1 │ │ Pod 2 │
└───┬───┘ └───┬───┘
    │         │
    └────┬────┘
         │
    ┌────▼────┐
    │   RDS   │
    │(Postgres)│
    └─────────┘
```

---

## 监控与调试

### LangSmith 追踪

- **URL**: https://smith.langchain.com/
- **追踪内容**:
  - LangGraph 执行流程
  - Agent 路由决策
  - LLM 调用详情
  - 执行时间统计

### 日志级别

```python
# main.py
logging.basicConfig(level=logging.INFO)
logging.getLogger("api.websocket").setLevel(logging.DEBUG)
logging.getLogger("agents").setLevel(logging.DEBUG)
logging.getLogger("services.asr_service").setLevel(logging.INFO)
```

---

## 性能优化

### 当前优化

1. **音频处理异步化**: 使用 `run_in_executor` 避免阻塞事件循环
2. **OSS 临时存储**: 转录完成后自动清理，节省存储成本
3. **签名 URL**: 避免 OSS bucket 公开，提高安全性
4. **LangGraph 状态持久化**: 使用 MemorySaver 支持多轮对话

### 未来优化方向

1. **音频流式传输**: 支持实时语音识别
2. **缓存策略**: 缓存常见问题的 STAR 分析模板
3. **并发控制**: 限制同时处理的音频任务数量
4. **CDN 加速**: 前端静态资源 CDN 分发

---

## 安全考虑

1. **API Key 管理**: 所有密钥通过环境变量配置，不提交到代码库
2. **OSS 权限**: 使用签名 URL，避免 bucket 公开
3. **WebSocket 认证**: 验证 session_id 有效性
4. **输入验证**: Pydantic schemas 验证所有输入
5. **CORS 配置**: 限制允许的来源域名

---

## 扩展性设计

### 新增 Agent

1. 在 `agents/subagents/` 创建新 Agent 类
2. 实现 `async def process(state: AgentState) -> AgentState`
3. 在 `agents/graph.py` 注册节点和路由
4. 更新 Supervisor 的意图识别逻辑

### 新增 LLM Provider

1. 在 `services/llm_service.py` 添加新 provider
2. 更新 `config.py` 添加 API key 配置
3. 修改 `DEFAULT_LLM_PROVIDER` 环境变量

### 新增 ASR Provider

1. 在 `services/` 创建新 ASR service
2. 实现统一的 `transcribe_audio_bytes()` 接口
3. 更新 `interviewer.py` 导入新 service
