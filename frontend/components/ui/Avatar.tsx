'use client'

interface AvatarProps {
  type: 'user' | 'assistant'
  size?: 'sm' | 'md'
}

export function Avatar({ type, size = 'md' }: AvatarProps) {
  const sizeClasses = size === 'sm' ? 'w-6 h-6' : 'w-8 h-8'
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'

  if (type === 'user') {
    return (
      <div className={`${sizeClasses} rounded-full bg-warm-300 flex items-center justify-center flex-shrink-0`}>
        <svg className={`${iconSize} text-white`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
      </div>
    )
  }

  // Assistant: 小机器人头像
  return (
    <div className={`${sizeClasses} rounded-full bg-warm-50 border border-warm-100 flex items-center justify-center flex-shrink-0`}>
      <svg className={`${iconSize} text-warm-300`} viewBox="0 0 24 24" fill="currentColor">
        {/* 机器人图标：方脸+天线+眼睛 */}
        <path d="M12 2a1 1 0 0 1 1 1v2h3a3 3 0 0 1 3 3v2a1 1 0 0 1-2 0V8a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v2a1 1 0 0 1-2 0V8a3 3 0 0 1 3-3h3V3a1 1 0 0 1 1-1Z"/>
        <path d="M4 12a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6Zm5 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm6 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm-6 4h6a1 1 0 1 0 0-2H9a1 1 0 1 0 0 2Z"/>
      </svg>
    </div>
  )
}
