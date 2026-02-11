'use client'

/**
 * 路由守卫组件
 * 
 * 包裹需要登录才能访问的页面
 */

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

// 不需要登录的路由
const PUBLIC_ROUTES = ['/login']

// 检查是否是公开路由
function isPublicRoute(pathname: string): boolean {
  // 根路径 "/" 是公开的
  if (pathname === '/') return true
  // 检查其他公开路由
  return PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (isLoading) return

    if (!isAuthenticated && !isPublicRoute(pathname)) {
      // 未登录且不是公开路由，跳转到登录页
      router.replace('/login')
    }
  }, [isAuthenticated, isLoading, pathname, router])

  // 加载中显示加载状态
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  // 未登录且不是公开路由，不渲染内容
  if (!isAuthenticated && !isPublicRoute(pathname)) {
    return null
  }

  return <>{children}</>
}
