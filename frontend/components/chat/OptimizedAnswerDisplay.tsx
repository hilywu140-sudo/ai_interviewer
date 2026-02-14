'use client'

import { parseOptimizedAnswer, hasOptimizedAnswerTags, parseScript, hasScriptTags, parseFeedback, hasFeedbackTags } from '@/lib/xml-parser'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface OptimizedAnswerDisplayProps {
  content: string
  assetId?: string
  onEdit?: (assetId: string, content: string) => void
  isStreaming?: boolean
}

/**
 * 优化答案/逐字稿/录音分析显示组件
 * 解析并渲染 <optimized>/<reason> 或 <script>/<tips> 或 <analysis>/<strengths>/<improvements> 标签内容
 */
export function OptimizedAnswerDisplay({ content, assetId, onEdit, isStreaming = false }: OptimizedAnswerDisplayProps) {
  if (hasScriptTags(content)) {
    return <ScriptDisplay content={content} assetId={assetId} onEdit={onEdit} isStreaming={isStreaming} />
  }

  if (hasFeedbackTags(content)) {
    return <FeedbackDisplay content={content} isStreaming={isStreaming} />
  }

  if (hasOptimizedAnswerTags(content)) {
    return <OptimizedDisplay content={content} assetId={assetId} onEdit={onEdit} isStreaming={isStreaming} />
  }

  return <PlainTextContent content={content} />
}

/**
 * 优化答案显示（支持流式输出）
 */
function OptimizedDisplay({ content, assetId, onEdit, isStreaming = false }: OptimizedAnswerDisplayProps) {
  const parsed = parseOptimizedAnswer(content)

  const optimizedComplete = content.includes('</optimized>')
  const reasonComplete = content.includes('</reason>')
  const reasonStarted = content.includes('<reason>')

  return (
    <div className="space-y-4">
      {/* 优化后的答案 */}
      {parsed.optimized && (
        <div>
          <h4 className="font-semibold text-sm text-warm-400 flex items-center gap-2 mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            优化后的回答
          </h4>
          <div className="prose prose-sm max-w-none prose-warm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {parsed.optimized}
            </ReactMarkdown>
            {isStreaming && !optimizedComplete && (
              <span className="streaming-cursor" />
            )}
          </div>
        </div>
      )}

      {/* 改进原因 */}
      {parsed.reason && (
        <div>
          <h4 className="font-semibold text-sm text-ink-50 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            改进说明
          </h4>
          <div className="prose prose-sm max-w-none prose-warm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {parsed.reason}
            </ReactMarkdown>
            {isStreaming && reasonStarted && !reasonComplete && (
              <span className="streaming-cursor" />
            )}
          </div>
        </div>
      )}

      {/* 等待中 */}
      {isStreaming && optimizedComplete && !reasonStarted && (
        <div className="text-sm text-cream-400 flex items-center gap-2 font-light">
          <span className="streaming-cursor" />
          正在生成改进说明...
        </div>
      )}
    </div>
  )
}

/**
 * 逐字稿显示
 */
function ScriptDisplay({ content, assetId, onEdit, isStreaming = false }: OptimizedAnswerDisplayProps) {
  const parsed = parseScript(content)

  const scriptComplete = content.includes('</script>')
  const tipsComplete = content.includes('</tips>')
  const tipsStarted = content.includes('<tips>')

  return (
    <div className="space-y-4">
      {/* 逐字稿内容 */}
      {parsed.script && (
        <div>
          <h4 className="font-semibold text-sm text-warm-400 flex items-center gap-2 mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            回答逐字稿
          </h4>
          <div className="prose prose-sm max-w-none prose-warm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {parsed.script}
            </ReactMarkdown>
            {isStreaming && !scriptComplete && (
              <span className="streaming-cursor" />
            )}
          </div>
        </div>
      )}

      {/* 表达建议 */}
      {parsed.tips && (
        <div>
          <h4 className="font-semibold text-sm text-ink-50 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            表达建议
          </h4>
          <div className="prose prose-sm max-w-none prose-warm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {parsed.tips}
            </ReactMarkdown>
            {isStreaming && tipsStarted && !tipsComplete && (
              <span className="streaming-cursor" />
            )}
          </div>
        </div>
      )}

      {/* 等待中 */}
      {isStreaming && scriptComplete && !tipsStarted && (
        <div className="text-sm text-cream-400 flex items-center gap-2 font-light">
          <span className="streaming-cursor" />
          正在生成表达建议...
        </div>
      )}
    </div>
  )
}

/**
 * 录音分析显示（支持流式输出）
 */
function FeedbackDisplay({ content, isStreaming = false }: { content: string, isStreaming?: boolean }) {
  const parsed = parseFeedback(content)

  const analysisComplete = content.includes('</analysis>')
  const strengthsComplete = content.includes('</strengths>')
  const strengthsStarted = content.includes('<strengths>')
  const improvementsComplete = content.includes('</improvements>')
  const improvementsStarted = content.includes('<improvements>')
  const encouragementComplete = content.includes('</encouragement>')
  const encouragementStarted = content.includes('<encouragement>')

  return (
    <div className="space-y-4">
      {/* 详细分析 */}
      {parsed.analysis && (
        <div>
          <h4 className="font-semibold text-sm text-warm-400 flex items-center gap-2 mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            详细分析
          </h4>
          <div className="prose prose-sm max-w-none prose-warm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {parsed.analysis}
            </ReactMarkdown>
            {isStreaming && !analysisComplete && (
              <span className="streaming-cursor" />
            )}
          </div>
        </div>
      )}

      {/* 优点 */}
      {parsed.strengths && (
        <div>
          <h4 className="font-semibold text-sm text-green-600 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            优点
          </h4>
          <div className="prose prose-sm max-w-none prose-warm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {parsed.strengths}
            </ReactMarkdown>
            {isStreaming && strengthsStarted && !strengthsComplete && (
              <span className="streaming-cursor" />
            )}
          </div>
        </div>
      )}

      {/* 改进建议 */}
      {parsed.improvements && (
        <div>
          <h4 className="font-semibold text-sm text-amber-600 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            改进建议
          </h4>
          <div className="prose prose-sm max-w-none prose-warm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {parsed.improvements}
            </ReactMarkdown>
            {isStreaming && improvementsStarted && !improvementsComplete && (
              <span className="streaming-cursor" />
            )}
          </div>
        </div>
      )}

      {/* 鼓励与建议 */}
      {parsed.encouragement && (
        <div>
          <h4 className="font-semibold text-sm text-purple-500 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            鼓励与建议
          </h4>
          <div className="prose prose-sm max-w-none prose-warm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {parsed.encouragement}
            </ReactMarkdown>
            {isStreaming && encouragementStarted && !encouragementComplete && (
              <span className="streaming-cursor" />
            )}
          </div>
        </div>
      )}

      {/* 等待中 */}
      {isStreaming && analysisComplete && !strengthsStarted && (
        <div className="text-sm text-cream-400 flex items-center gap-2 font-light">
          <span className="streaming-cursor" />
          正在生成优点...
        </div>
      )}
      {isStreaming && strengthsComplete && !improvementsStarted && (
        <div className="text-sm text-cream-400 flex items-center gap-2 font-light">
          <span className="streaming-cursor" />
          正在生成改进建议...
        </div>
      )}
      {isStreaming && improvementsComplete && !encouragementStarted && (
        <div className="text-sm text-cream-400 flex items-center gap-2 font-light">
          <span className="streaming-cursor" />
          正在生成鼓励...
        </div>
      )}
    </div>
  )
}

/**
 * 纯文本内容渲染（支持 Markdown 粗体）
 */
function PlainTextContent({ content }: { content: string }) {
  return (
    <div className="whitespace-pre-wrap text-sm leading-relaxed">
      {content.split('\n').map((line, i) => {
        const parts = line.split(/(\*\*.*?\*\*)/g)
        return (
          <div key={i}>
            {parts.map((part, j) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={j}>{part.slice(2, -2)}</strong>
              }
              return <span key={j}>{part}</span>
            })}
          </div>
        )
      })}
    </div>
  )
}
