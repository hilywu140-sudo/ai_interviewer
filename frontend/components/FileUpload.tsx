'use client'

import { useState, useRef, DragEvent, ChangeEvent } from 'react'

interface FileUploadProps {
  accept?: string
  maxSize?: number  // MB
  onFileSelect: (file: File | null) => void
  label?: string
  description?: string
}

export default function FileUpload({
  accept = '.pdf',
  maxSize = 10,
  onFileSelect,
  label = '上传文件',
  description = '支持 PDF 格式，最大 10MB'
}: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): string | null => {
    // 检查文件类型
    const allowedTypes = accept.split(',').map(t => t.trim())
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!allowedTypes.some(t => fileExt === t || file.type.includes(t.replace('.', '')))) {
      return `只支持 ${accept} 格式的文件`
    }

    // 检查文件大小
    if (file.size > maxSize * 1024 * 1024) {
      return `文件大小不能超过 ${maxSize}MB`
    }

    return null
  }

  const handleFile = (file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setFile(file)
    onFileSelect(file)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFile(droppedFile)
    }
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      handleFile(selectedFile)
    }
  }

  const handleRemove = () => {
    setFile(null)
    setError(null)
    onFileSelect(null)
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="w-full">
      <label className="block text-sm text-ink-200 tracking-wide mb-3 font-medium">
        {label}
      </label>

      {!file ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-card p-8 text-center cursor-pointer
            transition-all duration-200
            ${isDragging
              ? 'border-warm-200 bg-warm-50'
              : 'border-cream-400 hover:border-warm-200 hover:bg-cream-200/30'
            }
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleInputChange}
            className="hidden"
          />
          <svg
            className="mx-auto h-10 w-10 text-cream-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="mt-3 text-sm text-ink-50 font-light">
            <span className="font-medium text-warm-300">点击上传</span> 或拖拽文件到此处
          </p>
          <p className="mt-1 text-xs text-cream-400">{description}</p>
        </div>
      ) : (
        <div className="border border-cream-300 rounded-card p-4 bg-cream-200/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <svg
                className="h-8 w-8 text-rose-200"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-ink-300">{file.name}</p>
                <p className="text-xs text-ink-50 font-light">{formatFileSize(file.size)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              className="text-cream-400 hover:text-rose-300 transition-colors"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-rose-300">{error}</p>
      )}
    </div>
  )
}
