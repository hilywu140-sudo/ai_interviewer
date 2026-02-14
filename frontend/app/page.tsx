'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

/* ── Animation variants ── */
const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
}

const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
}

/* ── Feature items ── */
const features = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    ),
    label: '语音练习',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    label: 'STAR 分析',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    label: '答案优化',
  },
]

export default function Home() {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center bg-cream-100 overflow-hidden">

      {/* ── Decorative background elements ── */}

      {/* Large soft blue radial glow — top right */}
      <div
        className="absolute -top-32 -right-32 pointer-events-none"
        style={{
          width: '680px',
          height: '680px',
          background: 'radial-gradient(circle, rgba(59,130,246,0.07) 0%, rgba(59,130,246,0.02) 50%, transparent 72%)',
        }}
      />

      {/* Secondary glow — bottom left */}
      <div
        className="absolute -bottom-48 -left-48 pointer-events-none"
        style={{
          width: '560px',
          height: '560px',
          background: 'radial-gradient(circle, rgba(59,130,246,0.05) 0%, rgba(59,130,246,0.01) 50%, transparent 72%)',
        }}
      />

      {/* Subtle grid pattern — very faint architectural texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(30,41,59,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(30,41,59,0.3) 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
        }}
      />

      {/* Decorative floating circles */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, delay: 0.6 }}
        className="absolute top-1/4 right-[15%] pointer-events-none"
      >
        <div className="w-48 h-48 rounded-full border border-cream-300/60" />
        <div className="absolute top-6 left-6 w-36 h-36 rounded-full border border-warm-200/20" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, delay: 0.8 }}
        className="absolute bottom-[18%] left-[12%] pointer-events-none"
      >
        <div className="w-24 h-24 rounded-full border border-cream-300/40" />
      </motion.div>

      {/* Small accent dot */}
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 1 }}
        className="absolute top-[32%] left-[22%] w-2 h-2 rounded-full bg-warm-200/30 pointer-events-none"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 1.1 }}
        className="absolute bottom-[28%] right-[18%] w-1.5 h-1.5 rounded-full bg-warm-300/20 pointer-events-none"
      />


      {/* ── Top navigation ── */}
      <motion.nav
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-5 z-10"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-button bg-warm-300 text-white text-xs font-bold shadow-subtle">
            AI
          </div>
          <span className="text-ink-200 text-sm font-medium tracking-wide">
            Interview Coach
          </span>
        </div>
        <div className="text-cream-400 text-xs tracking-wider font-light">
          v1.0
        </div>
      </motion.nav>


      {/* ── Center content ── */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative z-10 text-center max-w-2xl px-6"
      >
        {/* Pill badge */}
        <motion.div variants={fadeUp} className="flex justify-center mb-8">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cream-300 bg-cream-50/80 text-ink-50 text-xs tracking-wide shadow-subtle backdrop-blur-sm">
            <svg className="w-3.5 h-3.5 text-warm-300" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.789l1.599.799L9 4.323V3a1 1 0 011-1z" />
            </svg>
            AI 驱动的面试辅导
          </span>
        </motion.div>

        {/* Main title */}
        <motion.h1
          variants={fadeUp}
          className="font-serif text-4xl sm:text-5xl md:text-6xl leading-tight text-ink-300 tracking-tight"
        >
          让每一次面试
          <br />
          都成为{' '}
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage: 'linear-gradient(135deg, #60A5FA 0%, #3B82F6 50%, #2563EB 100%)',
            }}
          >
            精准通关
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          variants={fadeUp}
          className="mt-5 text-base md:text-lg text-ink-50 font-light leading-relaxed max-w-md mx-auto"
        >
          基于 STAR 框架的 AI 面试教练
          <br className="hidden md:block" />
          实时语音练习、智能反馈、答案优化
        </motion.p>

        {/* Feature tags */}
        <motion.div variants={fadeUp} className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          {features.map((f, i) => (
            <motion.span
              key={i}
              variants={scaleIn}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-cream-50 border border-cream-300 rounded-full text-xs text-ink-100 shadow-subtle"
            >
              <span className="text-warm-300">{f.icon}</span>
              {f.label}
            </motion.span>
          ))}
        </motion.div>

        {/* CTA button */}
        <motion.div variants={fadeUp} className="mt-12">
          <Link
            href="/projects"
            className="group inline-flex items-center gap-2.5 px-8 py-3.5 bg-warm-300 text-white text-sm font-medium rounded-full hover:bg-warm-400 shadow-elevated hover:shadow-[0_6px_24px_rgba(59,130,246,0.2)] transition-all duration-300"
          >
            进入
            <svg
              className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </motion.div>
      </motion.div>


      {/* ── Bottom branding ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.9 }}
        className="absolute bottom-6 flex items-center gap-3 text-cream-400 text-xs tracking-widest font-light"
      >
        <span className="w-6 h-px bg-cream-300" />
        AI INTERVIEW COACH
        <span className="w-6 h-px bg-cream-300" />
      </motion.div>
    </main>
  )
}
