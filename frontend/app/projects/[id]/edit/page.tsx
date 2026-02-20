'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { projectsApi } from '@/lib/api-client'
import { Project } from '@/lib/types'
import FileUpload from '@/components/FileUpload'
import { motion } from 'framer-motion'

export default function EditProjectPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    jd_text: '',
  })
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingProject, setLoadingProject] = useState(true)

  // 加载项目数据
  useEffect(() => {
    const loadProject = async () => {
      try {
        const data = await projectsApi.get(projectId)
        setProject(data)
        setFormData({
          title: data.title,
          jd_text: data.jd_text,
        })
      } catch (error) {
        console.error('Failed to load project:', error)
        alert('加载项目失败')
        router.back()
      } finally {
        setLoadingProject(false)
      }
    }
    loadProject()
  }, [projectId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // 更新项目基本信息
      await projectsApi.update(projectId, {
        title: formData.title,
        jd_text: formData.jd_text,
      })

      // 如果有新简历，上传
      if (resumeFile) {
        await projectsApi.uploadResume(projectId, resumeFile)
      }

      router.back()
    } catch (error: any) {
      console.error('Failed to update project:', error)
      alert(`更新失败: ${error.response?.data?.detail || error.message || '请重试'}`)
    } finally {
      setLoading(false)
    }
  }

  if (loadingProject) {
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
      <div className="max-w-xl mx-auto px-6 py-12">
        {/* 头部 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex items-center gap-4 mb-12"
        >
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-cream-200 rounded-button transition-colors text-cream-400 hover:text-ink-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl text-ink-300 tracking-tight font-semibold">编辑项目</h1>
            <p className="text-sm text-ink-50 font-light mt-0.5">
              修改项目信息
            </p>
          </div>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
          onSubmit={handleSubmit}
          className="space-y-8"
        >
          {/* 项目名称 */}
          <div>
            <label className="block text-sm text-ink-200 tracking-wide mb-3 font-medium">
              项目名称 <span className="text-rose-300">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full bg-transparent border-0 border-b border-cream-400 px-0 py-2.5 text-sm text-ink-300 placeholder-cream-400 focus:border-warm-300 focus:ring-0 transition-colors"
              placeholder="例如：字节跳动前端工程师"
            />
          </div>

          {/* 职位描述 */}
          <div>
            <label className="block text-sm text-ink-200 tracking-wide mb-3 font-medium">
              职位描述 (JD) <span className="text-rose-300">*</span>
            </label>
            <textarea
              required
              value={formData.jd_text}
              onChange={(e) =>
                setFormData({ ...formData, jd_text: e.target.value })
              }
              className="w-full bg-cream-200/30 border border-cream-300 rounded-card px-4 py-3 text-sm h-40
                         text-ink-300 placeholder-cream-400 focus:border-warm-200 focus:ring-0 resize-none transition-colors"
              placeholder="粘贴职位描述..."
            />
          </div>

          {/* 当前简历信息 */}
          {project?.resume_text && (
            <div className="p-4 bg-cream-50 rounded-card border border-cream-200">
              <div className="flex items-center gap-2 text-sm text-ink-100 mb-2">
                <svg className="w-4 h-4 text-sage-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                已上传简历
              </div>
              <p className="text-xs text-cream-400 line-clamp-2">{project.resume_text.slice(0, 100)}...</p>
            </div>
          )}

          {/* 文件上传 */}
          <FileUpload
            label={project?.resume_text ? "更换简历文件（可选）" : "简历文件（可选）"}
            description="支持 PDF 格式，最大 10MB"
            accept=".pdf"
            maxSize={10}
            onFileSelect={setResumeFile}
          />

          {/* 操作按钮 */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-6 py-3 bg-warm-300 text-white text-sm font-medium rounded-button
                         hover:bg-warm-400 disabled:bg-cream-400 disabled:text-cream-50 disabled:cursor-not-allowed transition-all duration-300"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              )}
              {loading ? '保存中...' : '保存修改'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              disabled={loading}
              className="px-5 py-3 text-sm text-ink-50 hover:text-ink-300 hover:bg-cream-200
                         rounded-button disabled:opacity-50 transition-all duration-200"
            >
              取消
            </button>
          </div>
        </motion.form>
      </div>
    </div>
  )
}
