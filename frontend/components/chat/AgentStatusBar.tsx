'use client'

import { AgentStatus } from '@/lib/types'

interface AgentStatusBarProps {
  status: AgentStatus
}

export function AgentStatusBar({ status }: AgentStatusBarProps) {
  if (status === 'idle') return null

  return (
    <div className="flex items-center justify-center gap-3 py-4">
      <ThinkingDots />
      <span className="text-sm text-cream-400 font-light">{getStatusText(status)}</span>
    </div>
  )
}

function getStatusText(status: AgentStatus): string {
  switch (status) {
    case 'thinking':
      return 'AI正在思考...'
    case 'recording':
      return '等待您开始录音...'
    case 'transcribing':
      return '正在转录您的回答...'
    case 'analyzing':
      return '正在分析您的回答...'
    default:
      return ''
  }
}

// 3个点波动动画组件（暖色）
function ThinkingDots() {
  return (
    <div className="flex items-center gap-1">
      <span className="w-1.5 h-1.5 bg-warm-300 rounded-full animate-warm-bounce" />
      <span className="w-1.5 h-1.5 bg-warm-300 rounded-full animate-warm-bounce animate-warm-bounce-delay-1" />
      <span className="w-1.5 h-1.5 bg-warm-300 rounded-full animate-warm-bounce animate-warm-bounce-delay-2" />
    </div>
  )
}
