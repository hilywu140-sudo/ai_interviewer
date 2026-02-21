'use client'

import { useEffect } from 'react'
import { SupabaseAuthProvider } from '@/components/SupabaseAuthProvider'
import { analytics } from '@/lib/analytics'

export function ClientProviders({ children }: { children: React.ReactNode }) {
  // 初始化 PostHog
  useEffect(() => {
    analytics.init()
  }, [])

  return (
    <SupabaseAuthProvider>
      {children}
    </SupabaseAuthProvider>
  )
}
