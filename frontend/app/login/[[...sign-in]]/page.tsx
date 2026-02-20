'use client'

import { SignIn, SignUp } from '@clerk/nextjs'
import { motion } from 'framer-motion'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginContent() {
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode')

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-50 px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="flex flex-col items-center"
      >
        {/* Brand */}
        <div className="text-center mb-10">
          <h1 className="text-2xl text-ink-300 tracking-tight font-semibold">AI 面试教练</h1>
          <p className="mt-2 text-sm text-ink-50 font-light">
            {mode === 'sign-up' ? '创建账户开始面试练习' : '登录后开始你的面试练习'}
          </p>
        </div>

        {/* Clerk 登录/注册组件 */}
        {mode === 'sign-up' ? (
          <SignUp
            routing="hash"
            appearance={{
              elements: {
                rootBox: 'mx-auto',
                card: 'bg-cream-200/50 border border-cream-300 shadow-none',
                headerTitle: 'text-ink-300',
                headerSubtitle: 'text-ink-100',
                socialButtonsBlockButton: 'border-cream-400 text-ink-200 hover:bg-cream-100',
                formFieldLabel: 'text-ink-100',
                formFieldInput: 'bg-transparent border-cream-400 text-ink-300 focus:border-warm-300',
                formButtonPrimary: 'bg-ink-300 hover:bg-ink-200',
                footerActionLink: 'text-warm-300 hover:text-warm-400',
              }
            }}
            signInUrl="/login"
          />
        ) : (
          <SignIn
            routing="hash"
            appearance={{
              elements: {
                rootBox: 'mx-auto',
                card: 'bg-cream-200/50 border border-cream-300 shadow-none',
                headerTitle: 'text-ink-300',
                headerSubtitle: 'text-ink-100',
                socialButtonsBlockButton: 'border-cream-400 text-ink-200 hover:bg-cream-100',
                formFieldLabel: 'text-ink-100',
                formFieldInput: 'bg-transparent border-cream-400 text-ink-300 focus:border-warm-300',
                formButtonPrimary: 'bg-ink-300 hover:bg-ink-200',
                footerActionLink: 'text-warm-300 hover:text-warm-400',
              }
            }}
            signUpUrl="/login?mode=sign-up"
          />
        )}

        <p className="mt-6 text-center text-xs text-ink-50 font-light">
          {mode === 'sign-up' ? '已有账户？点击上方登录' : '新用户验证后自动注册'}
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
