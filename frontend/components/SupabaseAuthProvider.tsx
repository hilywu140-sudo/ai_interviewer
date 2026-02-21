'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { setTokenGetter, clearTokenGetter } from '@/lib/supabase-token'
import type { User, Session } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  session: Session | null
  isLoaded: boolean
  isSignedIn: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoaded: false,
  isSignedIn: false,
  signOut: async () => {},
})

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    // 获取初始 session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoaded(true)

      if (session) {
        setTokenGetter(async () => {
          const { data } = await supabase.auth.getSession()
          return data.session?.access_token || null
        })
      }
    })

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)

        if (session) {
          setTokenGetter(async () => session.access_token)
        } else {
          clearTokenGetter()
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    clearTokenGetter()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoaded,
        isSignedIn: !!user,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
