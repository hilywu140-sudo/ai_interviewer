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
      <div className={`${sizeClasses} rounded-full bg-ink-300 flex items-center justify-center flex-shrink-0`}>
        <svg className={`${iconSize} text-cream-100`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
      </div>
    )
  }

  return (
    <div className={`${sizeClasses} rounded-full bg-warm-50 border border-warm-100 flex items-center justify-center flex-shrink-0`}>
      <svg className={`${iconSize} text-warm-300`} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
    </div>
  )
}
