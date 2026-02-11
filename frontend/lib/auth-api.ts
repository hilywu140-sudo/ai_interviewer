/**
 * 认证 API
 */

import { SendCodeRequest, SendCodeResponse, LoginRequest, LoginResponse, User } from './types'

// 使用空字符串让请求走 Next.js 代理，避免 CORS 问题
const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

// Token 存储键
const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

/**
 * 获取存储的 Token
 */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

/**
 * 设置 Token
 */
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

/**
 * 清除 Token
 */
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

/**
 * 获取存储的用户信息
 */
export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null
  const userStr = localStorage.getItem(USER_KEY)
  if (!userStr) return null
  try {
    return JSON.parse(userStr)
  } catch {
    return null
  }
}

/**
 * 设置用户信息
 */
export function setStoredUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

/**
 * 发送验证码
 */
export async function sendCode(data: SendCodeRequest): Promise<SendCodeResponse> {
  const response = await fetch(`${API_BASE}/auth/send-code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '发送验证码失败')
  }

  return response.json()
}

/**
 * 登录
 */
export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '登录失败')
  }

  const result = await response.json()

  // 登录成功，保存 Token 和用户信息
  if (result.success && result.token) {
    setToken(result.token)
    if (result.user) {
      setStoredUser(result.user)
    }
  }

  return result
}

/**
 * 获取当前用户信息
 */
export async function getCurrentUser(): Promise<User | null> {
  const token = getToken()
  if (!token) return null

  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        clearToken()
      }
      return null
    }

    const user = await response.json()
    setStoredUser(user)
    return user
  } catch {
    return null
  }
}

/**
 * 登出
 */
export async function logout(): Promise<void> {
  const token = getToken()
  if (token) {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
    } catch {
      // 忽略登出请求失败
    }
  }
  clearToken()
}

/**
 * 检查是否已登录
 */
export function isAuthenticated(): boolean {
  return !!getToken()
}
