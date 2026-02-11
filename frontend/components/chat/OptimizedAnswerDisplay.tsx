'use client'

import { parseOptimizedAnswer, hasOptimizedAnswerTags, parseScript, hasScriptTags } from '@/lib/xml-parser'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface OptimizedAnswerDisplayProps {
  content: string
  assetId?: string
  onEdit?: (assetId: string, content: string) => void
  isStreaming?: boolean
}

/**
 * 优化答案/逐字稿显示组件
 * 解析并渲染 <optimized>/<reason> 或 <script>/<tips> 标签内容
 */
export function OptimizedAnswerDisplay({ content, assetId, onEdit, isStreaming = false }: OptimizedAnswerDisplayProps) {
  if (hasScriptTags(content)) {
    return <ScriptDisplay content={content} assetId={assetId} onEdit={onEdit} isStreaming={isStreaming} />
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
        <div className="bg-warm-50 border-l-2 border-warm-200 rounded-r-card p-5">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-serif text-sm text-warm-400 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              优化后的回答
            </h4>
          </div>
          <div className="prose prose-sm max-w-none prose-warm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {parsed.optimized}
            </ReactMarkdown>
            {isStreaming && !optimizedComplete && (
              <span className="inline-block w-2 h-4 ml-1 bg-warm-300 animate-pulse-warm" />
            )}
          </div>
        </div>
      )}

      {/* 改进原因 */}
      {parsed.reason && (
        <div className="bg-cream-200/50 border-l-2 border-cream-400 rounded-r-card p-5">
          <h4 className="font-serif text-sm text-ink-50 mb-2 flex items-center gap-2">
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
              <span className="inline-block w-2 h-4 ml-1 bg-cream-400 animate-pulse-warm" />
            )}
          </div>
        </div>
      )}

      {/* 等待中 */}
      {isStreaming && optimizedComplete && !reasonStarted && (
        <div className="text-sm text-cream-400 flex items-center gap-2 font-light">
          <span className="inline-block w-2 h-4 bg-cream-400 animate-pulse-warm" />
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
        <div className="bg-warm-50 border-l-2 border-warm-200 rounded-r-card p-5">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-serif text-sm text-warm-400 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              回答逐字稿
            </h4>
          </div>
          <div className="prose prose-sm max-w-none prose-warm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {parsed.script}
            </ReactMarkdown>
            {isStreaming && !scriptComplete && (
              <span className="inline-block w-2 h-4 ml-1 bg-warm-300 animate-pulse-warm" />
            )}
          </div>
        </div>
      )}

      {/* 表达建议 */}
      {parsed.tips && (
        <div className="bg-cream-200/50 border-l-2 border-cream-400 rounded-r-card p-5">
          <h4 className="font-serif text-sm text-ink-50 mb-2 flex items-center gap-2">
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
              <span className="inline-block w-2 h-4 ml-1 bg-cream-400 animate-pulse-warm" />
            )}
          </div>
        </div>
      )}

      {/* 等待中 */}
      {isStreaming && scriptComplete && !tipsStarted && (
        <div className="text-sm text-cream-400 flex items-center gap-2 font-light">
          <span className="inline-block w-2 h-4 bg-cream-400 animate-pulse-warm" />
          正在生成表达建议...
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
