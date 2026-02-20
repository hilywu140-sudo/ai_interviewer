import type { Metadata } from 'next'
import { Noto_Serif_SC, Noto_Sans_SC, Playfair_Display } from 'next/font/google'
import './globals.css'
import { ClerkProvider } from '@clerk/nextjs'
import { zhCN } from '@clerk/localizations'
import { ClientProviders } from '@/components/ClientProviders'

const notoSerif = Noto_Serif_SC({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-noto-serif',
  display: 'swap',
})

const notoSans = Noto_Sans_SC({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-noto-sans',
  display: 'swap',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-playfair',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'AI Interview Coach',
  description: 'Your personal AI interview preparation assistant',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider localization={zhCN}>
      <html lang="zh-CN">
        <body className={`${notoSerif.variable} ${notoSans.variable} ${playfair.variable} font-sans bg-cream-50 text-ink-300 antialiased`}>
          <ClientProviders>
            {children}
          </ClientProviders>
        </body>
      </html>
    </ClerkProvider>
  )
}
