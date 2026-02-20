/**
 * 性能计时 Hook
 * 用于追踪响应时长等性能指标
 */

import { useCallback, useRef } from 'react'
import { analytics, performanceTiming, AnalyticsEvents } from '@/lib/analytics'

interface TimingMark {
  startTime: number
  props?: Record<string, any>
}

export function usePerformanceTiming() {
  const marks = useRef<Map<string, TimingMark>>(new Map())

  /**
   * 标记开始时间
   */
  const markStart = useCallback((key: string, props?: Record<string, any>) => {
    marks.current.set(key, {
      startTime: Date.now(),
      props,
    })
  }, [])

  /**
   * 标记结束并返回耗时（毫秒）
   */
  const markEnd = useCallback((key: string): number | null => {
    const mark = marks.current.get(key)
    if (!mark) return null

    const duration = Date.now() - mark.startTime
    marks.current.delete(key)
    return duration
  }, [])

  /**
   * 标记结束并自动上报到埋点
   */
  const markEndAndTrack = useCallback((key: string, event: string, additionalProps?: Record<string, any>) => {
    const mark = marks.current.get(key)
    if (!mark) return null

    const duration = Date.now() - mark.startTime
    marks.current.delete(key)

    analytics.trackTiming(event, duration, {
      ...mark.props,
      ...additionalProps,
    })

    return duration
  }, [])

  /**
   * 清除标记
   */
  const clear = useCallback((key: string) => {
    marks.current.delete(key)
  }, [])

  /**
   * 清除所有标记
   */
  const clearAll = useCallback(() => {
    marks.current.clear()
  }, [])

  return {
    markStart,
    markEnd,
    markEndAndTrack,
    clear,
    clearAll,
  }
}

// 预定义的计时 key
export const TimingKeys = {
  // 消息发送到首字响应
  MESSAGE_TO_FIRST_CHUNK: 'message_to_first_chunk',
  // 流式开始到首字
  STREAM_START_TO_FIRST_CHUNK: 'stream_start_to_first_chunk',
  // 消息发送到流式结束
  MESSAGE_TO_STREAM_END: 'message_to_stream_end',
  // 录音提交到转录完成
  SUBMIT_TO_TRANSCRIPTION: 'submit_to_transcription',
  // 录音提交到反馈完成
  SUBMIT_TO_FEEDBACK: 'submit_to_feedback',
  // 反馈开始到首字
  FEEDBACK_START_TO_FIRST_CHUNK: 'feedback_start_to_first_chunk',
} as const

export default usePerformanceTiming
