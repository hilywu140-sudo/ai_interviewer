'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { projectsApi, sessionsApi } from '@/lib/api-client'
import { Project } from '@/lib/types'
import { useAuth } from '@clerk/nextjs'
import { motion } from 'framer-motion'

export default function ProjectsPage() {
  const router = useRouter()
  const { isSignedIn, isLoaded } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [navigatingProjectId, setNavigatingProjectId] = useState<string | null>(null)

  useEffect(() => {
    // 等待认证完成再加载项目，添加小延迟确保 token getter 已初始化
    if (isLoaded && isSignedIn) {
      const timer = setTimeout(() => {
        loadProjects()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isLoaded, isSignedIn])

  const loadProjects = async () => {
    try {
      const data = await projectsApi.list()
      if (Array.isArray(data)) {
        setProjects(data)
      } else {
        console.error('API did not return an array:', data)
        setProjects([])
      }
    } catch (error) {
      console.error('Failed to load projects:', error)
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  // 点击项目时，获取最新会话或创建新会话，然后跳转
  const handleProjectClick = async (project: Project) => {
    setNavigatingProjectId(project.id)
    try {
      // 获取该项目的会话列表
      const sessions = await sessionsApi.list(project.id)

      let sessionId: string
      if (sessions.length > 0) {
        // 有会话，跳转到最新的会话（按开始时间排序，取第一个）
        const latestSession = sessions.sort((a, b) =>
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
        )[0]
        sessionId = latestSession.id
      } else {
        // 没有会话，创建新会话
        const newSession = await sessionsApi.create({
          project_id: project.id,
          title: `练习会话 ${new Date().toLocaleDateString()}`
        })
        sessionId = newSession.id
      }

      // 跳转到聊天页面
      router.push(`/chat/${sessionId}`)
    } catch (error) {
      console.error('Failed to navigate to session:', error)
      setNavigatingProjectId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50">
        <div className="flex items-center gap-3 text-ink-50">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-warm-300"></div>
          <span className="text-sm font-light">加载中...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream-50">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* 头部 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex justify-between items-center mb-12"
        >
          <h1 className="text-2xl text-ink-300 tracking-tight font-semibold">我的项目</h1>
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-warm-300 text-warm-300 text-sm font-medium rounded-button hover:bg-warm-300 hover:text-white transition-all duration-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            创建新项目
          </Link>
        </motion.div>

        {/* 项目列表 */}
        {projects.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-center py-24"
          >
            <p className="text-lg text-cream-400">尚无项目</p>
            <Link
              href="/projects/new"
              className="mt-3 inline-block text-sm text-warm-300 hover:text-warm-400 underline underline-offset-4 decoration-warm-200"
            >
              创建第一个项目
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut', delay: index * 0.06 }}
                className={`p-6 bg-white border border-cream-300 rounded-card
                  hover:-translate-y-0.5 hover:shadow-card transition-all duration-300
                  ${navigatingProjectId === project.id ? 'opacity-50' : ''}`}
              >
                <div
                  onClick={() => handleProjectClick(project)}
                  className="cursor-pointer"
                >
                  <h2 className="text-lg text-ink-300 mb-2 truncate font-medium">
                    {project.title}
                  </h2>
                  <p className="text-sm text-ink-50 line-clamp-2 mb-4 font-light leading-relaxed">
                    {project.jd_text}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-cream-400">
                    {new Date(project.created_at).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-2">
                    {navigatingProjectId === project.id ? (
                      <div className="flex items-center gap-1.5 text-xs text-ink-50">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-warm-300"></div>
                        <span className="font-light">进入中...</span>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/projects/${project.id}/edit`)
                        }}
                        className="p-1.5 text-cream-400 hover:text-warm-300 hover:bg-warm-50 rounded-button transition-colors"
                        title="编辑项目"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
