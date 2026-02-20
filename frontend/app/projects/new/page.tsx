'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { projectsApi, sessionsApi } from '@/lib/api-client'
import FileUpload from '@/components/FileUpload'
import { motion } from 'framer-motion'

export default function NewProjectPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    title: '',
    jd_text: '',
  })
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'form' | 'uploading' | 'creating_session'>('form')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Step 1: 创建项目
      setStep('form')
      const payload = {
        title: formData.title,
        jd_text: formData.jd_text,
      }

      const project = await projectsApi.create(payload)

      // Step 2: 上传简历（如果有）
      if (resumeFile) {
        setStep('uploading')
        await projectsApi.uploadResume(project.id, resumeFile)
      }

      // Step 3: 创建会话
      setStep('creating_session')
      const session = await sessionsApi.create({
        project_id: project.id,
        title: '练习室 1'
      })

      // Step 4: 直接跳转到对话页面
      router.push(`/chat/${session.id}`)
    } catch (error: any) {
      console.error('Failed to create project:', error)
      alert(`创建失败: ${error.response?.data?.detail || error.message || '请重试'}`)
    } finally {
      setLoading(false)
      setStep('form')
    }
  }

  const getLoadingText = () => {
    switch (step) {
      case 'uploading':
        return '上传简历中...'
      case 'creating_session':
        return '准备对话...'
      default:
        return '创建项目中...'
    }
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
            <h1 className="text-xl text-ink-300 tracking-tight font-semibold">创建新项目</h1>
            <p className="text-sm text-ink-50 font-light mt-0.5">
              上传简历和职位描述，开始面试练习
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

          {/* 文件上传 */}
          <FileUpload
            label="简历文件（可选）"
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
              className="inline-flex items-center gap-2 px-6 py-3 bg-ink-300 text-cream-50 text-sm font-medium rounded-button
                         hover:bg-ink-200 disabled:bg-cream-400 disabled:text-cream-50 disabled:cursor-not-allowed transition-all duration-300"
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
              {loading ? getLoadingText() : '开始练习'}
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
