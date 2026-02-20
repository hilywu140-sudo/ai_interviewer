'use client'

/**
 * Clerk Token 管理器
 * 用于在非 React 组件中获取 Clerk token
 */

let tokenGetter: (() => Promise<string | null>) | null = null
let tokenReadyResolvers: Array<() => void> = []

// 设置 token getter（由 ClerkTokenProvider 调用）
export function setTokenGetter(getter: () => Promise<string | null>) {
  tokenGetter = getter
  // 通知所有等待者 token 已就绪
  tokenReadyResolvers.forEach(resolve => resolve())
  tokenReadyResolvers = []
}

// 等待 token getter 就绪
function waitForTokenGetter(timeout: number = 3000): Promise<boolean> {
  if (tokenGetter) return Promise.resolve(true)

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve(false)
    }, timeout)

    tokenReadyResolvers.push(() => {
      clearTimeout(timer)
      resolve(true)
    })
  })
}

// 获取 token（供 api-client 使用）
export async function getClerkToken(): Promise<string | null> {
  if (!tokenGetter) {
    // 等待 token getter 初始化
    const ready = await waitForTokenGetter()
    if (!ready || !tokenGetter) {
      console.warn('Clerk token getter not initialized after waiting')
      return null
    }
  }
  return tokenGetter()
}

// 清除 token getter（登出时调用）
export function clearTokenGetter() {
  tokenGetter = null
}
