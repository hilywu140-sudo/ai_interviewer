'use client'

import { useState, KeyboardEvent, useEffect, useRef } from 'react'
import { QuickActions } from '@/components/ui/QuickActions'
import { MessageContext } from '@/lib/types'

interface ChatInputProps {
  onSendMessage: (content: string) => void
  disabled?: boolean
  placeholder?: string
  value?: string  // 受控输入值
  onChange?: (value: string) => void  // 受控输入变化回调
  showStopButton?: boolean  // 是否显示停止按钮
  onStop?: () => void  // 停止按钮点击回调
  messageContext?: MessageContext | null  // 消息上下文（用于逐字稿修改）
  onClearContext?: () => void  // 清除上下文回调
}

export function ChatInput({
  onSendMessage,
  disabled = false,
  placeholder = '输入消息...',
  value: controlledValue,
  onChange: onControlledChange,
  showStopButton = false,
  onStop,
  messageContext,
  onClearContext
}: ChatInputProps) {
  const [internalInput, setInternalInput] = useState('')
  const [showHint, setShowHint] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 支持受控和非受控模式
  const isControlled = controlledValue !== undefined
  const input = isControlled ? controlledValue : internalInput
  const setInput = isControlled ? (onControlledChange || (() => {})) : setInternalInput

  // 计算前缀（当有 messageContext 时）
  const prefix = messageContext
    ? `练习问题是${messageContext.question.slice(0, 20)}${messageContext.question.length > 20 ? '...' : ''}，这是它的逐字稿，`
    : ''

  // 当 messageContext 变化时，设置初始提示文字
  useEffect(() => {
    if (messageContext) {
      // 设置初始提示：前缀 + "请输入你的需求"
      setInput(prefix + '请输入你的需求')
      // 聚焦并选中"请输入你的需求"部分
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          textareaRef.current.setSelectionRange(prefix.length, prefix.length + 8)
        }
      }, 0)
    }
  }, [messageContext?.asset_id])  // 只在 asset_id 变化时触发

  // 当受控值变化时，如果有内容则显示提示
  useEffect(() => {
    if (isControlled && controlledValue && !messageContext) {
      setShowHint(true)
    }
  }, [isControlled, controlledValue, messageContext])

  const handleSend = () => {
    const trimmed = input.trim()
    if (trimmed && !disabled) {
      onSendMessage(trimmed)
      setInput('')
      setShowHint(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleQuickAction = (prompt: string) => {
    if (messageContext) {
      // 有上下文时，将快捷按钮文字追加到前缀后面
      setInput(prefix + prompt)
    } else {
      setInput(prompt)
    }
    setShowHint(true)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value

    if (messageContext) {
      // 有上下文时，确保前缀不被删除
      if (newValue.startsWith(prefix)) {
        setInput(newValue)
      } else if (newValue.length < prefix.length) {
        // 用户试图删除前缀，保持前缀
        setInput(prefix)
      } else {
        // 其他情况，保持前缀
        setInput(prefix + newValue.slice(prefix.length))
      }
    } else {
      setInput(newValue)
      if (!newValue) setShowHint(false)
    }
  }

  // 处理清除上下文
  const handleClearContext = () => {
    setInput('')  // 清空输入框
    onClearContext?.()
  }

  // 计算发送按钮是否可用
  const canSend = messageContext
    ? input.trim().length > prefix.length  // 有上下文时，需要有额外内容
    : input.trim().length > 0

  return (
    <div className="bg-cream-50">
      {/* 快捷按钮 */}
      <QuickActions onSelect={handleQuickAction} disabled={disabled} />

      {/* 输入区域 */}
      <div className="px-4 pb-4">
        <div className="relative">
          {/* 上下文提示条（带取消按钮） */}
          {messageContext && (
            <div className="flex items-center justify-between bg-warm-50 border border-warm-100 rounded-t-[12px] px-3 py-2 border-b-0">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-warm-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-xs text-warm-400">
                  已载入逐字稿
                </span>
              </div>
              <button
                onClick={handleClearContext}
                className="p-1 hover:bg-warm-100 rounded transition-colors text-warm-300 hover:text-warm-400"
                title="取消"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* 提示文字（无上下文时） */}
          {showHint && !messageContext && (
            <p className="text-xs text-cream-400 mb-2 font-light">
              可在后面输入额外的要求，如具体的问题或场景
            </p>
          )}

          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={disabled}
                rows={1}
                className={`w-full resize-none bg-cream-100 border-0 px-4 py-3
                           focus:ring-1 focus:ring-warm-200
                           disabled:bg-cream-200 disabled:cursor-not-allowed disabled:text-cream-400
                           text-sm text-ink-300 placeholder-cream-400
                           ${messageContext ? 'rounded-b-[12px] rounded-t-none' : 'rounded-[12px]'}`}
                style={{ minHeight: '48px', maxHeight: '120px' }}
              />
            </div>

            {/* 停止按钮 */}
            {showStopButton ? (
              <button
                onClick={onStop}
                className="flex-shrink-0 w-10 h-10 rounded-full bg-rose-300 hover:bg-rose-200
                           text-cream-50 transition-all duration-200
                           flex items-center justify-center"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={disabled || !canSend}
                className="flex-shrink-0 w-10 h-10 rounded-full bg-ink-300 hover:bg-ink-200
                           disabled:bg-cream-300 disabled:cursor-not-allowed
                           text-cream-50 transition-all duration-200
                           flex items-center justify-center"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
