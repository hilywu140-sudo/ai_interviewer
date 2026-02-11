'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { ChatMessage, AgentStatus, RecordingState, PracticeFeedback, TranscriptSentence } from '@/lib/types'
import { AgentStatusBar } from './AgentStatusBar'
import { RecordingCard } from './RecordingCard'
import FeedbackCard from '@/components/FeedbackCard'
import { AudioPlayer } from './AudioPlayer'
import { audioApi } from '@/lib/api-client'
import { Avatar } from '@/components/ui/Avatar'
import { OptimizedAnswerDisplay } from './OptimizedAnswerDisplay'
import { hasAnyXmlTags } from '@/lib/xml-parser'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MessageListProps {
  messages: ChatMessage[]
  agentStatus: AgentStatus
  recordingState: RecordingState
  isSubmitted?: boolean
  isLoadingHistory?: boolean
  hasMoreHistory?: boolean
  isStreaming?: boolean
  streamingContent?: string
  onStartRecording: () => void
  onStopRecording: () => void
  onCancelRecording: () => void
  onSubmitAudio: (audioData: string) => void
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
  }, [messages, agentStatus, shouldAutoScroll, streamingContent])

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
      className="flex-1 overflow-y-auto p-4 space-y-5 bg-cream-100"
      onScroll={handleScroll}
    >
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

      {messages.map((message) => (
        <MessageBubble
          key={message.id}
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
      ))}

      {/* 流式消息显示（打字机效果） */}
      {isStreaming && streamingContent && (
        <div className="flex justify-start gap-3">
          <Avatar type="assistant" />
          <div className="max-w-[85%] border-l-2 border-warm-200 pl-4">
            {hasAnyXmlTags(streamingContent) ? (
              <OptimizedAnswerDisplay content={streamingContent} isStreaming={true} />
            ) : (
              <div className="prose prose-sm max-w-none prose-warm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {streamingContent}
                </ReactMarkdown>
                <span className="inline-block w-2 h-4 ml-1 bg-warm-300 animate-pulse-warm" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 加载状态指示器 */}
      {agentStatus !== 'idle' && agentStatus !== 'recording' && (
        <AgentStatusBar status={agentStatus} />
      )}

      <div ref={messagesEndRef} />
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
  onSubmitAudio: (audioData: string) => void
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

  // 录音提示消息 - 显示录音卡片
  if (message.type === 'recording_prompt') {
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

  // 反馈消息 - 显示 FeedbackCard
  if (message.type === 'feedback' && message.feedback) {
    return (
      <div className="flex justify-start gap-3">
        <Avatar type="assistant" />
        <div className="max-w-[90%]">
          <FeedbackCard
            feedback={message.feedback}
            assetId={message.assetId}
          />
        </div>
      </div>
    )
  }

  // 用户语音消息 - 显示音频播放器 + 带时间戳的逐字稿
  if (message.type === 'audio' && isUser) {
    return (
      <div className="flex justify-end gap-3">
        <div className="max-w-[85%] bg-ink-300 text-cream-50 rounded-card px-5 py-3">
          {/* 语音消息标识 */}
          <div className="flex items-center gap-2 mb-2 text-xs opacity-60">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
            </svg>
            语音回答
          </div>

          {/* 音频播放器 */}
          {message.audioUrl && (
            <div className="mb-3">
              <AudioPlayer src={message.audioUrl} className="bg-ink-200" />
            </div>
          )}

          {/* 带时间戳的逐字稿 */}
          {message.transcriptSentences && message.transcriptSentences.length > 0 ? (
            <TranscriptWithTimestamps sentences={message.transcriptSentences} />
          ) : (
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {message.content}
            </div>
          )}
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
              ? 'bg-ink-300 text-cream-50 rounded-card px-5 py-3'
              : 'border-l-2 border-warm-200 pl-4'
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
          <span className="text-cream-300 text-xs whitespace-nowrap mt-0.5 font-display">
            {formatTime(sentence.start)}
          </span>
          <span className="leading-relaxed">{sentence.text}</span>
        </div>
      ))}
    </div>
  )
}
