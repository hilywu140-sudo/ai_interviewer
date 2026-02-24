'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
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
        <div className="text-center mb-10">
          <h1 className="text-2xl text-ink-300 tracking-tight font-semibold">找回密码</h1>
          <p className="mt-2 text-sm text-ink-50 font-light">
            输入你的邮箱，我们将发送重置链接
          </p>
        </div>

        <div className="w-full bg-cream-200/50 border border-cream-300 rounded-lg p-6">
          {sent ? (
            <div className="text-center">
              <div className="text-4xl mb-4">📧</div>
              <p className="text-ink-300 mb-2">重置链接已发送</p>
              <p className="text-sm text-ink-100">请检查你的邮箱 {email}</p>
              <a
                href="/login"
                className="inline-block mt-4 text-warm-300 hover:text-warm-400 text-sm"
              >
                返回登录
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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

              {error && <p className="text-sm text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-ink-300 text-cream-50 rounded-md hover:bg-ink-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '发送中...' : '发送重置链接'}
              </button>
            </form>
          )}

          {!sent && (
            <div className="mt-4 text-center">
              <a href="/login" className="text-sm text-warm-300 hover:text-warm-400">
                返回登录
              </a>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
