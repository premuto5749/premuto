import { createClient } from '@/lib/supabase/server'

/**
 * 관리자 인증 유틸리티
 *
 * 우선순위:
 * 1. 환경변수 ADMIN_USER_IDS (쉼표 구분)
 * 2. user_roles 테이블 (role = 'admin' 또는 'super_admin')
 */

// 환경변수에서 관리자 ID 목록 가져오기
function getAdminIdsFromEnv(): string[] {
  const adminIds = process.env.ADMIN_USER_IDS
  if (!adminIds) return []
  return adminIds.split(',').map(id => id.trim()).filter(Boolean)
}

/**
 * 사용자가 관리자인지 확인 (환경변수 기반)
 */
export function isAdminByEnv(userId: string): boolean {
  const adminIds = getAdminIdsFromEnv()
  return adminIds.includes(userId)
}

/**
 * 사용자가 관리자인지 확인 (DB 기반)
 */
export async function isAdminByDb(userId: string): Promise<boolean> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .in('role', ['admin', 'super_admin'])
      .single()

    if (error || !data) return false
    return true
  } catch {
    return false
  }
}

/**
 * 사용자가 관리자인지 확인 (환경변수 + DB 복합)
 */
export async function isAdmin(userId: string): Promise<boolean> {
  // 1. 환경변수 체크 (빠름)
  if (isAdminByEnv(userId)) {
    return true
  }

  // 2. DB 체크 (확장성)
  return await isAdminByDb(userId)
}

/**
 * 현재 로그인한 사용자가 관리자인지 확인
 */
export async function checkCurrentUserIsAdmin(): Promise<{
  isAdmin: boolean
  userId: string | null
  error?: string
}> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { isAdmin: false, userId: null, error: 'Not authenticated' }
    }

    const adminStatus = await isAdmin(user.id)
    return { isAdmin: adminStatus, userId: user.id }
  } catch (error) {
    return {
      isAdmin: false,
      userId: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * 관리자 권한 필요 API에서 사용할 가드 함수
 */
export async function requireAdmin(): Promise<{
  authorized: boolean
  userId: string | null
  error?: string
}> {
  const result = await checkCurrentUserIsAdmin()

  if (!result.userId) {
    return { authorized: false, userId: null, error: 'Authentication required' }
  }

  if (!result.isAdmin) {
    return { authorized: false, userId: result.userId, error: 'Admin access required' }
  }

  return { authorized: true, userId: result.userId }
}
