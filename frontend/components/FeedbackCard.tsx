'use client'

import { PracticeFeedback } from '@/lib/types'

interface FeedbackCardProps {
  feedback: PracticeFeedback
  assetId?: string
  onClose?: () => void
}

/**
 * 反馈卡片组件 — 温暖雅致风格
 */
export default function FeedbackCard({ feedback, assetId, onClose }: FeedbackCardProps) {
  const { analysis, overall_score, strengths, improvements } = feedback

  // 将字符串或数组统一转换为数组
  const strengthsList = Array.isArray(strengths) ? strengths : (strengths ? [strengths] : [])
  const improvementsList = Array.isArray(improvements) ? improvements : (improvements ? [improvements] : [])

  return (
    <div className="bg-cream-50 border border-cream-300 rounded-card shadow-card overflow-hidden">
      {/* 头部 - 总分 */}
      <div className="px-6 py-5 border-b border-cream-300">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-lg text-ink-300">面试回答分析</h3>
            <p className="text-xs text-cream-400 mt-0.5 font-light">基于 STAR 框架的专业评估</p>
          </div>
          <div className="text-center">
            <div className="text-5xl font-bold tabular-nums text-warm-300">
              {overall_score}
            </div>
            <div className="text-xs text-cream-400 mt-1 font-light">总分</div>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-cream-400 hover:text-ink-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* 主体内容 */}
      <div className="p-6 space-y-5">
        {/* 详细分析 */}
        {analysis && (
          <div>
            <h4 className="font-medium text-sm text-ink-200 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-warm-300" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              详细分析
            </h4>
            <div className="bg-cream-50 rounded-card p-5 text-sm text-ink-100 whitespace-pre-wrap leading-relaxed">
              {analysis}
            </div>
          </div>
        )}

        {/* 优点 */}
        {strengthsList.length > 0 && (
          <div>
            <h4 className="font-medium text-sm text-sage-300 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              优点
            </h4>
            <ul className="space-y-1.5">
              {strengthsList.map((item, index) => (
                <li key={index} className="text-sm text-ink-100 flex items-start gap-2 font-light">
                  <span className="text-sage-300 mt-1">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 改进建议 */}
        {improvementsList.length > 0 && (
          <div>
            <h4 className="font-medium text-sm text-warm-300 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              改进建议
            </h4>
            <ul className="space-y-1.5">
              {improvementsList.map((item, index) => (
                <li key={index} className="text-sm text-ink-100 flex items-start gap-2 font-light">
                  <span className="text-warm-300 mt-1">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 已保存提示 */}
        {assetId && (
          <div className="bg-sage-50 border border-sage-100 rounded-card p-4">
            <div className="flex items-center gap-2 text-sage-300">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium">已自动保存到练习记录</span>
            </div>
            <p className="text-xs text-sage-200 mt-1 ml-6 font-light">
              如需优化回答，请在聊天中输入"帮我优化这个回答"
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
