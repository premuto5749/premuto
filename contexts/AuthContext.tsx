'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AuthContextType {
  isAdmin: boolean
  isLoading: boolean
  refreshAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const checkAdmin = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/check-admin')
      const data = await res.json()
      setIsAdmin(data.isAdmin === true)
    } catch {
      setIsAdmin(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    checkAdmin()

    // 인증 상태 변경 시 admin 상태도 다시 체크
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        checkAdmin()
      } else if (event === 'SIGNED_OUT') {
        setIsAdmin(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [checkAdmin])

  return (
    <AuthContext.Provider value={{
      isAdmin,
      isLoading,
      refreshAuth: checkAdmin,
    }}>
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
