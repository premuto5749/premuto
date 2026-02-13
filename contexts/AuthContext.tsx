'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { User } from '@supabase/supabase-js'

// ── Tier 타입 ──────────────────────────────────────────────
interface TierUsage {
  used: number
  limit: number
  remaining: number
}

export interface TierData {
  tier: string
  config: {
    label: string
    daily_ocr_limit: number
    max_files_per_ocr: number
    daily_log_max_photos: number
    daily_log_max_photo_size_mb: number
    daily_description_gen_limit: number
    monthly_detailed_export_limit: number
    daily_excel_export_limit: number
    weekly_photo_export_limit: number
    google_drive_enabled: boolean
  }
  allTierConfigs?: Record<string, unknown>
  usage: {
    ocr_analysis: TierUsage
    daily_log_photo: TierUsage
    description_generation: TierUsage
  }
}

// ── Context 타입 ───────────────────────────────────────────
interface AuthContextType {
  user: User | null
  isAdmin: boolean
  isLoading: boolean
  tier: TierData | null
  tierLoading: boolean
  refreshAuth: () => Promise<void>
  refreshTier: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// 세션 만료 시 리다이렉트하지 않을 공개 경로
const PUBLIC_PATHS = ['/', '/login', '/auth', '/reset-password', '/privacy', '/terms']

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [tier, setTier] = useState<TierData | null>(null)
  const [tierLoading, setTierLoading] = useState(true)

  // 이전에 로그인 상태였는지 추적 (세션 만료 감지용)
  const hadUserRef = useRef(false)
  const router = useRouter()
  const pathname = usePathname()
  const pathnameRef = useRef(pathname)

  // pathname이 바뀔 때마다 ref 갱신 (클로저 문제 방지)
  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  // ── Admin 체크 ─────────────────────────────────────────
  const checkAdmin = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/check-admin')
      const data = await res.json()
      setIsAdmin(data.isAdmin === true)
    } catch {
      setIsAdmin(false)
    }
  }, [])

  // ── Tier 조회 ──────────────────────────────────────────
  const fetchTier = useCallback(async () => {
    try {
      setTierLoading(true)
      const res = await fetch('/api/tier')
      if (res.status === 401) {
        setTier(null)
        return
      }
      const data = await res.json()
      if (data.success) {
        setTier(data.data)
      }
    } catch {
      // tier fetch 실패 시 무시 (네트워크 오류 등)
    } finally {
      setTierLoading(false)
    }
  }, [])

  // ── 초기 인증 ──────────────────────────────────────────
  const initAuth = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      setUser(currentUser)

      if (currentUser) {
        hadUserRef.current = true
        await Promise.all([checkAdmin(), fetchTier()])
      } else {
        setTierLoading(false)
      }
    } catch {
      setTierLoading(false)
    } finally {
      setIsLoading(false)
    }
  }, [checkAdmin, fetchTier])

  // ── Auth 이벤트 리스닝 ─────────────────────────────────
  useEffect(() => {
    initAuth()

    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        const newUser = session?.user ?? null
        setUser(newUser)
        if (newUser) {
          hadUserRef.current = true
          checkAdmin()
          fetchTier()
        }
      } else if (event === 'TOKEN_REFRESHED') {
        // 토큰 갱신 시 user 객체 업데이트 (pet 재조회는 불필요)
        const newUser = session?.user ?? null
        setUser(newUser)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setIsAdmin(false)
        setTier(null)

        // 이전에 로그인 상태였으면 세션 만료로 판단 → 로그인 페이지 리다이렉트
        if (hadUserRef.current) {
          hadUserRef.current = false
          const currentPath = pathnameRef.current
          const isPublic = PUBLIC_PATHS.some(p => currentPath === p || currentPath.startsWith(p + '/'))
          if (!isPublic) {
            router.push('/login?expired=true')
          }
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [initAuth, checkAdmin, fetchTier, router])

  return (
    <AuthContext.Provider value={{
      user,
      isAdmin,
      isLoading,
      tier,
      tierLoading,
      refreshAuth: initAuth,
      refreshTier: fetchTier,
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
