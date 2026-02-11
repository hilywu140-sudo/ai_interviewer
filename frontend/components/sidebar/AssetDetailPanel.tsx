'use client'

import { useState, useEffect, useRef } from 'react'
import { Asset, AssetUpdate } from '@/lib/types'
import { assetsApi } from '@/lib/api-client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface AssetDetailPanelProps {
  asset: Asset
  onClose: () => void
  onUpdate?: (id: string, updates: AssetUpdate) => Promise<void> | void
  onDelete?: (id: string) => Promise<void> | void
}

export function AssetDetailPanel({ asset, onClose, onUpdate, onDelete }: AssetDetailPanelProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedTranscript, setEditedTranscript] = useState(asset.transcript || '')
  const [versions, setVersions] = useState<Asset[]>([])
  const [currentVersionIndex, setCurrentVersionIndex] = useState(0)
  const [loadingVersions, setLoadingVersions] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // 加载所有版本
  useEffect(() => {
    loadVersions()
  }, [asset.id])

  const loadVersions = async () => {
    try {
      setLoadingVersions(true)
      const allVersions = await assetsApi.getVersions(asset.id)
      // 按版本号降序排列（最新的在前）
      const sortedVersions = allVersions.sort((a, b) => b.version - a.version)
      setVersions(sortedVersions)
      // 找到当前资产的索引
      const index = sortedVersions.findIndex(v => v.id === asset.id)
      setCurrentVersionIndex(index >= 0 ? index : 0)
    } catch (error) {
      console.error('Failed to load versions:', error)
      // 如果加载失败，至少显示当前版本
      setVersions([asset])
      setCurrentVersionIndex(0)
    } finally {
      setLoadingVersions(false)
    }
  }

  const currentAsset = versions[currentVersionIndex] || asset

  const handleSave = async () => {
    if (!onUpdate || editedTranscript === currentAsset.transcript) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    try {
      // 调用父组件的更新方法
      await onUpdate(currentAsset.id, { transcript: editedTranscript })

      // 更新本地 versions 数组中的当前版本
      setVersions(prev => prev.map((v, index) =>
        index === currentVersionIndex
          ? { ...v, transcript: editedTranscript }
          : v
      ))

      setIsEditing(false)
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = () => {
    if (confirm('确定要删除这条练习记录吗？')) {
      onDelete?.(currentAsset.id)
      onClose()
    }
  }

  // 切换版本
  const goToVersion = (index: number) => {
    if (index >= 0 && index < versions.length) {
      setCurrentVersionIndex(index)
      setEditedTranscript(versions[index].transcript || '')
      setIsEditing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩层 */}
      <div className="absolute inset-0 bg-ink-300/15" onClick={onClose} />

      {/* 面板内容 */}
      <div className="relative bg-cream-50 rounded-card shadow-elevated max-w-2xl w-full mx-4 max-h-[85vh] overflow-hidden">
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-cream-300 flex justify-between items-start">
          <div className="flex-1 pr-4">
            {/* 版本切换器 */}
            {versions.length > 1 && !loadingVersions && (
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => goToVersion(currentVersionIndex + 1)}
                  disabled={currentVersionIndex >= versions.length - 1}
                  className="p-1 hover:bg-cream-200 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="上一版本"
                >
                  <svg className="w-4 h-4 text-ink-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-xs text-cream-400 font-display">
                  版本 {currentAsset.version} / {versions.length}
                </span>
                <button
                  onClick={() => goToVersion(currentVersionIndex - 1)}
                  disabled={currentVersionIndex <= 0}
                  className="p-1 hover:bg-cream-200 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="下一版本"
                >
                  <svg className="w-4 h-4 text-ink-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                {currentVersionIndex === 0 && (
                  <span className="text-xs bg-sage-50 text-sage-300 px-2 py-0.5 rounded-tag font-medium">最新</span>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-cream-400 font-display">v{currentAsset.version}</span>
              <span className="text-xs text-cream-400">·</span>
              {/* 版本类型标签 */}
              <span className={`text-xs px-1.5 py-0.5 rounded-tag ${
                currentAsset.version_type === 'recording'
                  ? 'bg-cream-200 text-ink-50'
                  : 'bg-warm-50 text-warm-300'
              }`}>
                {currentAsset.version_type === 'recording' ? '录音' : '优化'}
              </span>
              <span className="text-xs text-cream-400">·</span>
              <span className="text-xs text-cream-400 font-light">
                {new Date(currentAsset.updated_at).toLocaleString()}
              </span>
            </div>
            <h2 className="font-serif text-lg text-ink-300">{currentAsset.question}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-cream-200 rounded-button transition-colors text-cream-400 hover:text-ink-100 flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 版本指示器（多版本时显示） */}
        {versions.length > 1 && !loadingVersions && (
          <div className="px-6 py-2 bg-cream-200/30 border-b border-cream-300 flex items-center gap-1 overflow-x-auto">
            {versions.map((v, index) => (
              <button
                key={v.id}
                onClick={() => goToVersion(index)}
                className={`px-2.5 py-1 text-xs rounded-tag transition-all flex-shrink-0 flex items-center gap-1 ${
                  index === currentVersionIndex
                    ? 'bg-ink-300 text-cream-50'
                    : 'bg-cream-50 text-ink-50 hover:bg-cream-200 border border-cream-300'
                }`}
              >
                <span className="font-display">v{v.version}</span>
                <span className={`text-xs ${
                  index === currentVersionIndex
                    ? 'text-cream-300'
                    : v.version_type === 'recording' ? 'text-ink-50' : 'text-warm-300'
                }`}>
                  {v.version_type === 'recording' ? '录' : '优'}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* 内容 */}
        <div ref={scrollContainerRef} className="px-6 py-4 overflow-y-auto max-h-[calc(85vh-180px)]">
          {loadingVersions ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-warm-300"></div>
            </div>
          ) : (
            <>
              {/* 逐字稿（可编辑） */}
              {currentAsset.transcript && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-serif text-sm text-ink-50">逐字稿</h3>
                    {!isEditing && (
                      <div className="flex items-center gap-3">
                        {onUpdate && (
                          <button
                            onClick={() => setIsEditing(true)}
                            className="text-xs text-cream-400 hover:text-warm-300 transition-colors"
                          >
                            编辑
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={handleDelete}
                            className="text-xs text-cream-400 hover:text-rose-300 transition-colors"
                          >
                            删除
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {isEditing ? (
                    <div>
                      <textarea
                        value={editedTranscript}
                        onChange={(e) => setEditedTranscript(e.target.value)}
                        className="w-full h-48 text-sm text-ink-200 bg-cream-100 rounded-card p-4 border-0
                                   focus:ring-1 focus:ring-warm-200 focus:outline-none resize-y font-mono"
                        placeholder="支持 Markdown 格式..."
                        disabled={isSaving}
                      />
                      <p className="text-xs text-cream-400 mt-1 font-light">支持 Markdown 格式</p>
                      <div className="flex justify-end gap-2 mt-2">
                        <button
                          onClick={() => {
                            setEditedTranscript(currentAsset.transcript || '')
                            setIsEditing(false)
                          }}
                          className="px-3 py-1.5 text-xs text-cream-400 hover:text-ink-100 transition-colors"
                          disabled={isSaving}
                        >
                          取消
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={isSaving}
                          className="px-3 py-1.5 text-xs bg-ink-300 text-cream-50 rounded-button hover:bg-ink-200 disabled:opacity-50 transition-all"
                        >
                          {isSaving ? '保存中...' : '保存'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-ink-100 bg-cream-100 rounded-card p-4 prose prose-sm max-w-none prose-warm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {currentAsset.transcript}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              )}

              {/* STAR 分析 */}
              {currentAsset.star_structure?.analysis && (
                <div className="mb-6">
                  <h3 className="font-serif text-sm text-ink-50 mb-2">STAR 分析</h3>
                  <div className="text-xs text-ink-100 bg-cream-100 rounded-card p-4 whitespace-pre-wrap leading-relaxed">
                    {currentAsset.star_structure.analysis}
                  </div>
                </div>
              )}

              {/* 标签 */}
              {currentAsset.tags && currentAsset.tags.length > 0 && (
                <div>
                  <h3 className="font-serif text-sm text-ink-50 mb-2">标签</h3>
                  <div className="flex flex-wrap gap-2">
                    {currentAsset.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-2.5 py-1 text-xs bg-cream-200 text-ink-50 rounded-tag"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 底部 */}
        <div className="px-6 py-4 border-t border-cream-300 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-cream-400 hover:text-ink-200 hover:bg-cream-200 rounded-button transition-all"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
