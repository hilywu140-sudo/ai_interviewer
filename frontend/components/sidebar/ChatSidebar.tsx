'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Asset, Session, Project, MessageContext } from '@/lib/types'
import { assetsApi, sessionsApi, projectsApi } from '@/lib/api-client'
import { useAuth } from '@/components/AuthProvider'
import { Avatar } from '@/components/ui/Avatar'
import { analytics, AnalyticsEvents } from '@/lib/analytics'

interface FillInputData {
  content: string
  context: MessageContext
}

interface ChatSidebarProps {
  projectId: string
  currentSessionId: string
  isOpen: boolean
  onToggle: () => void
  onFillInput: (data: FillInputData) => void  // 载入到输入框优化
  onSelectAsset: (asset: Asset) => void       // 打开详情面板
  onSessionChange?: (sessionId: string) => void
  onCurrentSessionTitle?: (title: string) => void  // 通知父组件当前会话标题
  newAssetId?: string | null                  // 新保存的 Asset ID（用于高亮）
  onNewAssetShown?: () => void                // 高亮结束后的回调
  refreshKey?: number                         // 刷新触发器
}

export function ChatSidebar({
  projectId,
  currentSessionId,
  isOpen,
  onToggle,
  onFillInput,
  onSelectAsset,
  onSessionChange,
  onCurrentSessionTitle,
  newAssetId,
  onNewAssetShown,
  refreshKey
}: ChatSidebarProps) {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const [project, setProject] = useState<Project | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [creatingSession, setCreatingSession] = useState(false)
  const [deletingQuestion, setDeletingQuestion] = useState<string | null>(null)
  const [highlightedQuestion, setHighlightedQuestion] = useState<string | null>(null)

  // 邮箱脱敏: u***@example.com
  const maskEmail = (email?: string) => {
    if (!email) return ''
    const [local, domain] = email.split('@')
    if (!domain) return email
    const maskedLocal = local.length > 2
      ? local[0] + '***' + local[local.length - 1]
      : local[0] + '***'
    return `${maskedLocal}@${domain}`
  }

  // 退出登录
  const handleLogout = () => {
    signOut()
    router.push('/login')
  }

  // 加载数据
  useEffect(() => {
    if (projectId) {
      loadData()
    }
  }, [projectId])

  // 刷新触发器
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) {
      refreshAssets()
    }
  }, [refreshKey])

  // 通知父组件当前会话标题
  useEffect(() => {
    if (sessions.length > 0 && currentSessionId) {
      const currentSession = sessions.find(s => s.id === currentSessionId)
      if (currentSession) {
        onCurrentSessionTitle?.(currentSession.title || '未命名会话')
      }
    }
  }, [sessions, currentSessionId])

  // 处理新 Asset 高亮
  useEffect(() => {
    if (newAssetId) {
      // 刷新 Asset 列表后查找新 Asset
      refreshAssets().then(() => {
        // 延迟一点确保 assets 状态已更新
        setTimeout(() => {
          const newAsset = assets.find(a => a.id === newAssetId)
          if (newAsset) {
            setHighlightedQuestion(newAsset.question)
            // 3秒后清除高亮
            setTimeout(() => {
              setHighlightedQuestion(null)
              onNewAssetShown?.()
            }, 3000)
          } else {
            // 如果在当前 assets 中没找到，可能需要等待刷新完成
            onNewAssetShown?.()
          }
        }, 100)
      })
    }
  }, [newAssetId])

  const loadData = async () => {
    try {
      setLoading(true)
      const [projectData, sessionsData, assetsResponse] = await Promise.all([
        projectsApi.get(projectId),
        sessionsApi.list(projectId),
        assetsApi.list(projectId)
      ])
      setProject(projectData)
      setSessions(sessionsData)
      setAssets(assetsResponse.assets)
    } catch (error) {
      console.error('Failed to load sidebar data:', error)
    } finally {
      setLoading(false)
    }
  }

  // 刷新资产列表
  const refreshAssets = async () => {
    try {
      const response = await assetsApi.list(projectId)
      setAssets(response.assets)
    } catch (error) {
      console.error('Failed to refresh assets:', error)
    }
  }

  // 创建新会话
  const handleCreateSession = async () => {
    setCreatingSession(true)
    try {
      // 计算新会话编号：基于现有会话数量
      const newNumber = sessions.length + 1
      const session = await sessionsApi.create({
        project_id: projectId,
        title: `练习室 ${newNumber}`
      })
      setSessions(prev => [session, ...prev])

      // 埋点：新建会话
      analytics.track(AnalyticsEvents.SESSION_CREATE)

      onSessionChange?.(session.id)
    } catch (error) {
      console.error('Failed to create session:', error)
      alert('创建会话失败')
    } finally {
      setCreatingSession(false)
    }
  }

  // 切换会话
  const handleSwitchSession = (sessionId: string) => {
    if (sessionId !== currentSessionId) {
      // 埋点：切换会话
      analytics.track(AnalyticsEvents.SESSION_SWITCH, {
        target_session_id: sessionId,
      })

      onSessionChange?.(sessionId)
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

    // 埋点：删除练习记录
    analytics.track(AnalyticsEvents.ASSET_DELETE, {
      question,
      asset_count: questionAssets.length,
    })

    setDeletingQuestion(question)
    try {
      for (const asset of questionAssets) {
        await assetsApi.delete(asset.id)
      }
      await refreshAssets()
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
        className={`h-full bg-cream-50 transition-all duration-300 flex flex-col ${
          isOpen ? 'w-80' : 'w-0'
        } overflow-hidden flex-shrink-0`}
      >
        {/* 头部 - 项目信息 */}
        <div className="px-4 py-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-warm-50 border border-warm-100 rounded-card flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-warm-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="font-sans font-semibold text-sm text-ink-300 truncate" title={project?.title}>
                {project?.title || '加载中...'}
              </h2>
            </div>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-warm-300"></div>
            </div>
          ) : (
            <>
              {/* 会话记录区域 */}
              <div className="">
                <div className="px-4 py-2 flex items-center justify-between">
                  <h3 className="font-sans text-sm font-medium text-cream-400">会话记录</h3>
                  <button
                    onClick={handleCreateSession}
                    disabled={creatingSession}
                    className="flex items-center gap-1 text-xs text-warm-300 hover:text-warm-400 bg-cream-50 hover:bg-cream-100 px-2.5 py-1 rounded-button disabled:opacity-50 transition-all"
                  >
                    {creatingSession ? (
                      <div className="w-3 h-3 animate-spin rounded-full border border-warm-300 border-t-transparent"></div>
                    ) : (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    )}
                    新建
                  </button>
                </div>
                <div className="px-2 pb-2 space-y-1 max-h-48 overflow-y-auto">
                  {sessions.length === 0 ? (
                    <div className="text-center py-6">
                      <svg className="mx-auto h-8 w-8 text-cream-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <p className="text-xs text-cream-400">还没有练习记录</p>
                      <p className="text-xs text-cream-400 mt-1">开始一个新的练习吧</p>
                    </div>
                  ) : (
                    sessions.map((session) => (
                      <button
                        key={session.id}
                        onClick={() => handleSwitchSession(session.id)}
                        className={`w-full text-left px-3 py-2 rounded-button text-sm transition-all ${
                          session.id === currentSessionId
                            ? 'bg-white text-ink-200 font-medium border-l-2 border-l-warm-300'
                            : 'text-ink-100 hover:bg-cream-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate flex-1">
                            {session.title || '未命名会话'}
                          </span>
                          {session.id === currentSessionId && (
                            <span className="ml-2 w-1.5 h-1.5 bg-warm-300 rounded-full flex-shrink-0"></span>
                          )}
                        </div>
                        <div className="flex items-center mt-1">
                          <span className="text-xs text-cream-400 font-light ml-auto">
                            {formatTime(session.started_at)}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* 练习记录区域 */}
              <div>
                <div className="px-4 py-2">
                  <h3 className="font-sans text-sm font-medium text-cream-400">练习记录</h3>
                </div>
                {Object.keys(groupedAssets).length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <svg className="mx-auto h-8 w-8 text-cream-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p className="mt-2 text-xs text-cream-400 font-light">暂无练习记录</p>
                  </div>
                ) : (
                  <div className="px-2 pb-2 space-y-1">
                    {Object.entries(groupedAssets).map(([question, questionAssets]) => {
                      const sortedAssets = questionAssets.sort(
                        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
                      )
                      const latestAsset = sortedAssets[0]
                      const isDeleting = deletingQuestion === question
                      const recordingCount = questionAssets.filter(a => a.version_type === 'recording').length
                      const editedCount = questionAssets.filter(a => a.version_type === 'edited').length

                      return (
                        <div key={question} className="group">
                          <div
                            onClick={() => {
                              // 埋点：查看详情
                              analytics.track(AnalyticsEvents.ASSET_VIEW_DETAIL, {
                                asset_id: latestAsset.id,
                                question,
                              })
                              // 点击问题时，打开详情面板
                              onSelectAsset(latestAsset)
                            }}
                            className={`w-full text-left px-3 py-2 rounded-button transition-all cursor-pointer ${
                              highlightedQuestion === question
                                ? 'ring-2 ring-warm-200 bg-warm-50 animate-pulse'
                                : 'hover:bg-cream-200'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <h4 className="text-sm text-ink-200 line-clamp-2 flex-1 pr-2" title={question}>
                                {question}
                              </h4>
                              {/* 小飞机按钮 - 载入到输入框优化 */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  // 埋点：载入到输入框
                                  analytics.track(AnalyticsEvents.ASSET_LOAD_TO_INPUT, {
                                    asset_id: latestAsset.id,
                                    question,
                                  })
                                  onFillInput({
                                    content: latestAsset.transcript || '',
                                    context: {
                                      question: latestAsset.question,
                                      original_transcript: latestAsset.transcript || '',
                                      asset_id: latestAsset.id
                                    }
                                  })
                                }}
                                title="载入到输入框优化"
                                className="p-1 hover:bg-warm-50 rounded transition-all text-cream-400 hover:text-warm-300 flex-shrink-0"
                              >
                                <svg className="w-3.5 h-3.5 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                              </button>
                              {/* 删除按钮 */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteQuestion(question, questionAssets)
                                }}
                                disabled={isDeleting}
                                className="p-1 hover:bg-rose-50 rounded transition-all text-cream-400 hover:text-rose-300 flex-shrink-0 ml-1"
                              >
                                {isDeleting ? (
                                  <div className="w-3 h-3 animate-spin rounded-full border border-rose-300 border-t-transparent"></div>
                                ) : (
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                )}
                              </button>
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              {/* 录音版本统计 */}
                              {recordingCount > 0 && (
                                <span className="flex items-center gap-0.5 text-xs text-cream-400">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                                  </svg>
                                  {recordingCount}
                                </span>
                              )}
                              {/* 优化版本统计 */}
                              {editedCount > 0 && (
                                <span className="flex items-center gap-0.5 text-xs text-warm-300">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                  </svg>
                                  {editedCount}
                                </span>
                              )}
                              <span className="text-xs text-cream-400 font-light ml-auto">
                                {formatTime(latestAsset.updated_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* 底部用户信息 */}
        <div className="flex-shrink-0 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar type="user" size="sm" />
              <span className="text-sm text-ink-200">
                {maskEmail(user?.email)}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-ink-100 hover:text-rose-300 hover:bg-rose-50 rounded-button transition-colors"
              title="退出登录"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
