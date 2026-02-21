'use client'

import { createClient } from '@/lib/supabase/client'

let tokenGetter: (() => Promise<string | null>) | null = null
const tokenReadyResolvers: Array<() => void> = []

export function setTokenGetter(getter: () => Promise<string | null>) {
  tokenGetter = getter
  // 通知所有等待者 token 已就绪
  tokenReadyResolvers.forEach(resolve => resolve())
  tokenReadyResolvers.length = 0
}

export function clearTokenGetter() {
  tokenGetter = null
}

function waitForTokenGetter(timeout: number = 3000): Promise<boolean> {
  if (tokenGetter) return Promise.resolve(true)

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeout)
    tokenReadyResolvers.push(() => {
      clearTimeout(timer)
      resolve(true)
    })
  })
}

export async function getSupabaseToken(): Promise<string | null> {
  if (!tokenGetter) {
    // 尝试直接从 Supabase 获取
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        return session.access_token
      }
    } catch {
      // 忽略错误
    }

    // 等待 token getter 初始化
    const ready = await waitForTokenGetter()
    if (!ready || !tokenGetter) return null
  }
  return tokenGetter()
}
