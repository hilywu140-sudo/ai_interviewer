'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { useAuth } from '@/components/AuthProvider'
import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || ''

function LoginContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const redirect = searchParams.get('redirect') || '/projects'
  const { setAuth } = useAuth()

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [step, setStep] = useState<'email' | 'code'>('email')
  const codeInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  useEffect(() => {
    if (step === 'code') {
      codeInputRef.current?.focus()
    }
  }, [step])

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setSendingCode(true)
    setError('')
    setMessage('')

    try {
      const res = await axios.post(`${API_BASE_URL}/auth/send-code`, { email })
      const data = res.data

      if (data.success) {
        setMessage(data.message.includes('验证码为')
          ? data.message
          : '验证码已发送到你的邮箱')
        setCountdown(60)
        setStep('code')
      } else {
        setError(data.message)
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || '发送失败，请稍后重试')
    }
    setSendingCode(false)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await axios.post(`${API_BASE_URL}/auth/login`, { email, code })
      const data = res.data

      if (data.success && data.token && data.user) {
        setAuth(data.token, data.user)
        router.push(redirect)
        router.refresh()
      } else {
        setError(data.message || '登录失败')
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || '登录失败，请稍后重试')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-50 px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="flex flex-col items-center w-full max-w-sm"
      >
        {/* Brand */}
        <div className="text-center mb-10">
          <h1 className="text-2xl text-ink-300 tracking-tight font-semibold">AI 面试教练</h1>
          <p className="mt-2 text-sm text-ink-50 font-light">
            输入邮箱获取验证码，即可登录
          </p>
        </div>

        <div className="w-full bg-cream-200/50 border border-cream-300 rounded-lg p-6">
          {step === 'email' ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label className="block text-sm text-ink-100 mb-1">邮箱</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-transparent border border-cream-400 rounded-md text-ink-300 focus:border-warm-300 focus:outline-none transition-colors"
                  placeholder="your@email.com"
                  required
                  autoFocus
                />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={sendingCode}
                className="w-full py-2 bg-ink-300 text-cream-50 rounded-md hover:bg-ink-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingCode ? '发送中...' : '获取验证码'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm text-ink-100">邮箱</label>
                  <button
                    type="button"
                    onClick={() => { setStep('email'); setCode(''); setError(''); setMessage(''); }}
                    className="text-xs text-warm-300 hover:text-warm-400"
                  >
                    修改
                  </button>
                </div>
                <p className="text-sm text-ink-300 bg-cream-100/50 px-3 py-2 rounded-md border border-cream-300">
                  {email}
                </p>
              </div>

              <div>
                <label className="block text-sm text-ink-100 mb-1">验证码</label>
                <div className="flex gap-2">
                  <input
                    ref={codeInputRef}
                    type="text"
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="flex-1 px-3 py-2 bg-transparent border border-cream-400 rounded-md text-ink-300 focus:border-warm-300 focus:outline-none transition-colors tracking-widest text-center text-lg"
                    placeholder="6 位验证码"
                    maxLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => handleSendCode({ preventDefault: () => {} } as React.FormEvent)}
                    disabled={countdown > 0 || sendingCode}
                    className="px-3 py-2 text-sm border border-cream-400 rounded-md text-ink-100 hover:border-warm-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {countdown > 0 ? `${countdown}s` : '重新发送'}
                  </button>
                </div>
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}
              {message && <p className="text-sm text-green-600">{message}</p>}

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full py-2 bg-ink-300 text-cream-50 rounded-md hover:bg-ink-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '登录中...' : '登录'}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-ink-50 font-light">
          新用户将自动创建账户
        </p>
      </motion.div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-cream-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-warm-300"></div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
