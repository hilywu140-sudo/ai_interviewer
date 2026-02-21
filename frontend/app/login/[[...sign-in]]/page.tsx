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
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-transparent border border-cream-400 rounded-md text-ink-300 focus:border-warm-300 focus:outline-none transition-colors"
                placeholder="••••••••"
                required
                minLength={6}
              />
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
