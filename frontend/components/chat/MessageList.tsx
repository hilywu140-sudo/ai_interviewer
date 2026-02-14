'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { ChatMessage, AgentStatus, RecordingState, TranscriptSentence } from '@/lib/types'
import { AgentStatusBar } from './AgentStatusBar'
import { RecordingCard } from './RecordingCard'
import { AudioPlayer } from './AudioPlayer'
import { audioApi } from '@/lib/api-client'
import { Avatar } from '@/components/ui/Avatar'
import { OptimizedAnswerDisplay } from './OptimizedAnswerDisplay'
import { hasAnyXmlTags } from '@/lib/xml-parser'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'


// Helper: format date for separator
function formatMessageDate(timestamp?: string): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diff = today.getTime() - msgDate.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

// Helper: check if two messages are on different dates
function isDifferentDate(a?: string, b?: string): boolean {
  if (!a || !b) return false
  const da = new Date(a).toDateString()
  const db = new Date(b).toDateString()
  return da !== db
}

interface MessageListProps {
  messages: ChatMessage[]
  agentStatus: AgentStatus
  recordingState: RecordingState
  isSubmitted?: boolean
  isLoadingHistory?: boolean
  hasMoreHistory?: boolean
  isStreaming?: boolean
  streamingContent?: string
  isFeedbackStreaming?: boolean
  feedbackStreamingContent?: string
  onStartRecording: () => void
  onStopRecording: () => void
  onCancelRecording: () => void
  onSubmitAudio: (audioData: string, previewUrl?: string) => void
  onLoadMore?: () => void
  onEditAsset?: (assetId: string, content: string) => void
  onConfirmSave?: (messageId: string) => void
}

export function MessageList({
  messages,
  agentStatus,
  recordingState,
  isSubmitted = false,
  isLoadingHistory = false,
  hasMoreHistory = false,
  isStreaming = false,
  streamingContent = '',
  isFeedbackStreaming = false,
  feedbackStreamingContent = '',
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  onSubmitAudio,
  onLoadMore,
  onEditAsset,
  onConfirmSave
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)

  // 自动滚动到底部
  useEffect(() => {
    if (shouldAutoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, agentStatus, shouldAutoScroll, streamingContent, feedbackStreamingContent])

  // 处理滚动事件
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current

    if (scrollTop < 100 && hasMoreHistory && !isLoadingHistory && onLoadMore) {
      onLoadMore()
    }

    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
    setShouldAutoScroll(isNearBottom)
  }, [hasMoreHistory, isLoadingHistory, onLoadMore])

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4 bg-white"
      onScroll={handleScroll}
    >
      {/* 消息容器 - 居中 */}
      <div className="max-w-3xl mx-auto">
      {/* 加载更多历史消息指示器 */}
      {isLoadingHistory && (
        <div className="flex justify-center py-2">
          <div className="flex items-center gap-2 text-cream-400 text-sm">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-warm-300" />
            <span className="font-light">加载中...</span>
          </div>
        </div>
      )}

      {/* 加载更多按钮 */}
      {hasMoreHistory && !isLoadingHistory && (
        <button
          onClick={onLoadMore}
          className="w-full py-2 text-sm text-cream-400 hover:text-warm-300 hover:bg-cream-200 rounded-button transition-all"
        >
          加载更早的消息
        </button>
      )}

      {/* 欢迎空状态 */}
      {messages.length === 0 && !isStreaming && (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
          <div className="w-16 h-16 bg-warm-50 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-warm-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-ink-300 mb-2">准备好开始练习了吗？</h2>
          <p className="text-sm text-cream-400 max-w-sm">
            输入你想练习的面试问题，或者告诉我你想准备哪方面的内容
          </p>
        </div>
      )}

      {messages.map((message, index) => {
        const prevMessage = index > 0 ? messages[index - 1] : null
        const showDateSeparator = prevMessage && isDifferentDate(prevMessage.timestamp, message.timestamp)
        const isSameSender = prevMessage && prevMessage.role === message.role
        const spacing = index === 0 ? '' : isSameSender ? 'mt-2' : 'mt-5'

        return (
          <div key={message.id}>
            {showDateSeparator && (
              <div className={`date-separator ${index === 0 ? '' : 'mt-5'}`}>
                <span className="text-xs text-cream-400">{formatMessageDate(message.timestamp)}</span>
              </div>
            )}
            <div className={spacing}>
              <MessageBubble
                message={message}
                recordingState={recordingState}
                isSubmitted={isSubmitted}
                onStartRecording={onStartRecording}
                onStopRecording={onStopRecording}
                onCancelRecording={onCancelRecording}
                onSubmitAudio={onSubmitAudio}
                onEditAsset={onEditAsset}
                onConfirmSave={onConfirmSave}
              />
            </div>
          </div>
        )
      })}

      {/* 流式消息显示（打字机效果） */}
      {isStreaming && streamingContent && (
        <div className="flex justify-start gap-3">
          <Avatar type="assistant" />
          <div className="max-w-[85%] bg-white bubble-assistant shadow-bubble px-5 py-3">
            {hasAnyXmlTags(streamingContent) ? (
              <OptimizedAnswerDisplay content={streamingContent} isStreaming={true} />
            ) : (
              <div className="prose prose-sm max-w-none prose-warm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {streamingContent}
                </ReactMarkdown>
                <span className="streaming-cursor" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 流式反馈显示（录音分析结果） */}
      {isFeedbackStreaming && feedbackStreamingContent && (
        <div className="flex justify-start gap-3">
          <Avatar type="assistant" />
          <div className="max-w-[90%]">
            <div className="bg-white rounded-2xl px-5 py-4">
              <OptimizedAnswerDisplay content={feedbackStreamingContent} isStreaming={true} />
            </div>
          </div>
        </div>
      )}

      {/* 加载状态指示器 */}
      {agentStatus !== 'idle' && agentStatus !== 'recording' && (
        <AgentStatusBar status={agentStatus} />
      )}

      <div ref={messagesEndRef} />
      </div>
    </div>
  )
}

// 消息气泡组件
interface MessageBubbleProps {
  message: ChatMessage
  recordingState: RecordingState
  isSubmitted?: boolean
  onStartRecording: () => void
  onStopRecording: () => void
  onCancelRecording: () => void
  onSubmitAudio: (audioData: string, previewUrl?: string) => void
  onEditAsset?: (assetId: string, content: string) => void
  onConfirmSave?: (messageId: string) => void
}

function MessageBubble({
  message,
  recordingState,
  isSubmitted = false,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  onSubmitAudio,
  onEditAsset,
  onConfirmSave
}: MessageBubbleProps) {
  const isUser = message.role === 'user'

  // 录音提示消息 - 显示录音卡片或已完成状态
  if (message.type === 'recording_prompt') {
    // 已取消：显示问题气泡 + 已取消录音（优先判断，不受全局 isSubmitted 影响）
    if (message.isRecordingCancelled) {
      return (
        <div className="flex justify-start gap-3">
          <Avatar type="assistant" />
          <div className="flex flex-col">
            <div className="bg-cream-50 border border-cream-200 rounded-2xl shadow-bubble px-5 py-3">
              <p className="text-sm text-ink-200 leading-relaxed whitespace-nowrap">{message.question}</p>
            </div>
            <div className="text-xs text-cream-400 mt-2 ml-1">
              您已取消录音
            </div>
          </div>
        </div>
      )
    }
    // 已提交：显示问题气泡 + 已完成练习
    if (isSubmitted || message.isRecordingSubmitted) {
      return (
        <div className="flex justify-start gap-3">
          <Avatar type="assistant" />
          <div className="flex flex-col">
            <div className="bg-cream-50 border border-cream-200 rounded-2xl shadow-bubble px-5 py-3">
              <p className="text-sm text-ink-200 leading-relaxed whitespace-nowrap">{message.question}</p>
            </div>
            <div className="text-xs text-warm-400 mt-2 ml-1">
              已完成练习 👏
            </div>
          </div>
        </div>
      )
    }
    // 未提交：显示录音卡片
    return (
      <div className="flex justify-start gap-3">
        <Avatar type="assistant" />
        <div className="max-w-[85%]">
          <RecordingCard
            question={message.question || ''}
            recordingState={recordingState}
            isSubmitted={isSubmitted}
            onStartRecording={onStartRecording}
            onStopRecording={onStopRecording}
            onCancelRecording={onCancelRecording}
            onSubmitAudio={onSubmitAudio}
          />
        </div>
      </div>
    )
  }

  // 反馈消息 - 使用 OptimizedAnswerDisplay 渲染 XML 内容
  if (message.type === 'feedback') {
    return (
      <div className="flex justify-start gap-3">
        <Avatar type="assistant" />
        <div className="max-w-[90%]">
          <div className="bg-white rounded-2xl px-5 py-4">
            <OptimizedAnswerDisplay content={message.content} />
            {/* 已保存提示 */}
            {message.assetId && (
              <div className="mt-4 pt-4 border-t border-cream-200">
                <div className="flex items-center gap-2 text-sage-300">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium">已自动保存到练习记录</span>
                </div>
                <p className="text-xs text-sage-200 mt-1 ml-6 font-light">
                  如需优化回答，请在聊天中输入"帮我优化这个回答"
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 用户语音消息 - 显示音频播放器 + 带时间戳的逐字稿
  if (message.type === 'audio' && isUser) {
    return (
      <div className="flex justify-end gap-3">
        <div className="flex flex-col items-end w-80">
          {/* 音频播放器 - 气泡上方 */}
          {message.audioUrl && (
            <div className="mb-2 w-full">
              <AudioPlayer src={message.audioUrl} className="bg-warm-100 rounded-xl px-3 py-2" />
            </div>
          )}

          {/* 消息气泡 */}
          <div className="bg-warm-300 text-white bubble-user shadow-bubble px-5 py-3 w-full">
            {/* 语音消息标识 */}
            <div className="flex items-center gap-2 mb-2 text-xs opacity-60">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
              语音回答
            </div>

            {/* 带时间戳的逐字稿 */}
            {message.transcriptSentences && message.transcriptSentences.length > 0 ? (
              <TranscriptWithTimestamps sentences={message.transcriptSentences} />
            ) : (
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {message.content}
              </div>
            )}
          </div>
        </div>
        <Avatar type="user" />
      </div>
    )
  }

  // 普通消息气泡
  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && <Avatar type="assistant" />}
      <div className="flex flex-col max-w-[85%]">
        <div
          className={
            isUser
              ? 'bg-warm-300 text-white bubble-user shadow-bubble px-5 py-3'
              : 'bg-white bubble-assistant shadow-bubble px-5 py-3'
          }
        >
          {/* 消息内容 */}
          {!isUser && hasAnyXmlTags(message.content) ? (
            <OptimizedAnswerDisplay
              content={message.content}
              assetId={message.assetId}
              onEdit={onEditAsset}
            />
          ) : !isUser ? (
            <div className="prose prose-sm max-w-none prose-warm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {message.content}
            </div>
          )}
        </div>
        {/* 暂停提示 */}
        {message.isCancelled && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-rose-200">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>您已暂停回答</span>
          </div>
        )}
        {/* 保存按钮（绑定到消息） */}
        {!isUser && message.saveStatus === 'unsaved' && message.pendingSave && (
          <button
            onClick={() => onConfirmSave?.(message.id)}
            className="mt-3 text-sm text-warm-300 hover:text-warm-400 underline underline-offset-4 decoration-warm-200 self-start transition-colors"
          >
            保存到练习记录
          </button>
        )}
        {!isUser && message.saveStatus === 'saved' && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-sage-300">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>已保存到练习记录</span>
          </div>
        )}
      </div>
      {isUser && <Avatar type="user" />}
    </div>
  )
}

// 带时间戳的逐字稿组件
interface TranscriptWithTimestampsProps {
  sentences: TranscriptSentence[]
}

function TranscriptWithTimestamps({ sentences }: TranscriptWithTimestampsProps) {
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-2 text-sm">
      {sentences.map((sentence) => (
        <div key={sentence.id} className="flex gap-2">
          <span className="text-white/50 text-xs whitespace-nowrap mt-0.5 tabular-nums">
            {formatTime(sentence.start)}
          </span>
          <span className="leading-relaxed">{sentence.text}</span>
        </div>
      ))}
    </div>
  )
}
