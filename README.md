# AI Interview Coach

私人 AI 面试教练，让每一次求职从"盲目试错"变为"精准通关"。

## 项目概述

这是一个帮助应届毕业生和职场跳槽者进行面试准备的 AI 产品。MVP 阶段的核心目标是验证"反馈建议"和"改写"的质量。

## 技术栈

- **前端**: Next.js (React) + TypeScript + Tailwind CSS
- **后端**: Python FastAPI
- **Agent 框架**: LangGraph
- **数据库**: PostgreSQL
- **LLM**: 多模型混用（GPT-3.5 用于意图识别，GPT-4/Claude 用于反馈生成）
- **ASR**: 阿里云语音识别服务
- **PDF 解析**: pdfplumber

## 项目结构

```
AI_Interviewer/
├── backend/                # FastAPI 后端
│   ├── main.py
│   ├── models/             # 数据库模型
│   ├── schemas/            # Pydantic schemas
│   ├── api/                # API 路由
│   ├── agents/             # LangGraph agents
│   └── services/           # 业务逻辑
├── frontend/               # Next.js 前端
│   ├── app/                # 页面
│   ├── components/         # 组件
│   └── lib/                # 工具库
└── docs/                   # 文档
```

## 快速开始

### 环境要求

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+
- 阿里云账号（用于 ASR 服务）

### 后端设置

```bash
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入你的配置

# 创建数据库
createdb ai_interviewer

# 运行服务
python main.py
```

后端 API 文档: http://localhost:8000/docs

### 前端设置

```bash
cd frontend

# 安装依赖
npm install

# 配置环境变量
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# 运行开发服务器
npm run dev
```

前端应用: http://localhost:3000

## 开发进度

### Phase 1: 基础架构 ✅

- [x] 后端 FastAPI 项目初始化
- [x] 数据库 Schema 创建（5 个核心表）
- [x] 基础 API 端点（projects, sessions）
- [x] PDF 解析功能
- [x] 前端 Next.js 项目初始化
- [x] 基础页面结构
- [x] API 客户端封装

### Phase 2: 核心对话功能（进行中）

- [ ] LangGraph 集成
- [ ] WebSocket 实时对话
- [ ] 模式切换（Mentor ↔ Interviewer）

### Phase 3: 录音和转录

- [ ] 前端录音功能
- [ ] ASR 集成
- [ ] 时间戳处理

### Phase 4: 反馈和改写

- [ ] Analyzer Agent
- [ ] Rewriter Agent
- [ ] 反馈展示 UI

### Phase 5: 资产库和优化

- [ ] 面试资产库
- [ ] 性能优化
- [ ] 用户体验优化

## 核心功能

### MVP 阶段

1. **项目管理**: 创建项目，上传简历，输入 JD
2. **对话模式**: AI 导师提供指导和建议
3. **面试模式**: 模拟面试，录音回答
4. **反馈分析**: STAR 框架分析，逻辑评分
5. **改写优化**: AI 改写回答，Markdown diff 展示
6. **资产库**: 保存优化后的回答

## 文档

详细的实现计划请查看: `.claude/plans/snazzy-swimming-bubble.md`

## License

MIT
