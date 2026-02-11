/**
 * XML 标签解析工具
 * 用于解析 LLM 输出中的 XML 标签内容
 */

export interface ParsedOptimizedAnswer {
  optimized: string | null
  reason: string | null
  raw: string
}

export interface ParsedScript {
  script: string | null
  tips: string | null
  raw: string
}

/**
 * 解析优化答案的 XML 标签（支持流式输出，标签可能不完整）
 * 格式: <optimized>...</optimized><reason>...</reason>
 */
export function parseOptimizedAnswer(content: string): ParsedOptimizedAnswer {
  // 尝试匹配完整的 optimized 标签
  let optimizedMatch = content.match(/<optimized>([\s\S]*?)<\/optimized>/)
  let optimized: string | null = null

  if (optimizedMatch) {
    optimized = optimizedMatch[1].trim()
  } else {
    // 流式输出时，optimized 标签可能还没闭合
    const openOptimizedMatch = content.match(/<optimized>([\s\S]*)/)
    if (openOptimizedMatch) {
      // 提取 <optimized> 之后的内容，但排除可能开始的 <reason> 标签
      let partialOptimized = openOptimizedMatch[1]
      const reasonStartIndex = partialOptimized.indexOf('<reason>')
      if (reasonStartIndex !== -1) {
        partialOptimized = partialOptimized.substring(0, reasonStartIndex)
      }
      optimized = partialOptimized.trim() || null
    }
  }

  // 尝试匹配完整的 reason 标签
  let reasonMatch = content.match(/<reason>([\s\S]*?)<\/reason>/)
  let reason: string | null = null

  if (reasonMatch) {
    reason = reasonMatch[1].trim()
  } else {
    // 流式输出时，reason 标签可能还没闭合
    const openReasonMatch = content.match(/<reason>([\s\S]*)/)
    if (openReasonMatch) {
      reason = openReasonMatch[1].trim() || null
    }
  }

  return {
    optimized,
    reason,
    raw: content
  }
}

/**
 * 解析逐字稿的 XML 标签（支持流式输出，标签可能不完整）
 * 格式: <script>...</script><tips>...</tips>
 */
export function parseScript(content: string): ParsedScript {
  // 尝试匹配完整的 script 标签
  let scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/)
  let script: string | null = null

  if (scriptMatch) {
    script = scriptMatch[1].trim()
  } else {
    // 流式输出时，script 标签可能还没闭合
    const openScriptMatch = content.match(/<script>([\s\S]*)/)
    if (openScriptMatch) {
      // 提取 <script> 之后的内容，但排除可能开始的 <tips> 标签
      let partialScript = openScriptMatch[1]
      const tipsStartIndex = partialScript.indexOf('<tips>')
      if (tipsStartIndex !== -1) {
        partialScript = partialScript.substring(0, tipsStartIndex)
      }
      script = partialScript.trim() || null
    }
  }

  // 尝试匹配完整的 tips 标签
  let tipsMatch = content.match(/<tips>([\s\S]*?)<\/tips>/)
  let tips: string | null = null

  if (tipsMatch) {
    tips = tipsMatch[1].trim()
  } else {
    // 流式输出时，tips 标签可能还没闭合
    const openTipsMatch = content.match(/<tips>([\s\S]*)/)
    if (openTipsMatch) {
      tips = openTipsMatch[1].trim() || null
    }
  }

  return {
    script,
    tips,
    raw: content
  }
}

/**
 * 检查内容是否包含优化答案的 XML 标签（支持流式，只需开始标签）
 */
export function hasOptimizedAnswerTags(content: string): boolean {
  return content.includes('<optimized>')
}

/**
 * 检查内容是否包含逐字稿的 XML 标签（支持流式，只需开始标签）
 */
export function hasScriptTags(content: string): boolean {
  return content.includes('<script>')
}

/**
 * 检查内容是否包含任何已知的 XML 标签
 */
export function hasAnyXmlTags(content: string): boolean {
  return hasOptimizedAnswerTags(content) || hasScriptTags(content)
}

/**
 * 移除 XML 标签，返回纯文本
 */
export function stripXmlTags(content: string): string {
  return content
    .replace(/<optimized>[\s\S]*?<\/optimized>/g, '')
    .replace(/<reason>[\s\S]*?<\/reason>/g, '')
    .replace(/<analysis>[\s\S]*?<\/analysis>/g, '')
    .replace(/<script>[\s\S]*?<\/script>/g, '')
    .replace(/<tips>[\s\S]*?<\/tips>/g, '')
    .trim()
}
