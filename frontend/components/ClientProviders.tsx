'use client'

import { useEffect } from 'react'
import { ClerkTokenProvider } from '@/components/ClerkTokenProvider'
import { analytics } from '@/lib/analytics'

export function ClientProviders({ children }: { children: React.ReactNode }) {
  // 初始化 PostHog
  useEffect(() => {
    analytics.init()
  }, [])

  return (
    <ClerkTokenProvider>
      {children}
    </ClerkTokenProvider>
  )
}
