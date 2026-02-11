'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { sendCode, login } from '@/lib/auth-api'
import { motion } from 'framer-motion'

export default function LoginPage() {
  const router = useRouter()
  const { isAuthenticated, login: setLoginUser } = useAuth()

  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)

  // 已登录则跳转
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/projects')
    }
  }, [isAuthenticated, router])

  // 倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // 发送验证码
  const handleSendCode = async () => {
    if (!phone || phone.length !== 11) {
      setError('请输入正确的手机号')
      return
    }

    setError('')
    setIsSending(true)

    try {
      const result = await sendCode({ phone })
      if (result.success) {
        setCountdown(60)
        // 开发模式显示验证码
        if (result.message.includes('开发模式')) {
          setError(result.message)
        }
      } else {
        setError(result.message)
      }
    } catch (err: any) {
      setError(err.message || '发送失败')
    } finally {
      setIsSending(false)
    }
  }

  // 登录
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!phone || phone.length !== 11) {
      setError('请输入正确的手机号')
      return
    }

    if (!code || code.length !== 6) {
      setError('请输入 6 位验证码')
      return
    }

    setError('')
    setIsLoading(true)

    try {
      const result = await login({ phone, code })
      if (result.success && result.user) {
        setLoginUser(result.user)
        router.replace('/projects')
      } else {
        setError(result.message || '登录失败')
      }
    } catch (err: any) {
      setError(err.message || '登录失败')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-100 px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="max-w-sm w-full"
      >
        {/* Brand */}
        <div className="text-center mb-10">
          <h1 className="font-serif text-2xl text-ink-300 tracking-tight">AI 面试教练</h1>
          <p className="mt-2 text-sm text-ink-50 font-light">登录后开始你的面试练习</p>
        </div>

        {/* Card */}
        <div className="bg-cream-200/50 border border-cream-300 rounded-card px-8 py-10">
          <form onSubmit={handleLogin} className="space-y-8">
            {/* 手机号 */}
            <div>
              <label htmlFor="phone" className="block text-xs font-medium text-ink-100 tracking-wide mb-2">
                手机号
              </label>
              <input
                id="phone"
                type="tel"
                maxLength={11}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="请输入手机号"
                className="w-full bg-transparent border-0 border-b border-cream-400 px-0 py-2.5 text-sm text-ink-300 placeholder-cream-400 focus:border-warm-300 focus:ring-0 transition-colors"
              />
            </div>

            {/* 验证码 */}
            <div>
              <label htmlFor="code" className="block text-xs font-medium text-ink-100 tracking-wide mb-2">
                验证码
              </label>
              <div className="flex items-end gap-4">
                <input
                  id="code"
                  type="text"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="6 位验证码"
                  className="flex-1 bg-transparent border-0 border-b border-cream-400 px-0 py-2.5 text-sm text-ink-300 placeholder-cream-400 focus:border-warm-300 focus:ring-0 transition-colors"
                />
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={countdown > 0 || isSending || phone.length !== 11}
                  className="text-sm font-medium text-warm-300 hover:text-warm-400 disabled:text-cream-400 disabled:cursor-not-allowed whitespace-nowrap pb-2.5 transition-colors"
                >
                  {countdown > 0 ? `${countdown}s` : isSending ? '发送中...' : '获取验证码'}
                </button>
              </div>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="text-sm text-rose-300">
                {error}
              </div>
            )}

            {/* 登录按钮 */}
            <button
              type="submit"
              disabled={isLoading || phone.length !== 11 || code.length !== 6}
              className="w-full py-3 bg-ink-300 text-cream-50 text-sm font-medium rounded-button hover:bg-ink-200 disabled:bg-cream-400 disabled:text-cream-50 disabled:cursor-not-allowed transition-all duration-300"
            >
              {isLoading ? '登录中...' : '登录'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-ink-50 font-light">
          新用户验证后自动注册
        </p>
      </motion.div>
    </div>
  )
}
