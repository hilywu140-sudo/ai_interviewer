'use client'

import { useAuth } from '@clerk/nextjs'
import { useEffect, useRef } from 'react'
import { setTokenGetter, clearTokenGetter } from '@/lib/clerk-token'

/**
 * Clerk Token Provider
 * 初始化 token getter，使 api-client 可以获取 Clerk token
 */
export function ClerkTokenProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn, isLoaded } = useAuth()
  const initialized = useRef(false)

  // 立即设置 token getter（不等待 useEffect）
  if (isLoaded && isSignedIn && !initialized.current) {
    initialized.current = true
    setTokenGetter(async () => {
      try {
        return await getToken()
      } catch {
        return null
      }
    })
  }

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      setTokenGetter(async () => {
        try {
          return await getToken()
        } catch {
          return null
        }
      })
    } else if (isLoaded && !isSignedIn) {
      clearTokenGetter()
      initialized.current = false
    }

    return () => {
      clearTokenGetter()
      initialized.current = false
    }
  }, [getToken, isSignedIn, isLoaded])

  return <>{children}</>
}
