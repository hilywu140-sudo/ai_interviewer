'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface AudioRecorderProps {
  onAudioReady: (audioData: string) => void  // base64编码的PCM音频
  onRecordingStart?: () => void
  onRecordingStop?: () => void
  disabled?: boolean
  className?: string
}

/**
 * 录音组件
 *
 * 使用 MediaRecorder API 录制音频，并转换为 PCM 16kHz 格式
 * 用于语音练习功能
 */
export default function AudioRecorder({
  onAudioReady,
  onRecordingStart,
  onRecordingStop,
  disabled = false,
  className = ''
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // 清理函数
  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setAudioLevel(0)
  }, [])

  // 组件卸载时清理
  useEffect(() => {
    return cleanup
  }, [cleanup])

  // 更新音频电平显示
  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)

    // 计算平均音量
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
    setAudioLevel(average / 255)

    animationRef.current = requestAnimationFrame(updateAudioLevel)
  }, [])

  // 将音频转换为 PCM 16kHz
  const convertToPCM = async (audioBlob: Blob): Promise<string> => {
    const audioContext = new AudioContext({ sampleRate: 16000 })
    const arrayBuffer = await audioBlob.arrayBuffer()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    // 获取单声道数据
    const channelData = audioBuffer.getChannelData(0)

    // 重采样到 16kHz（如果需要）
    let resampledData = channelData
    if (audioBuffer.sampleRate !== 16000) {
      const ratio = audioBuffer.sampleRate / 16000
      const newLength = Math.round(channelData.length / ratio)
      resampledData = new Float32Array(newLength)
      for (let i = 0; i < newLength; i++) {
        const srcIndex = Math.round(i * ratio)
        resampledData[i] = channelData[srcIndex] || 0
      }
    }

    // 转换为 16-bit PCM
    const pcmData = new Int16Array(resampledData.length)
    for (let i = 0; i < resampledData.length; i++) {
      const s = Math.max(-1, Math.min(1, resampledData[i]))
      pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
    }

    // 转换为 base64
    const uint8Array = new Uint8Array(pcmData.buffer)
    let binary = ''
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i])
    }

    await audioContext.close()
    return btoa(binary)
  }

  // 开始录音
  const startRecording = async () => {
    try {
      setError(null)
      audioChunksRef.current = []

      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        }
      })
      streamRef.current = stream

      // 设置音频分析器（用于显示音量）
      const audioContext = new AudioContext()
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      // 创建 MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        cleanup()

        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })

          try {
            const pcmBase64 = await convertToPCM(audioBlob)
            onAudioReady(pcmBase64)
          } catch (err) {
            console.error('音频转换失败:', err)
            setError('音频处理失败，请重试')
          }
        }

        onRecordingStop?.()
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(100) // 每100ms收集一次数据

      setIsRecording(true)
      setRecordingTime(0)

      // 开始计时
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)

      // 开始音量监测
      updateAudioLevel()

      onRecordingStart?.()

    } catch (err) {
      console.error('录音启动失败:', err)
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('请允许麦克风访问权限')
      } else {
        setError('无法启动录音，请检查麦克风')
      }
    }
  }

  // 停止录音
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  // 格式化时间显示
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* 录音按钮 */}
      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={disabled}
        className={`
          relative flex items-center justify-center
          w-12 h-12 rounded-full
          transition-all duration-200
          ${isRecording
            ? 'bg-red-500 hover:bg-red-600 animate-pulse'
            : 'bg-gray-100 hover:bg-gray-200 border border-gray-300'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        title={isRecording ? '停止录音' : '开始录音'}
      >
        {isRecording ? (
          // 停止图标
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
        ) : (
          // 麦克风图标
          <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
        )}

        {/* 音量指示器 */}
        {isRecording && (
          <div
            className="absolute inset-0 rounded-full border-4 border-red-300 opacity-50"
            style={{
              transform: `scale(${1 + audioLevel * 0.3})`,
              transition: 'transform 0.1s ease-out'
            }}
          />
        )}
      </button>

      {/* 录音状态显示 */}
      {isRecording && (
        <div className="flex items-center gap-2">
          {/* 录音指示点 */}
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />

          {/* 录音时间 */}
          <span className="text-sm font-mono text-gray-600">
            {formatTime(recordingTime)}
          </span>

          {/* 音量条 */}
          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-100"
              style={{ width: `${audioLevel * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <span className="text-sm text-red-500">{error}</span>
      )}
    </div>
  )
}
