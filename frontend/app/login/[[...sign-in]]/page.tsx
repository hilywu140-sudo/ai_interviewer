'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'

function LoginContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const mode = searchParams.get('mode')
  const redirect = searchParams.get('redirect') || '/projects'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const supabase = createClient()

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message === 'Invalid login credentials'
        ? '邮箱或密码错误'
        : error.message)
    } else {
      router.push(redirect)
      router.refresh()
    }
    setLoading(false)
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setError(error.message)
    } else {
      setMessage('注册成功！请检查邮箱完成验证')
    }
    setLoading(false)
  }

  const isSignUp = mode === 'sign-up'

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
            {isSignUp ? '创建账户开始面试练习' : '登录后开始你的面试练习'}
          </p>
        </div>

        {/* 登录/注册表单 */}
        <div className="w-full bg-cream-200/50 border border-cream-300 rounded-lg p-6">
          <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="space-y-4">
            <div>
              <label className="block text-sm text-ink-100 mb-1">邮箱</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-transparent border border-cream-400 rounded-md text-ink-300 focus:border-warm-300 focus:outline-none transition-colors"
                placeholder="your@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-ink-100 mb-1">密码</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 bg-transparent border border-cream-400 rounded-md text-ink-300 focus:border-warm-300 focus:outline-none transition-colors"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-cream-400 hover:text-ink-100 transition-colors"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {!isSignUp && (
                <div className="mt-1 text-right">
                  <a href="/forgot-password" className="text-xs text-warm-300 hover:text-warm-400">
                    忘记密码？
                  </a>
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            {message && (
              <p className="text-sm text-green-600">{message}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-ink-300 text-cream-50 rounded-md hover:bg-ink-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '处理中...' : (isSignUp ? '注册' : '登录')}
            </button>
          </form>

          <div className="mt-4 text-center">
            {isSignUp ? (
              <p className="text-sm text-ink-100">
                已有账户？
                <a href="/login" className="text-warm-300 hover:text-warm-400 ml-1">
                  立即登录
                </a>
              </p>
            ) : (
              <p className="text-sm text-ink-100">
                没有账户？
                <a href="/login?mode=sign-up" className="text-warm-300 hover:text-warm-400 ml-1">
                  立即注册
                </a>
              </p>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-ink-50 font-light">
          {isSignUp ? '注册后请检查邮箱完成验证' : '输入邮箱和密码登录'}
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
