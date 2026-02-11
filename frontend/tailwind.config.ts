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
        cream: {
          50: '#FDFCF9',
          100: '#FAFAF7',
          200: '#F5F3ED',
          300: '#E8E5DE',
          400: '#D4CFC4',
        },
        ink: {
          50: '#6B6B6B',
          100: '#4A4A4A',
          200: '#333333',
          300: '#1A1A1A',
        },
        warm: {
          50: '#FBF7EE',
          100: '#F0E6CC',
          200: '#D4B96A',
          300: '#8B6914',
          400: '#6B4F0F',
        },
        sage: {
          50: '#F0F5F0',
          100: '#D4E4D4',
          200: '#7BA67B',
          300: '#4A7C59',
        },
        rose: {
          50: '#FDF2F2',
          100: '#F5D5D3',
          200: '#E08A85',
          300: '#C4554E',
        },
      },
      fontFamily: {
        serif: ['var(--font-noto-serif)', 'serif'],
        sans: ['var(--font-noto-sans)', 'sans-serif'],
        display: ['var(--font-playfair)', 'serif'],
      },
      borderRadius: {
        'card': '16px',
        'button': '8px',
        'tag': '6px',
      },
      boxShadow: {
        'subtle': '0 1px 3px rgba(26,26,26,0.04)',
        'card': '0 2px 8px rgba(26,26,26,0.06)',
        'elevated': '0 4px 16px rgba(26,26,26,0.08)',
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
