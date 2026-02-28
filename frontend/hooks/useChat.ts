'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  ChatMessage,
  ChatState,
  ServerMessage,
  AgentStatus,
  CurrentAgent,
  RecordingState,
  TranscriptionState,
  PracticeFeedback,
  TranscriptSentence,
  Message,
  Session,
  MessageContext
} from '@/lib/types'
import { messagesApi, audioApi, sessionsApi, assetsApi } from '@/lib/api-client'
import { getAuthToken } from '@/components/AuthProvider'
import { analytics, AnalyticsEvents, performanceTiming } from '@/lib/analytics'

interface UseChatReturn {
  state: ChatState & {
    isLoadingHistory: boolean
    hasMoreHistory: boolean
    isSubmitted: boolean  // 是否已提交等待分析
    isStreaming: boolean  // 是否正在流式输出
    streamingContent: string  // 流式输出内容
    isFeedbackStreaming: boolean  // 是否正在流式反馈
    feedbackStreamingContent: string  // 流式反馈内容
    projectId: string | null  // 项目ID
    pendingQuery: string  // 待处理的用户输入（用于取消后恢复）
    messageContext: MessageContext | null  // 消息上下文（用于逐字稿修改）
    newAssetId: string | null  // 新保存的 Asset ID（用于侧边栏高亮）
  }
  sendMessage: (content: string, context?: MessageContext) => void
  setMessageContext: (context: MessageContext | null) => void
  submitAudio: (audioData: string, previewUrl?: string) => void
  startRecording: () => void
  stopRecording: () => void
  cancelRecording: () => void
  cancelGeneration: () => string  // 取消生成，返回待恢复的query
  loadMoreHistory: () => Promise<void>
  clearNewAssetId: () => void  // 清除新 Asset 高亮
  confirmSave: (messageId: string) => Promise<void>  // 确认保存（按消息ID）
  toggleLike: (messageId: string) => Promise<void>  // 切换点赞
}

const initialRecordingState: RecordingState = {
  isActive: false,
  isRecording: false,
  question: null,
  duration: 0
}

const initialTranscriptionState: TranscriptionState = {
  text: null,
  isFinal: false
}

export function useChat(sessionId: string): UseChatReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle')
  const [currentAgent, setCurrentAgent] = useState<CurrentAgent>(null)
  const [recordingState, setRecordingState] = useState<RecordingState>(initialRecordingState)
  const [transcription, setTranscription] = useState<TranscriptionState>(initialTranscriptionState)

  // 历史消息加载状态
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [hasMoreHistory, setHasMoreHistory] = useState(true)
  const [historyOffset, setHistoryOffset] = useState(0)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  // 录音本地预览URL（提交录音后保留，用于在消息中显示播放器）
  const audioPreviewUrlRef = useRef<string | null>(null)

  // 流式消息状态
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')

  // 流式反馈状态
  const [isFeedbackStreaming, setIsFeedbackStreaming] = useState(false)
  const [feedbackStreamingContent, setFeedbackStreamingContent] = useState('')

  // 项目ID（从session获取）
  const [projectId, setProjectId] = useState<string | null>(null)

  // 待处理的用户输入（用于取消后恢复）
  const [pendingQuery, setPendingQuery] = useState('')

  // 消息上下文（用于逐字稿修改等场景）
  const [messageContext, setMessageContext] = useState<MessageContext | null>(null)

  // 新保存的 Asset ID（用于侧边栏高亮提示）
  const [newAssetId, setNewAssetId] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const streamingContentRef = useRef<string>('')  // 用于在回调中获取最新的流式内容
  const feedbackStreamingContentRef = useRef<string>('')  // 用于在回调中获取最新的流式反馈内容
  const connectTimeoutRef = useRef<NodeJS.Timeout | null>(null)  // 防抖连接

  // 同步 streamingContent 到 ref
  useEffect(() => {
    streamingContentRef.current = streamingContent
  }, [streamingContent])

  // 同步 feedbackStreamingContent 到 ref
  useEffect(() => {
    feedbackStreamingContentRef.current = feedbackStreamingContent
  }, [feedbackStreamingContent])

  // 获取 session 信息以获取 projectId
  useEffect(() => {
    if (sessionId) {
      sessionsApi.get(sessionId)
        .then((session) => {
          setProjectId(session.project_id)
        })
        .catch((error) => {
          console.error('Failed to get session:', error)
        })
    }
  }, [sessionId])

  // 生成唯一消息ID
  const generateMessageId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // 将后端 Message 转换为前端 ChatMessage
  const convertMessageToChatMessage = async (msg: Message): Promise<ChatMessage> => {
    const chatMsg: ChatMessage = {
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      type: mapMessageType(msg.message_type),
      timestamp: msg.created_at,
      feedback: msg.feedback,
      transcription: msg.transcript,
      audioFileId: msg.audio_file_id,
      isCancelled: msg.meta?.cancelled === true,  // 检查是否是被取消的消息
      transcriptSentences: msg.meta?.transcript_sentences,  // 从 meta 中读取带时间戳的录音稿
    }

    // 处理 recording_prompt 类型消息
    if (msg.message_type === 'recording_prompt') {
      chatMsg.question = msg.meta?.question
      chatMsg.isRecordingSubmitted = msg.meta?.submitted === true
      chatMsg.isRecordingCancelled = msg.meta?.cancelled === true
    }

    // 从 meta 中恢复保存状态
    if (msg.meta?.pending_save && !msg.meta?.saved) {
      chatMsg.pendingSave = {
        ...msg.meta.pending_save,
        messageId: msg.id
      }
      chatMsg.saveStatus = 'unsaved'
    } else if (msg.meta?.saved) {
      chatMsg.saveStatus = 'saved'
    }

    // 从 meta 中读取点赞状态
    if (msg.meta?.liked) {
      chatMsg.liked = true
    }

    // 如果有音频文件ID，获取签名URL
    if (msg.audio_file_id) {
      try {
        const { url } = await audioApi.getUrl(msg.audio_file_id)
        chatMsg.audioUrl = url
      } catch (e) {
        console.warn('Failed to get audio URL:', e)
      }
    }

    return chatMsg
  }

  // 映射消息类型
  function mapMessageType(type?: string): ChatMessage['type'] {
    switch (type) {
      case 'voice_answer': return 'audio'
      case 'feedback': return 'feedback'
      case 'recording_prompt': return 'recording_prompt'
      default: return 'text'
    }
  }

  // 加载历史消息
  const loadHistory = useCallback(async () => {
    if (!sessionId || historyLoaded) return

    setIsLoadingHistory(true)
    try {
      const response = await messagesApi.list(sessionId, {
        limit: 20,
        offset: 0,
        order: 'desc'
      })

      // 转换消息格式并获取音频URL
      const historyMessages = await Promise.all(
        response.messages.map(convertMessageToChatMessage)
      )

      // 如果没有历史消息，添加欢迎消息
      if (historyMessages.length === 0) {
        setMessages([{
          id: generateMessageId(),
          role: 'assistant',
          content: '你好！我是你的AI面试助手。我可以帮你：\n\n• **语音练习** - 说"我想练习xxx问题"  \n• **答案优化** - 说"帮我优化这个回答"   \n• **写逐字稿** - 说"帮我写xxx问题的回答"  \n• **简历优化** - 说"帮我优化简历"\n\n其他和面试有关的问题都可以和我聊一聊哦！',
          type: 'text',
          timestamp: new Date().toISOString()
        }])
      } else {
        setMessages(historyMessages)
      }

      setHasMoreHistory(response.has_more)
      setHistoryOffset(response.messages.length)
      setHistoryLoaded(true)
    } catch (error) {
      console.error('Failed to load history:', error)
      // 加载失败时显示欢迎消息
      setMessages([{
        id: generateMessageId(),
        role: 'assistant',
        content: '你好！我是你的AI面试助手。我可以帮你：\n\n• **语音练习** - 说"我想练习xxx问题"  \n• **答案优化** - 说"帮我优化这个回答"   \n• **写逐字稿** - 说"帮我写xxx问题的回答"  \n• **简历优化** - 说"帮我优化简历"\n\n其他和面试有关的问题都可以和我聊一聊哦！',
        type: 'text',
        timestamp: new Date().toISOString()
      }])
      setHistoryLoaded(true)
    } finally {
      setIsLoadingHistory(false)
    }
  }, [sessionId, historyLoaded])

  // 加载更多历史消息（向上滚动时调用）
  const loadMoreHistory = useCallback(async () => {
    if (isLoadingHistory || !hasMoreHistory || !sessionId) return

    setIsLoadingHistory(true)
    try {
      const response = await messagesApi.list(sessionId, {
        limit: 20,
        offset: historyOffset,
        order: 'desc'
      })

      const olderMessages = await Promise.all(
        response.messages.map(convertMessageToChatMessage)
      )

      // 将旧消息添加到列表开头
      setMessages(prev => [...olderMessages, ...prev])
      setHasMoreHistory(response.has_more)
      setHistoryOffset(prev => prev + response.messages.length)
    } catch (error) {
      console.error('Failed to load more history:', error)
    } finally {
      setIsLoadingHistory(false)
    }
  }, [sessionId, historyOffset, isLoadingHistory, hasMoreHistory])

  // 页面加载时获取历史消息
  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // 连接 WebSocket（支持 sessionId 变化时平滑切换）
  useEffect(() => {
    if (!sessionId) return

    // 清除之前的防抖定时器
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current)
    }

    // 关闭旧连接
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    // 重置状态（切换会话时清空）
    setMessages([])
    setAgentStatus('idle')
    setRecordingState(initialRecordingState)
    setTranscription(initialTranscriptionState)
    setIsStreaming(false)
    setStreamingContent('')
    setIsFeedbackStreaming(false)
    setFeedbackStreamingContent('')
    setHistoryLoaded(false)
    setHistoryOffset(0)
    setHasMoreHistory(true)
    setIsSubmitted(false)
    setPendingQuery('')
    setMessageContext(null)

    // 防抖：延迟 50ms 建立新连接，避免快速切换时的竞态
    connectTimeoutRef.current = setTimeout(async () => {
      // 获取 JWT Token 用于 WebSocket 认证
      const token = getAuthToken()
      if (!token) {
        console.error('No auth token, cannot connect WebSocket')
        return
      }

      // 使用环境变量配置 WebSocket URL
      const wsBaseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8001'
      const wsUrl = `${wsBaseUrl}/ws/chat/${sessionId}?token=${encodeURIComponent(token)}`
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('WebSocket connected')
        setIsConnected(true)
      }

      ws.onmessage = (event) => {
        const message: ServerMessage = JSON.parse(event.data)
        console.log('WebSocket message:', message)

        // 更新 Agent 状态
        if (message.agent_status) {
          setCurrentAgent(message.agent_status.current_agent as CurrentAgent)
          setAgentStatus(message.agent_status.status as AgentStatus)
        }

        // 根据消息类型处理
        switch (message.type) {
          case 'assistant_message':
            setAgentStatus('idle')
            // 跳过空内容消息，避免产生多余的空气泡
            if (message.content?.trim()) {
              setMessages((prev) => [...prev, {
                id: generateMessageId(),
                role: 'assistant',
                content: message.content || '',
                type: 'text',
                assetId: message.asset_id,  // 支持关联 Asset
                timestamp: message.timestamp
              }])
            }
            break

          // 流式消息处理
          case 'assistant_message_stream_start':
            // 埋点：首字响应时间
            performanceTiming.markEndAndTrack('ttft_chat', AnalyticsEvents.TTFT_CHAT_STREAM)

            setIsStreaming(true)
            setStreamingContent('')
            setAgentStatus('idle')  // 流式开始后停止3点动画
            break

          case 'assistant_message_chunk':
            setStreamingContent(prev => prev + (message.content || ''))
            break

          case 'assistant_message_stream_end':
            // 埋点：完整响应时间
            performanceTiming.markEndAndTrack('response_total', AnalyticsEvents.RESPONSE_TOTAL_DURATION)

            setIsStreaming(false)
            setAgentStatus('idle')
            // 将完整消息添加到消息列表（使用后端返回的 message_id）
            const streamEndMsgId = (message as any).message_id || generateMessageId()
            const streamEndMsg: ChatMessage = {
              id: streamEndMsgId,
              role: 'assistant',
              content: message.full_content || streamingContentRef.current,
              type: 'text',
              assetId: message.asset_id,  // 关联保存的 Asset
              timestamp: message.timestamp
            }
            // 如果有待保存数据，绑定到消息上
            if (message.pending_save) {
              streamEndMsg.pendingSave = {
                ...message.pending_save,
                messageId: streamEndMsgId
              }
              streamEndMsg.saveStatus = 'unsaved'
            }
            setMessages((prev) => [...prev, streamEndMsg])
            setStreamingContent('')
            // 如果有新保存的 Asset，通知侧边栏高亮
            if (message.asset_id) {
              setNewAssetId(message.asset_id)
            }
            break

          case 'recording_start':
            // AI要求开始录音，自动弹出录音卡片
            setAgentStatus('recording')
            const question = message.recording?.question || ''
            setRecordingState({
              isActive: true,
              isRecording: false,  // 用户需要手动开始
              question,
              duration: 0
            })
            // 添加录音提示消息
            setMessages((prev) => [...prev, {
              id: generateMessageId(),
              role: 'assistant',
              content: '请点击下方按钮开始录音回答',
              type: 'recording_prompt',
              question,
              timestamp: message.timestamp
            }])
            break

          case 'transcription':
            console.log('>>> 收到 transcription 消息:', message.timestamp)
            setAgentStatus('transcribing')
            setTranscription({
              text: message.transcription?.text || null,
              isFinal: message.transcription?.is_final || false
            })
            if (message.transcription?.is_final) {
              // 转录完成，立即添加用户语音消息（含音频文件ID和句子时间戳）
              const userVoiceMsgId = generateMessageId()
              const userVoiceMsg: ChatMessage = {
                id: userVoiceMsgId,
                role: 'user',
                content: message.transcription?.text || '',
                type: 'audio',
                transcription: message.transcription?.text,
                transcriptSentences: message.transcript_sentences,  // 带时间戳的句子
                audioFileId: message.audio_file_id,  // 音频文件ID
                audioUrl: audioPreviewUrlRef.current || undefined,  // 先用本地预览URL
                timestamp: message.timestamp
              }
              console.log('>>> 添加用户语音消息:', userVoiceMsgId, 'previewUrl:', !!audioPreviewUrlRef.current)
              setMessages((prev) => [...prev, userVoiceMsg])

              // 如果有音频文件ID，获取服务端签名URL替换本地预览
              if (message.audio_file_id) {
                audioApi.getUrl(message.audio_file_id)
                  .then(({ url }) => {
                    setMessages(prev => prev.map(m =>
                      m.id === userVoiceMsgId ? { ...m, audioUrl: url } : m
                    ))
                  })
                  .catch(e => console.error('获取音频 URL 失败:', e))
              }

              setAgentStatus('analyzing')  // 显示3点等待动画
            }
            break

          // 流式反馈消息处理
          case 'feedback_stream_start':
            console.log('>>> 收到 feedback_stream_start 消息')
            // 埋点：反馈首字响应时间
            performanceTiming.markEndAndTrack('ttft_feedback', AnalyticsEvents.TTFT_FEEDBACK)

            setIsFeedbackStreaming(true)
            setFeedbackStreamingContent('')
            setAgentStatus('idle')  // 流式开始后停止3点动画
            break

          case 'feedback_chunk':
            setFeedbackStreamingContent(prev => prev + (message.content || ''))
            break

          case 'feedback_stream_end':
            console.log('>>> 收到 feedback_stream_end 消息:', message.timestamp)
            // 埋点：录音到反馈完成时间
            performanceTiming.markEndAndTrack('recording_to_feedback', AnalyticsEvents.RECORDING_TO_FEEDBACK)

            setIsFeedbackStreaming(false)
            setFeedbackStreamingContent('')
            setAgentStatus('idle')
            setRecordingState(initialRecordingState)
            setTranscription(initialTranscriptionState)
            setIsSubmitted(false)

            // 添加反馈消息
            const feedbackStreamEndMsg: ChatMessage = {
              id: generateMessageId(),
              role: 'assistant',
              content: message.full_content || feedbackStreamingContentRef.current || '分析完成',
              type: 'feedback',
              feedback: message.feedback,
              assetId: message.asset_id,
              timestamp: message.timestamp
            }
            setMessages((prev) => [...prev, feedbackStreamEndMsg])
            break

          case 'feedback':
            console.log('>>> 收到 feedback 消息:', message.timestamp)
            setAgentStatus('idle')
            setRecordingState(initialRecordingState)
            setTranscription(initialTranscriptionState)
            setIsSubmitted(false)  // 重置提交状态

            // 添加反馈消息（使用 XML 格式的 content）
            const feedbackMsg: ChatMessage = {
              id: generateMessageId(),
              role: 'assistant',
              content: message.content || message.feedback?.raw_content || '分析完成',
              type: 'feedback',
              feedback: message.feedback,
              assetId: message.asset_id,
              timestamp: message.timestamp
            }

            setMessages((prev) => [...prev, feedbackMsg])
            break

          case 'error':
            setAgentStatus('idle')
            setRecordingState(initialRecordingState)
            setIsStreaming(false)
            setStreamingContent('')
            console.error('WebSocket error:', message.error || message.content)
            setMessages((prev) => [...prev, {
              id: generateMessageId(),
              role: 'assistant',
              content: message.error || message.content || '发生错误，请重试',
              type: 'text',
              timestamp: message.timestamp
            }])
            break

          case 'generation_cancelled':
            // 服务端确认取消，保留已生成的内容
            console.log('Generation cancelled by server, partial_content:', message.partial_content, 'streamingContentRef:', streamingContentRef.current)
            setAgentStatus('idle')
            setIsStreaming(false)

            // 获取已生成的部分内容（优先使用服务端返回的，否则使用本地流式内容 ref）
            const partialContent = message.partial_content || streamingContentRef.current

            if (partialContent) {
              // 保留已生成的内容，并添加暂停提示
              setMessages((prev) => [...prev, {
                id: generateMessageId(),
                role: 'assistant',
                content: partialContent,
                type: 'text',
                timestamp: message.timestamp,
                isCancelled: true  // 标记为已取消的消息
              }])
            }

            setStreamingContent('')
            break

          default:
            console.warn('Unknown message type:', message.type, message)
            // 只有非空 content 才创建气泡，避免状态消息产生多余气泡
            if (message.content && message.content.trim()) {
              setMessages((prev) => [...prev, {
                id: generateMessageId(),
                role: 'assistant',
                content: message.content || '',
                type: 'text',
                timestamp: message.timestamp
              }])
            }
            setAgentStatus('idle')
            break
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        // 埋点：WebSocket 错误
        analytics.track(AnalyticsEvents.STREAM_ERROR, {
          error_message: 'WebSocket error',
        })
      }

      ws.onclose = () => {
        console.log('WebSocket disconnected')
        // 埋点：WebSocket 断开
        analytics.track(AnalyticsEvents.WEBSOCKET_DISCONNECT, {
          session_id: sessionId,
        })
        setIsConnected(false)
      }

      wsRef.current = ws
    }, 50)  // 50ms 防抖

    return () => {
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current)
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [sessionId])

  // 发送文本消息
  const sendMessage = useCallback((content: string, context?: MessageContext) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const timestamp = new Date().toISOString()

      // 埋点：开始计时
      performanceTiming.markStart('ttft_chat')
      performanceTiming.markStart('response_total')

      // 保存用户输入（用于取消后恢复）
      setPendingQuery(content)

      // 使用传入的 context 或当前状态中的 messageContext
      const contextToSend = context || messageContext

      // 发送消息到服务器（包含 context）
      wsRef.current.send(JSON.stringify({
        type: 'message',
        content,
        context: contextToSend,
        timestamp
      }))

      // 发送后清空 messageContext
      if (contextToSend) {
        setMessageContext(null)
      }

      // 立即显示用户消息
      setMessages((prev) => [...prev, {
        id: generateMessageId(),
        role: 'user',
        content,
        type: 'text',
        timestamp
      }])

      // 设置为思考状态
      setAgentStatus('thinking')
    }
  }, [messageContext])

  // 提交音频
  const submitAudio = useCallback((audioData: string, previewUrl?: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const timestamp = new Date().toISOString()

      // 埋点：开始计时（录音到反馈）
      performanceTiming.markStart('ttft_feedback')
      performanceTiming.markStart('recording_to_feedback')

      wsRef.current.send(JSON.stringify({
        type: 'audio',
        audio_data: audioData,
        timestamp
      }))

      // 保存本地预览URL
      audioPreviewUrlRef.current = previewUrl || null

      // 停止录音计时器
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }

      // 更新状态
      setRecordingState((prev) => ({
        ...prev,
        isRecording: false
      }))

      // 更新 recording_prompt 消息的提交状态（排除已取消的）
      setMessages((prev) => prev.map(msg =>
        msg.type === 'recording_prompt' && !msg.isRecordingSubmitted && !msg.isRecordingCancelled
          ? { ...msg, isRecordingSubmitted: true }
          : msg
      ))

      setIsSubmitted(true)  // 设置为已提交状态
      setAgentStatus('transcribing')
    }
  }, [])

  // 开始录音（用户手动点击）
  const startRecording = useCallback(() => {
    setRecordingState((prev) => ({
      ...prev,
      isRecording: true,
      duration: 0
    }))

    // 开始计时
    recordingTimerRef.current = setInterval(() => {
      setRecordingState((prev) => ({
        ...prev,
        duration: prev.duration + 1
      }))
    }, 1000)
  }, [])

  // 停止录音
  const stopRecording = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }

    setRecordingState((prev) => ({
      ...prev,
      isRecording: false
    }))
  }, [])

  // 取消录音
  const cancelRecording = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }

    // 发送取消录音消息到后端（持久化）
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'cancel_recording',
        timestamp: new Date().toISOString()
      }))
    }

    // 立即更新前端状态
    setMessages(prev => prev.map(msg =>
      msg.type === 'recording_prompt' && !msg.isRecordingSubmitted && !msg.isRecordingCancelled
        ? { ...msg, isRecordingCancelled: true }
        : msg
    ))

    setRecordingState(initialRecordingState)
    setAgentStatus('idle')
  }, [])

  // 取消生成（停止模型输出）
  const cancelGeneration = useCallback((): string => {
    // 发送取消消息到服务器
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'cancel',
        timestamp: new Date().toISOString()
      }))
    }

    // 只重置 agent 状态，不清空 streamingContent
    // streamingContent 会在收到 generation_cancelled 消息后处理
    setAgentStatus('idle')
    setMessageContext(null)  // 清除消息上下文，避免影响下一次发送

    // 返回待恢复的query并清空
    const queryToRestore = pendingQuery
    setPendingQuery('')
    return queryToRestore
  }, [pendingQuery])

  // 构建状态对象
  const state = {
    isConnected,
    messages,
    agentStatus,
    currentAgent,
    recordingState,
    transcription,
    isLoadingHistory,
    hasMoreHistory,
    isSubmitted,  // 新增
    isStreaming,  // 新增：流式状态
    streamingContent,  // 新增：流式内容
    isFeedbackStreaming,  // 新增：流式反馈状态
    feedbackStreamingContent,  // 新增：流式反馈内容
    projectId,  // 新增：项目ID
    pendingQuery,  // 新增：待恢复的用户输入
    messageContext,  // 新增：消息上下文
    newAssetId,  // 新增：新保存的 Asset ID（用于侧边栏高亮）
  }

  // 清除新 Asset 高亮
  const clearNewAssetId = useCallback(() => {
    setNewAssetId(null)
  }, [])

  // 确认保存（用户点击"保存到练习记录"后调用，按消息ID）
  const confirmSave = useCallback(async (messageId: string) => {
    // 从消息列表中查找对应消息的 pendingSave 数据
    const targetMsg = messages.find(m => m.id === messageId)
    if (!targetMsg?.pendingSave) return

    try {
      const result = await assetsApi.confirmSave({
        question: targetMsg.pendingSave.question,
        transcript: targetMsg.pendingSave.transcript,
        project_id: targetMsg.pendingSave.project_id,
        message_id: messageId
      })
      // 保存成功，更新该消息的 saveStatus 为 'saved'
      setMessages(prev => prev.map(m =>
        m.id === messageId
          ? { ...m, saveStatus: 'saved' as const, assetId: result.asset_id, pendingSave: null }
          : m
      ))
      // 设置新 Asset ID 以高亮侧边栏
      setNewAssetId(result.asset_id)
    } catch (error) {
      console.error('保存失败:', error)
    }
  }, [messages])

  // 切换消息点赞状态
  const toggleLike = useCallback(async (messageId: string) => {
    try {
      const result = await messagesApi.toggleLike(messageId)
      // 更新本地消息状态
      setMessages(prev => prev.map(msg =>
        msg.id === messageId
          ? { ...msg, liked: result.liked }
          : msg
      ))
    } catch (error) {
      console.error('点赞失败:', error)
    }
  }, [])

  return {
    state,
    sendMessage,
    setMessageContext,
    submitAudio,
    startRecording,
    stopRecording,
    cancelRecording,
    cancelGeneration,
    loadMoreHistory,
    clearNewAssetId,  // 清除高亮
    confirmSave,  // 确认保存（按消息ID）
    toggleLike,  // 切换点赞
  }
}
