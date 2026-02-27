import { NextResponse, type NextRequest } from 'next/server'

// 定义公开路由（不需要登录）
const publicRoutes = ['/', '/login']

function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some(route => {
    if (route === '/') {
      return pathname === '/'
    }
    return pathname === route || pathname.startsWith(route + '/')
  })
}

export async function middleware(request: NextRequest) {
  // 从 cookie 读取 token（SSR 场景下 localStorage 不可用，所以也检查 cookie）
  const token = request.cookies.get('auth_token')?.value

  // 注意：因为我们用 localStorage 存 token，middleware 无法直接读到
  // 所以不在 middleware 做强制重定向，而是在客户端组件中做路由守卫
  // middleware 只做基于 cookie 的辅助检查

  // 如果已登录且访问登录页，重定向到项目页
  if (token && request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/projects', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
