'use client'

import { useState, useRef, useEffect } from 'react'

interface AudioPlayerProps {
  src: string
  className?: string
}

export function AudioPlayer({ src, className = '' }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  // 格式化时间
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '00:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // 播放/暂停
  const togglePlay = () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  // 更新进度
  const handleTimeUpdate = () => {
    if (!audioRef.current || isDragging) return
    setCurrentTime(audioRef.current.currentTime)
  }

  // 加载元数据
  const handleLoadedMetadata = () => {
    if (!audioRef.current) return
    setDuration(audioRef.current.duration)
  }

  // 播放结束
  const handleEnded = () => {
    setIsPlaying(false)
    setCurrentTime(0)
    if (audioRef.current) {
      audioRef.current.currentTime = 0
    }
  }

  // 计算进度百分比
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  // 点击进度条跳转
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !progressRef.current) return

    const rect = progressRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = clickX / rect.width
    const newTime = percentage * duration

    audioRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  // 拖动开始
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true)
    handleProgressClick(e)
  }

  // 拖动中
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !audioRef.current || !progressRef.current) return

    const rect = progressRef.current.getBoundingClientRect()
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const percentage = clickX / rect.width
    const newTime = percentage * duration

    setCurrentTime(newTime)
  }

  // 拖动结束
  const handleMouseUp = () => {
    if (isDragging && audioRef.current) {
      audioRef.current.currentTime = currentTime
    }
    setIsDragging(false)
  }

  // 添加全局鼠标事件监听
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, currentTime, duration])

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* 隐藏的 audio 元素 */}
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      />

      {/* 播放/暂停按钮 */}
      <button
        onClick={togglePlay}
        className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-warm-300 hover:bg-warm-400 transition-colors text-white"
      >
        {isPlaying ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
          </svg>
        )}
      </button>

      {/* 进度条 */}
      <div className="flex-1 flex items-center gap-2">
        <span className="text-xs text-warm-400 w-10 text-center tabular-nums">
          {formatTime(currentTime)}
        </span>

        <div
          ref={progressRef}
          className="flex-1 h-2 bg-warm-200/50 rounded-full cursor-pointer relative"
          onClick={handleProgressClick}
          onMouseDown={handleMouseDown}
        >
          {/* 已播放进度 */}
          <div
            className="absolute top-0 left-0 h-full bg-warm-400 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
          {/* 拖动手柄 */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md ring-2 ring-warm-300 transition-all"
            style={{ left: `calc(${progress}% - 6px)` }}
          />
        </div>

        <span className="text-xs text-warm-400 w-10 text-center tabular-nums">
          {formatTime(duration)}
        </span>
      </div>
    </div>
  )
}
