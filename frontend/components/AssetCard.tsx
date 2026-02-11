'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Asset } from '@/lib/types'

interface AssetCardProps {
  asset: Asset
  onDelete: (id: string) => void
  onUpdate: (id: string, updates: { transcript?: string, tags?: string[] }) => void
}

export default function AssetCard({ asset, onDelete, onUpdate }: AssetCardProps) {
  const [isEditingTranscript, setIsEditingTranscript] = useState(false)
  const [transcript, setTranscript] = useState(asset.transcript || '')
  const [isSaving, setIsSaving] = useState(false)

  // 保存逐字稿
  const handleSaveTranscript = async () => {
    setIsSaving(true)
    try {
      await onUpdate(asset.id, { transcript })
      setIsEditingTranscript(false)
    } finally {
      setIsSaving(false)
    }
  }

  // 取消编辑
  const handleCancelEdit = () => {
    setTranscript(asset.transcript || '')
    setIsEditingTranscript(false)
  }

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      {/* 头部信息 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            版本 {asset.version}
          </span>
          <span className="text-xs text-gray-500">
            {formatDate(asset.created_at)}
          </span>
        </div>
        <button
          onClick={() => onDelete(asset.id)}
          className="text-red-600 hover:text-red-800 text-sm"
        >
          删除
        </button>
      </div>

      {/* 逐字稿 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium text-gray-900">逐字稿</h4>
          {!isEditingTranscript && (
            <button
              onClick={() => setIsEditingTranscript(true)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              编辑
            </button>
          )}
        </div>
        {isEditingTranscript ? (
          <div>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={6}
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleSaveTranscript}
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? '保存中...' : '保存'}
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">
            {transcript || '暂无逐字稿'}
          </div>
        )}
      </div>

      {/* 逐字稿 */}
      {asset.transcript && (
        <div className="mb-4">
          <h4 className="font-medium text-gray-900 mb-2">逐字稿</h4>
          <div className="bg-white rounded-lg p-3 text-sm prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {asset.transcript}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* STAR 分析 */}
      {asset.star_structure?.analysis && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
            查看 STAR 分析
          </summary>
          <div className="mt-2 bg-white rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">
            {asset.star_structure.analysis}
          </div>
        </details>
      )}
    </div>
  )
}
