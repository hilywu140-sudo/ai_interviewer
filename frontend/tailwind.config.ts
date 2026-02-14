import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Cloud — 背景色系（浅灰蓝，柔和护眼）
        cream: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
        },
        // Slate — 文字色系（深灰蓝，清晰易读）
        ink: {
          50: '#64748B',
          100: '#475569',
          200: '#334155',
          300: '#1E293B',
        },
        // Trust Blue — 主色调（专业信任感）
        warm: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#60A5FA',
          300: '#3B82F6',
          400: '#2563EB',
        },
        // Growth Green — 成功/正面反馈
        sage: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#4ADE80',
          300: '#16A34A',
        },
        // Coral — 错误/录音状态
        rose: {
          50: '#FFF1F2',
          100: '#FFE4E6',
          200: '#FB7185',
          300: '#E11D48',
        },
      },
      fontFamily: {
        serif: ['var(--font-noto-serif)', 'serif'],
        sans: ['var(--font-noto-sans)', 'sans-serif'],
        display: ['var(--font-playfair)', 'serif'],
      },
      borderRadius: {
        'card': '16px',
        'bubble': '20px',
        'bubble-tail': '4px',
        'button': '8px',
        'tag': '6px',
      },
      boxShadow: {
        'subtle': '0 1px 3px rgba(30,41,59,0.04)',
        'card': '0 2px 8px rgba(30,41,59,0.06)',
        'elevated': '0 4px 16px rgba(30,41,59,0.08)',
        'bubble': '0 1px 2px rgba(30,41,59,0.06), 0 1px 3px rgba(30,41,59,0.04)',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'pulse-warm': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.4s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'pulse-warm': 'pulse-warm 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
export default config
