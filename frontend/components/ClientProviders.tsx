'use client'

import { useEffect } from 'react'
import { AuthProvider } from '@/components/AuthProvider'
import { analytics } from '@/lib/analytics'

export function ClientProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    analytics.init()
  }, [])

  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  )
}
