'use client'

import { useEffect, useState } from 'react'
import { Asset } from '@/lib/types'
import { assetsApi } from '@/lib/api-client'

interface AssetSidebarProps {
  projectId: string
  isOpen: boolean
  onToggle: () => void
  onSelectAsset: (asset: Asset) => void
  onDeleteQuestion?: (question: string, assetIds: string[]) => void
}

export function AssetSidebar({ projectId, isOpen, onToggle, onSelectAsset, onDeleteQuestion }: AssetSidebarProps) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingQuestion, setDeletingQuestion] = useState<string | null>(null)

  useEffect(() => {
    if (projectId) {
      loadAssets()
    }
  }, [projectId])

  const loadAssets = async () => {
    try {
      setLoading(true)
      const response = await assetsApi.list(projectId)
      setAssets(response.assets)
    } catch (error) {
      console.error('Failed to load assets:', error)
    } finally {
      setLoading(false)
    }
  }

  // 按问题分组资产
  const groupedAssets = assets.reduce((groups, asset) => {
    const question = asset.question
    if (!groups[question]) {
      groups[question] = []
    }
    groups[question].push(asset)
    return groups
  }, {} as Record<string, Asset[]>)

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return '今天'
    } else if (days === 1) {
      return '昨天'
    } else if (days < 7) {
      return `${days}天前`
    } else {
      return date.toLocaleDateString()
    }
  }

  // 删除整个问题及其所有版本
  const handleDeleteQuestion = async (question: string, questionAssets: Asset[]) => {
    if (!confirm(`确定要删除"${question.slice(0, 30)}..."及其所有练习记录吗？`)) {
      return
    }

    setDeletingQuestion(question)
    try {
      const assetIds = questionAssets.map(a => a.id)
      // 逐个删除
      for (const id of assetIds) {
        await assetsApi.delete(id)
      }
      // 刷新列表
      await loadAssets()
      onDeleteQuestion?.(question, assetIds)
    } catch (error) {
      console.error('Failed to delete question:', error)
      alert('删除失败，请重试')
    } finally {
      setDeletingQuestion(null)
    }
  }

  return (
    <>
      {/* 侧边栏 */}
      <div
        className={`h-full bg-white border-r border-gray-200 transition-all duration-300 flex flex-col ${
          isOpen ? 'w-80' : 'w-0'
        } overflow-hidden`}
      >
        {/* 头部 */}
        <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
          <h2 className="text-sm font-medium text-gray-700">练习记录</h2>
          <button
            onClick={onToggle}
            className="p-1 hover:bg-gray-100 rounded transition-colors text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
            </div>
          ) : Object.keys(groupedAssets).length === 0 ? (
            <div className="px-4 py-8 text-center">
              <svg className="mx-auto h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="mt-2 text-xs text-gray-400">暂无练习记录</p>
              <p className="text-xs text-gray-400">完成练习后会自动保存</p>
            </div>
          ) : (
            <div className="py-2">
              {Object.entries(groupedAssets).map(([question, questionAssets]) => {
                // 获取最新的资产
                const sortedAssets = questionAssets.sort(
                  (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
                )
                const latestAsset = sortedAssets[0]
                const isDeleting = deletingQuestion === question

                return (
                  <div key={question} className="px-3 py-2 group">
                    {/* 问题标题 - 放大字体 */}
                    <div className="flex items-start justify-between mb-2">
                      <h3
                        className="text-sm font-medium text-gray-800 line-clamp-2 flex-1 pr-2"
                        title={question}
                      >
                        {question}
                      </h3>
                      {/* 删除按钮 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteQuestion(question, questionAssets)
                        }}
                        disabled={isDeleting}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-all text-gray-400 hover:text-red-500 flex-shrink-0"
                        title="删除此问题的所有记录"
                      >
                        {isDeleting ? (
                          <div className="w-4 h-4 animate-spin rounded-full border-2 border-gray-300 border-t-red-500"></div>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </div>

                    {/* 只显示最新版本 - 缩小字体 */}
                    <button
                      onClick={() => onSelectAsset(latestAsset)}
                      className="w-full text-left py-2 px-2 hover:bg-gray-50 rounded transition-colors border border-gray-100"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">
                            v{latestAsset.version} {questionAssets.length > 1 && `(共${questionAssets.length}版)`}
                          </span>
                          {/* 版本类型标签 */}
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            latestAsset.version_type === 'recording'
                              ? 'bg-blue-100 text-blue-600'
                              : 'bg-green-100 text-green-600'
                          }`}>
                            {latestAsset.version_type === 'recording' ? '录音' : '优化'}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {formatTime(latestAsset.updated_at)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2">
                        {latestAsset.transcript}
                      </p>
                      {questionAssets.length > 1 && (
                        <p className="text-xs text-blue-500 mt-1">点击查看详情和历史版本</p>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 收起时的展开按钮 */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="absolute left-0 top-1/2 -translate-y-1/2 bg-white border border-gray-200 border-l-0 rounded-r-md p-2 shadow-sm hover:bg-gray-50 transition-colors z-10"
        >
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </>
  )
}
