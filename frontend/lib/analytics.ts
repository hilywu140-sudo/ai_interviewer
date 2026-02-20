/**
 * 埋点服务 - 基于 PostHog
 */

import posthog from 'posthog-js'

// 事件名称常量
export const AnalyticsEvents = {
  // 性能指标
  TTFT_CHAT_STREAM: 'ttft_chat_stream',
  TTFT_FEEDBACK: 'ttft_feedback',
  ASR_DURATION: 'asr_duration',
  RESPONSE_TOTAL_DURATION: 'response_total_duration',
  RECORDING_TO_FEEDBACK: 'recording_to_feedback',

  // Token 消耗
  LLM_TOKEN_USAGE: 'llm_token_usage',

  // Supervisor 路由
  SUPERVISOR_ROUTE: 'supervisor_route',

  // 消息交互
  MESSAGE_SEND: 'message_send',
  MESSAGE_LIKE: 'message_like',
  MESSAGE_STOP: 'message_stop',

  // 快捷按钮
  QUICK_ACTION_CLICK: 'quick_action_click',

  // 录音练习
  RECORDING_START: 'recording_start',
  RECORDING_PAUSE: 'recording_pause',
  RECORDING_RESUME: 'recording_resume',
  RECORDING_COMPLETE: 'recording_complete',
  RECORDING_SUBMIT: 'recording_submit',
  RECORDING_RERECORD: 'recording_rerecord',
  RECORDING_CANCEL: 'recording_cancel',

  // 练习记录保存
  ASSET_SAVE_CONFIRM: 'asset_save_confirm',
  ASSET_SAVE_FROM_FEEDBACK: 'asset_save_from_feedback',

  // 会话管理
  SESSION_CREATE: 'session_create',
  SESSION_SWITCH: 'session_switch',

  // 练习记录操作
  ASSET_VIEW_DETAIL: 'asset_view_detail',
  ASSET_LOAD_TO_INPUT: 'asset_load_to_input',
  ASSET_DELETE: 'asset_delete',

  // Asset 详情面板
  ASSET_VERSION_SWITCH: 'asset_version_switch',
  ASSET_EDIT_START: 'asset_edit_start',
  ASSET_EDIT_SAVE: 'asset_edit_save',
  ASSET_EDIT_CANCEL: 'asset_edit_cancel',

  // 优化答案弹窗
  OPTIMIZED_ANSWER_SAVE: 'optimized_answer_save',
  OPTIMIZED_ANSWER_CANCEL: 'optimized_answer_cancel',

  // 页面曝光
  PAGE_VIEW_CHAT: 'page_view_chat',
  RECORDING_CARD_SHOW: 'recording_card_show',
  FEEDBACK_CARD_SHOW: 'feedback_card_show',
  ASSET_PANEL_OPEN: 'asset_panel_open',

  // 错误/异常
  WEBSOCKET_DISCONNECT: 'websocket_disconnect',
  WEBSOCKET_RECONNECT: 'websocket_reconnect',
  RECORDING_ERROR: 'recording_error',
  ASR_ERROR: 'asr_error',
  STREAM_ERROR: 'stream_error',
} as const

// 通用属性接口
interface CommonEventProps {
  user_id?: string
  session_id?: string
  project_id?: string
}

// 全局上下文
let globalContext: CommonEventProps = {}

/**
 * 埋点服务
 */
export const analytics = {
  /**
   * 初始化 PostHog
   */
  init: () => {
    if (typeof window === 'undefined') return

    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
    if (!posthogKey) {
      console.warn('[Analytics] PostHog key not configured')
      return
    }

    posthog.init(posthogKey, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
      capture_pageview: false,
      persistence: 'localStorage',
      autocapture: false, // 手动控制埋点
    })
  },

  /**
   * 设置用户身份
   */
  identify: (userId: string, traits?: Record<string, any>) => {
    if (typeof window === 'undefined') return
    globalContext.user_id = userId
    posthog.identify(userId, traits)
  },

  /**
   * 设置全局上下文
   */
  setContext: (context: CommonEventProps) => {
    globalContext = { ...globalContext, ...context }
  },

  /**
   * 追踪事件
   */
  track: (event: string, props?: Record<string, any>) => {
    if (typeof window === 'undefined') return

    const eventProps = {
      ...globalContext,
      ...props,
      timestamp: Date.now(),
      page_path: window.location.pathname,
    }

    // 开发环境打印日志
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics]', event, eventProps)
    }

    posthog.capture(event, eventProps)
  },

  /**
   * 追踪性能计时
   */
  trackTiming: (event: string, durationMs: number, props?: Record<string, any>) => {
    analytics.track(event, {
      duration_ms: durationMs,
      ...props,
    })
  },

  /**
   * 重置用户（登出时调用）
   */
  reset: () => {
    if (typeof window === 'undefined') return
    globalContext = {}
    posthog.reset()
  },
}

/**
 * 性能计时器
 */
const timingMarks: Map<string, number> = new Map()

export const performanceTiming = {
  /**
   * 标记开始时间
   */
  markStart: (key: string) => {
    timingMarks.set(key, Date.now())
  },

  /**
   * 标记结束并返回耗时
   */
  markEnd: (key: string): number | null => {
    const startTime = timingMarks.get(key)
    if (!startTime) return null

    const duration = Date.now() - startTime
    timingMarks.delete(key)
    return duration
  },

  /**
   * 标记结束并自动上报
   */
  markEndAndTrack: (key: string, event: string, props?: Record<string, any>) => {
    const duration = performanceTiming.markEnd(key)
    if (duration !== null) {
      analytics.trackTiming(event, duration, props)
    }
    return duration
  },

  /**
   * 清除标记
   */
  clear: (key: string) => {
    timingMarks.delete(key)
  },
}

export default analytics
