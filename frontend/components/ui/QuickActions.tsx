'use client'

import { useState, useEffect } from 'react'
import { analytics, AnalyticsEvents } from '@/lib/analytics'

interface QuickAction {
  id: string
  label: string
  prompt: string
  icon: React.ReactNode
}

interface QuickActionsProps {
  onSelect: (prompt: string) => void
  disabled?: boolean
  resetTrigger?: number  // 递增时重置选中状态
}

const quickActions: QuickAction[] = [
  {
    id: 'recording',
    label: '录音练习',
    prompt: '创建一个练习室，我想要练习',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    )
  },
  {
    id: 'script',
    label: '撰写逐字稿',
    prompt: '帮我撰写逐字稿',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    )
  },
  {
    id: 'strategy',
    label: '答题思路',
    prompt: '这类题的作答思路是怎么样的',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    )
  },
  {
    id: 'optimize',
    label: '优化回答',
    prompt: '帮我优化这个回答',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    )
  },
  {
    id: 'resume',
    label: '修改简历',
    prompt: '帮我改一下简历',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    )
  }
]

export function QuickActions({ onSelect, disabled = false, resetTrigger }: QuickActionsProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  // 当 resetTrigger 变化时（消息发送后），重置选中状态
  useEffect(() => {
    if (resetTrigger !== undefined) {
      setActiveId(null)
    }
  }, [resetTrigger])

  const handleClick = (action: QuickAction) => {
    if (disabled) return
    // 切换选中状态：再次点击同一个按钮则取消选中
    const newId = activeId === action.id ? null : action.id
    setActiveId(newId)

    // 埋点：快捷按钮点击
    analytics.track(AnalyticsEvents.QUICK_ACTION_CLICK, {
      action_type: action.id,
      action_label: action.label,
    })

    onSelect(action.prompt)
  }

  return (
    <div className="flex flex-wrap justify-center gap-2 px-4 py-3">
      {quickActions.map((action) => {
        const isActive = activeId === action.id
        return (
          <button
            key={action.id}
            onClick={() => handleClick(action)}
            disabled={disabled}
            className={`
              inline-flex items-center gap-1.5 px-4 py-2
              text-sm rounded-full border
              transition-all duration-200
              ${disabled
                ? 'opacity-50 cursor-not-allowed bg-white text-ink-100 border-cream-300'
                : isActive
                  ? 'bg-warm-300 text-white border-warm-300 shadow-subtle'
                  : 'bg-white text-ink-100 border-cream-300 hover:bg-warm-50 hover:text-warm-400 hover:border-warm-200 hover:shadow-subtle hover:-translate-y-0.5'
              }
            `}
          >
            <span className={isActive ? 'text-white/80' : 'text-cream-400'}>{action.icon}</span>
            <span>{action.label}</span>
          </button>
        )
      })}
    </div>
  )
}
