'use client'

import { TranscriptSentence } from '@/lib/types'

interface TranscriptWithTimestampsProps {
  sentences: TranscriptSentence[]
  groupSize?: number  // 每组句子数，默认3
}

// 毫秒转 MM:SS 格式
function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

// 将句子按固定数量分组
function groupSentences(sentences: TranscriptSentence[], groupSize: number) {
  const groups: { start: number; text: string }[] = []
  for (let i = 0; i < sentences.length; i += groupSize) {
    const group = sentences.slice(i, i + groupSize)
    groups.push({
      start: group[0].start,
      text: group.map(s => s.text).join('')
    })
  }
  return groups
}

export default function TranscriptWithTimestamps({
  sentences,
  groupSize = 3
}: TranscriptWithTimestampsProps) {
  if (!sentences || sentences.length === 0) {
    return <span className="text-gray-500">暂无逐字稿</span>
  }

  const groups = groupSentences(sentences, groupSize)

  return (
    <div className="space-y-3">
      {groups.map((group, index) => (
        <div key={index} className="flex gap-2">
          <span className="text-blue-600 font-mono text-sm shrink-0">
            [{formatTimestamp(group.start)}]
          </span>
          <span className="text-gray-700">{group.text}</span>
        </div>
      ))}
    </div>
  )
}
