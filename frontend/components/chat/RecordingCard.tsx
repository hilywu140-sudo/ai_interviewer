'use client'

import { useState, useRef, useEffect } from 'react'
import { RecordingState } from '@/lib/types'

interface RecordingCardProps {
  question: string
  recordingState: RecordingState
  isSubmitted?: boolean
  onStartRecording: () => void
  onStopRecording: () => void
  onCancelRecording: () => void
  onSubmitAudio: (audioData: string) => void
}

export function RecordingCard({
  question,
  recordingState,
  isSubmitted = false,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  onSubmitAudio
}: RecordingCardProps) {
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []
      setIsPaused(false)
      setAudioBlob(null)
      setPreviewUrl(null)

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        const url = URL.createObjectURL(blob)
        setPreviewUrl(url)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      onStartRecording()
    } catch (error) {
      console.error('Failed to start recording:', error)
      alert('无法访问麦克风，请检查权限设置')
    }
  }

  const handlePauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause()
      setIsPaused(true)
    }
  }

  const handleResumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume()
      setIsPaused(false)
    }
  }

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && (mediaRecorderRef.current.state === 'recording' || mediaRecorderRef.current.state === 'paused')) {
      mediaRecorderRef.current.stop()
      onStopRecording()
    }
  }

  const handleSubmitAudio = async () => {
    if (!audioBlob) return
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      const base64Data = base64.split(',')[1]
      onSubmitAudio(base64Data)
      setAudioBlob(null)
      setPreviewUrl(null)
    }
    reader.readAsDataURL(audioBlob)
  }

  const handleReRecord = () => {
    setAudioBlob(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
  }

  const handleCancelRecording = () => {
    if (mediaRecorderRef.current && (mediaRecorderRef.current.state === 'recording' || mediaRecorderRef.current.state === 'paused')) {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
    setAudioBlob(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    setIsPaused(false)
    onCancelRecording()
  }

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  return (
    <div className="bg-cream-50 border border-cream-300 rounded-card shadow-card overflow-hidden">
      {/* 问题显示 */}
      <div className="bg-warm-50 px-5 py-4 border-b border-warm-100">
        <div className="flex items-center gap-2 text-warm-400 text-sm font-serif mb-1">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          当前问题
        </div>
        <p className="text-ink-200 text-sm leading-relaxed">{question}</p>
      </div>

      {/* 录音控制区 */}
      <div className="p-5">
        {/* 状态0: 已提交，等待分析 */}
        {isSubmitted && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3 py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-warm-300" />
              <span className="text-ink-50 font-light">正在分析您的回答...</span>
            </div>
            <button
              onClick={handleCancelRecording}
              className="w-full text-cream-400 hover:text-ink-100 text-sm py-2 border border-cream-300 rounded-button hover:bg-cream-200 transition-all"
            >
              取消
            </button>
          </div>
        )}

        {/* 状态1: 未开始录音 */}
        {!isSubmitted && !recordingState.isRecording && !audioBlob && (
          <button
            onClick={handleStartRecording}
            className="w-full flex items-center justify-center gap-3 bg-ink-300 hover:bg-ink-200 text-cream-50 rounded-button py-4 transition-all duration-300"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
            </svg>
            <span className="text-base font-medium">点击开始录音</span>
          </button>
        )}

        {/* 状态2: 录音中 */}
        {!isSubmitted && recordingState.isRecording && !audioBlob && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isPaused ? 'bg-warm-200' : 'bg-rose-300 animate-pulse'}`} />
                <span className={`text-sm font-medium ${isPaused ? 'text-warm-300' : 'text-rose-300'}`}>
                  {isPaused ? '已暂停' : '录音中'}
                </span>
              </div>
              <span className="text-2xl font-display text-ink-200">
                {formatDuration(recordingState.duration)}
              </span>
            </div>

            {/* 波形动画 */}
            {!isPaused && (
              <div className="flex items-center justify-center gap-1 h-12">
                {[...Array(20)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-warm-200 rounded-full animate-pulse"
                    style={{
                      height: `${Math.random() * 100}%`,
                      animationDelay: `${i * 50}ms`,
                      animationDuration: '0.5s'
                    }}
                  />
                ))}
              </div>
            )}

            <div className="flex gap-2">
              {isPaused ? (
                <button
                  onClick={handleResumeRecording}
                  className="flex-1 flex items-center justify-center gap-2 bg-sage-300 hover:bg-sage-200 text-cream-50 rounded-button py-3 transition-all"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  <span>继续录音</span>
                </button>
              ) : (
                <button
                  onClick={handlePauseRecording}
                  className="flex-1 flex items-center justify-center gap-2 bg-warm-200 hover:bg-warm-300 text-cream-50 rounded-button py-3 transition-all"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>暂停</span>
                </button>
              )}

              <button
                onClick={handleStopRecording}
                className="flex-1 flex items-center justify-center gap-2 bg-sage-300 hover:bg-sage-200 text-cream-50 rounded-button py-3 transition-all"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                </svg>
                <span>完成</span>
              </button>
            </div>
          </div>
        )}

        {/* 状态3: 录音完成 - 预览和提交 */}
        {!isSubmitted && audioBlob && previewUrl && (
          <div className="space-y-4">
            <div className="text-center text-ink-50 text-sm font-light">
              录音完成，时长 {formatDuration(recordingState.duration)}
            </div>

            <div className="bg-cream-200/50 rounded-card p-3">
              <audio
                src={previewUrl}
                controls
                className="w-full"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleReRecord}
                className="flex-1 flex items-center justify-center gap-2 bg-cream-200 hover:bg-cream-300 text-ink-100 rounded-button py-3 transition-all"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                <span>重新录音</span>
              </button>
              <button
                onClick={handleSubmitAudio}
                className="flex-1 flex items-center justify-center gap-2 bg-warm-300 hover:bg-warm-400 text-cream-50 rounded-button py-3 transition-all"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
                </svg>
                <span>提交分析</span>
              </button>
            </div>
          </div>
        )}

        {/* 取消按钮 */}
        {!isSubmitted && (
          <button
            onClick={handleCancelRecording}
            className="w-full mt-3 text-cream-400 hover:text-ink-100 text-sm py-2 transition-colors"
          >
            取消
          </button>
        )}

        {/* 提示 */}
        {!isSubmitted && (
          <p className="text-center text-xs text-cream-400 mt-3 font-light">
            {recordingState.isRecording
              ? '点击"完成"结束录音，可以预览后再提交'
              : audioBlob
                ? '点击播放预览录音，满意后点击"提交分析"'
                : '回答完毕后点击停止，AI将分析你的回答'}
          </p>
        )}
      </div>
    </div>
  )
}
