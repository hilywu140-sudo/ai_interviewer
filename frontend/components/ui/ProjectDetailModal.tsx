'use client'

import { Project } from '@/lib/types'

interface ProjectDetailModalProps {
  project: Project | null
  isOpen: boolean
  onClose: () => void
}

export function ProjectDetailModal({ project, isOpen, onClose }: ProjectDetailModalProps) {
  if (!isOpen || !project) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩层 */}
      <div
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
      />

      {/* 弹窗内容 */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-900">{project.title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容 */}
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(80vh-120px)]">
          {/* JD */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">职位描述 (JD)</h3>
            <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-4">
              {project.jd_text}
            </div>
          </div>

          {/* 简历 */}
          {project.resume_text && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">简历内容</h3>
              <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                {project.resume_text}
              </div>
            </div>
          )}

          {/* 练习问题 */}
          {project.practice_questions && project.practice_questions.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">练习问题</h3>
              <ul className="space-y-2">
                {project.practice_questions.map((question, index) => (
                  <li key={index} className="flex text-sm text-gray-700">
                    <span className="text-gray-400 mr-2 flex-shrink-0">{index + 1}.</span>
                    <span>{question}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 创建时间 */}
          <div className="text-xs text-gray-400">
            创建于 {new Date(project.created_at).toLocaleString()}
          </div>
        </div>

        {/* 底部 */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
