'use client'

import { AgentStatus } from '@/lib/types'

interface ChatHeaderProps {
  isConnected: boolean
  agentStatus: AgentStatus
  sessionTitle?: string
  onBack?: () => void
  onToggleSidebar?: () => void
  isSidebarOpen?: boolean
}

export function ChatHeader({
  isConnected,
  agentStatus,
  sessionTitle,
  onBack,
  onToggleSidebar,
  isSidebarOpen
}: ChatHeaderProps) {
  return (
    <header className="bg-cream-50 shadow-subtle px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* 侧边栏切换按钮 */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-1.5 hover:bg-cream-200 rounded-button transition-colors text-cream-400 hover:text-ink-200"
            title={isSidebarOpen ? '收起侧边栏' : '展开侧边栏'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isSidebarOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        )}
        {/* 返回按钮 */}
        {onBack && (
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-cream-200 rounded-button transition-colors text-cream-400 hover:text-ink-200"
            title="返回项目列表"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <h1 className="font-serif text-base text-ink-300">
          {sessionTitle || 'AI 面试助手'}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {/* 连接状态 — 仅断开时显示 */}
        {!isConnected && (
          <span className="text-xs text-rose-300 font-light">
            连接已断开
          </span>
        )}

        {/* Agent 状态 */}
        {agentStatus !== 'idle' && (
          <div className="flex items-center gap-2 text-xs text-cream-400">
            <ThinkingDots />
            <span className="font-light">{getStatusText(agentStatus)}</span>
          </div>
        )}
      </div>
    </header>
  )
}

function getStatusText(status: AgentStatus): string {
  switch (status) {
    case 'thinking':
      return 'AI正在思考'
    case 'recording':
      return '等待录音'
    case 'transcribing':
      return '正在转录'
    case 'analyzing':
      return '正在分析'
    default:
      return ''
  }
}

// 3个点波动动画组件（暖色）
function ThinkingDots() {
  return (
    <div className="flex items-center gap-1">
      <span className="w-1.5 h-1.5 bg-warm-200 rounded-full animate-warm-bounce" />
      <span className="w-1.5 h-1.5 bg-warm-200 rounded-full animate-warm-bounce animate-warm-bounce-delay-1" />
      <span className="w-1.5 h-1.5 bg-warm-200 rounded-full animate-warm-bounce animate-warm-bounce-delay-2" />
    </div>
  )
}
