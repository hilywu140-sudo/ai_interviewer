// ============ 用户认证相关 ============

export interface User {
  id: string
  email: string
  nickname?: string
  avatar_url?: string
  is_active: boolean
  is_verified: boolean
  last_login_at?: string
  login_count: number
  created_at: string
}

export interface SendCodeRequest {
  email: string
}

export interface SendCodeResponse {
  success: boolean
  message: string
  expires_in: number
}

export interface LoginRequest {
  email: string
  code: string
}

export interface LoginResponse {
  success: boolean
  message: string
  token?: string
  token_type: string
  expires_in: number
  user?: User
}

// ============ 项目和会话相关 ============

export interface Project {
  id: string
  user_id: string
  title: string
  jd_text: string
  resume_text?: string
  resume_file_path?: string
  practice_questions?: string[]
  created_at: string
  updated_at: string
}

export interface Session {
  id: string
  project_id: string
  title?: string
  status: string
  started_at: string
  ended_at?: string
}

export interface Message {
  id: string
  session_id: string
  role: string
  content: string
  message_type?: string
  transcript?: string
  chunks?: any[]
  feedback?: PracticeFeedback
  meta?: any
  audio_file_id?: string  // 新增：音频文件ID
  created_at: string
}

// 分页消息列表响应
export interface MessageListResponse {
  messages: Message[]
  total: number
  limit: number
  offset: number
  has_more: boolean
}

export interface ProjectCreate {
  title: string
  jd_text: string
  practice_questions?: string[]
}

export interface SessionCreate {
  project_id: string
  title?: string
}

// ============ STAR分析相关 ============

export interface PracticeFeedback {
  analysis: string
  overall_score?: number  // 总分（可选）
  strengths: string | string[]  // 优点（字符串或数组）
  improvements: string | string[]  // 改进建议（字符串或数组）
  encouragement?: string  // 鼓励语（可选）
  raw_content?: string  // 原始 XML 内容（可选）
}

// ============ 逐字稿时间戳相关 ============

export interface TranscriptSentence {
  id: number
  text: string
  start: number  // 毫秒
  end: number    // 毫秒
}

// ============ Asset 资产相关 ============

export type VersionType = 'recording' | 'edited'

export interface Asset {
  id: string
  project_id: string
  question: string
  transcript?: string
  original_message_id?: string
  tags: string[]
  star_structure?: { analysis: string }
  version: number
  parent_asset_id?: string
  version_type: VersionType  // "recording" | "edited"
  created_at: string
  updated_at: string
}

export interface AssetCreate {
  project_id: string
  question: string
  transcript?: string
  original_message_id?: string
  tags?: string[]
  star_structure?: { analysis: string }
  parent_asset_id?: string
  version_type?: VersionType
}

export interface AssetUpdate {
  transcript?: string
  tags?: string[]
}

export interface AssetGroup {
  question: string
  assets: Asset[]
}

// 待保存数据（用于用户确认保存交互）
export interface PendingSave {
  question: string
  transcript: string
  project_id: string
  messageId: string  // 关联的消息ID
}

// ============ WebSocket 消息类型（新版简化协议） ============

// 客户端发送的消息类型
export type ClientMessageType = 'message' | 'audio'

// 服务端返回的消息类型
export type ServerMessageType =
  | 'assistant_message'    // AI回复
  | 'assistant_message_stream_start'  // 流式开始
  | 'assistant_message_chunk'         // 流式内容块
  | 'assistant_message_stream_end'    // 流式结束
  | 'recording_start'      // 开始录音指令
  | 'transcription'        // 转录结果
  | 'feedback'             // STAR分析结果
  | 'feedback_stream_start'  // 流式反馈开始
  | 'feedback_chunk'         // 流式反馈内容块
  | 'feedback_stream_end'    // 流式反馈结束
  | 'generation_cancelled' // 生成被取消
  | 'error'                // 错误

// Agent 状态
export type AgentStatus = 'idle' | 'thinking' | 'recording' | 'transcribing' | 'analyzing'
export type CurrentAgent = 'supervisor' | 'interviewer' | 'chat' | null

// 消息上下文（用于逐字稿修改等场景）
export interface MessageContext {
  question: string           // 面试问题
  original_transcript: string // 原始逐字稿
  asset_id?: string          // 原始 Asset ID（用于版本关联）
}

// 客户端发送的消息格式
export interface ClientMessage {
  type: ClientMessageType
  content?: string        // 文本内容
  context?: MessageContext // 消息上下文（用于逐字稿修改）
  audio_data?: string     // Base64音频
  timestamp: string
}

// 服务端返回的消息格式
export interface ServerMessage {
  type: ServerMessageType
  content?: string

  // 流式消息相关
  full_content?: string  // 流式结束时的完整内容
  partial_content?: string  // 取消时的部分内容

  // Agent 状态
  agent_status?: {
    current_agent: string
    status: string
  }

  // 录音相关
  recording?: {
    question: string
  }

  // 转录相关
  transcription?: {
    text: string
    is_final: boolean
  }

  // 反馈相关
  feedback?: PracticeFeedback
  asset_id?: string  // 资产ID
  audio_file_id?: string  // 新增：音频文件ID
  transcript?: string  // 新增：纯文本转录
  transcript_sentences?: TranscriptSentence[]  // 句子时间戳

  // 待保存数据（用户确认后保存）
  pending_save?: {
    question: string
    transcript: string
    project_id: string
  }

  // 错误信息
  error?: string

  timestamp: string
}

// 聊天消息（用于UI展示）
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  type: 'text' | 'audio' | 'recording_prompt' | 'transcription' | 'feedback'
  timestamp: string
  // 录音相关
  question?: string
  // 转录相关
  transcription?: string
  transcriptSentences?: TranscriptSentence[]  // 新增：句子时间戳
  // 反馈相关
  feedback?: PracticeFeedback
  assetId?: string  // 新增：资产ID
  // 音频回放相关
  audioFileId?: string  // 新增：音频文件ID
  audioUrl?: string     // 新增：音频签名URL（用于回放）
  // 取消相关
  isCancelled?: boolean  // 用户暂停生成的消息
  // 保存相关
  pendingSave?: PendingSave | null   // 该消息的待保存数据
  saveStatus?: 'unsaved' | 'saved'   // 保存状态
  // 录音提交状态
  isRecordingSubmitted?: boolean     // 录音是否已提交
  isRecordingCancelled?: boolean     // 录音是否已取消
  // 点赞相关
  liked?: boolean                    // 是否已点赞
}

// 录音状态
export interface RecordingState {
  isActive: boolean
  isRecording: boolean  // 是否正在录音
  question: string | null
  duration: number
}

// 转录状态
export interface TranscriptionState {
  text: string | null
  isFinal: boolean
}

// 聊天状态
export interface ChatState {
  isConnected: boolean
  messages: ChatMessage[]
  agentStatus: AgentStatus
  currentAgent: CurrentAgent
  recordingState: RecordingState
  transcription: TranscriptionState
  // 流式消息状态
  isStreaming: boolean
  streamingContent: string
}

// ============ 旧版类型（保留兼容） ============

export type WSMessageType =
  | 'user_message'
  | 'assistant_message'
  | 'start_interview'
  | 'end_interview'
  | 'start_voice_practice'
  | 'submit_audio'
  | 'cancel_practice'
  | 'transcription_progress'
  | 'practice_result'
  | 'error'

export type ChatMode = 'mentor' | 'interviewer' | 'voice_practice' | 'analyzing'

export interface WebSocketMessage {
  type: WSMessageType
  content?: string
  message_id?: string
  metadata?: {
    mode?: ChatMode
    question?: string
  }
  action?: string  // 如 'start_recording'
  timestamp: string
  // 语音练习相关
  text?: string        // 转录文本
  is_final?: boolean   // 是否为最终转录
  transcript?: string  // 完整转录
  feedback?: PracticeFeedback  // STAR分析结果
  error?: string       // 错误信息
}
