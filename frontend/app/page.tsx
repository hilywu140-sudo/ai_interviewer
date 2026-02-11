'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-cream-100">
      <div className="text-center max-w-lg px-6">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="font-serif text-4xl tracking-tight text-ink-300"
        >
          AI Interview Coach
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.12 }}
          className="mt-4 text-lg text-ink-50 font-light tracking-wide"
        >
          让每一次求职从"盲目试错"变为"精准通关"
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.24 }}
          className="mt-10"
        >
          <Link
            href="/projects"
            className="inline-flex items-center gap-2.5 px-8 py-3.5 bg-warm-300 text-cream-50 text-sm font-medium rounded-button hover:bg-warm-400 transition-all duration-300"
          >
            开始使用
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </motion.div>

        {/* Decorative line */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.5 }}
          className="mt-16 mx-auto w-12 h-px bg-warm-200"
        />
      </div>
    </main>
  )
}
