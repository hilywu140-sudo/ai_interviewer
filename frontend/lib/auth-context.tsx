'use client'

/**
 * 认证 Context
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { User } from './types'
import { getToken, getStoredUser, getCurrentUser, logout as logoutApi } from './auth-api'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (user: User) => void
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 初始化时检查登录状态
  useEffect(() => {
    const initAuth = async () => {
      const token = getToken()
      if (!token) {
        setIsLoading(false)
        return
      }

      // 先尝试从本地获取用户信息
      const storedUser = getStoredUser()
      if (storedUser) {
        setUser(storedUser)
      }

      // 然后从服务器验证并更新
      try {
        const serverUser = await getCurrentUser()
        if (serverUser) {
          setUser(serverUser)
        } else if (!getToken()) {
          // Token 被清除了（401 响应），清空用户
          setUser(null)
        }
        // 如果 token 还在但请求失败，保留本地用户（可能是网络问题）
      } catch {
        // 网络错误，使用本地缓存
      }

      setIsLoading(false)
    }

    initAuth()
  }, [])

  const login = useCallback((user: User) => {
    setUser(user)
  }, [])

  const logout = useCallback(async () => {
    await logoutApi()
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const serverUser = await getCurrentUser()
    if (serverUser) {
      setUser(serverUser)
    } else {
      setUser(null)
    }
  }, [])

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    refreshUser,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
