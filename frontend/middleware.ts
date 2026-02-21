import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'

// 定义公开路由（不需要登录）
const publicRoutes = ['/', '/login']

function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some(route =>
    pathname === route || pathname.startsWith('/login')
  )
}

export async function middleware(request: NextRequest) {
  const { user, response } = await updateSession(request)

  // 如果不是公开路由且未登录，重定向到登录页
  if (!isPublicRoute(request.nextUrl.pathname) && !user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 如果已登录且访问登录页，重定向到项目页
  if (isPublicRoute(request.nextUrl.pathname) && user && request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/projects', request.url))
  }

  return response
}

export const config = {
  matcher: [
    // 跳过 Next.js 内部文件和静态文件
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // 始终运行 API 路由
    '/(api|trpc)(.*)',
  ],
}
