import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin, isAdminByEnv } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/users
 * 전체 사용자 목록 + tier + 사용 통계
 */
export async function GET() {
  try {
    const { authorized, error } = await requireAdmin()
    if (!authorized) {
      return NextResponse.json({ error }, { status: 403 })
    }

    const supabase = createServiceClient()

    // 1. auth.admin.listUsers()로 전체 사용자 목록 (이메일 포함)
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    if (authError) {
      console.error('Failed to fetch auth users:', authError)
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    const authUsers = authData?.users || []
    const authUserMap = new Map<string, { email: string; created_at: string; last_sign_in_at: string | null }>()
    for (const u of authUsers) {
      authUserMap.set(u.id, {
        email: u.email || '',
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
      })
    }

    const userIds = authUsers.map(u => u.id)

    // 2. pets 테이블에서 펫 목록
    const { data: petsData } = await supabase
      .from('pets')
      .select('user_id, name')
      .order('created_at', { ascending: true })

    const userPetsMap = new Map<string, string[]>()
    for (const pet of petsData || []) {
      if (!userPetsMap.has(pet.user_id)) {
        userPetsMap.set(pet.user_id, [])
      }
      userPetsMap.get(pet.user_id)!.push(pet.name)
    }

    // 3. user_profiles에서 tier 정보
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('user_id, tier, nickname, phone, profile_image, terms_accepted_at, created_at, updated_at')

    const profileMap = new Map<string, { tier: string; nickname: string | null; phone: string | null; profile_image: string | null; terms_accepted_at: string | null; created_at: string; updated_at: string }>()
    for (const p of profiles || []) {
      profileMap.set(p.user_id, { tier: p.tier, nickname: p.nickname, phone: p.phone, profile_image: p.profile_image, terms_accepted_at: p.terms_accepted_at, created_at: p.created_at, updated_at: p.updated_at })
    }

    // 4. SQL 집계로 사용 통계 조회 (RPC 1회 호출로 usage_logs + test_records + daily_logs 집계)
    const { data: statsData, error: statsError } = await supabase.rpc('get_admin_user_stats')
    if (statsError) {
      console.error('Failed to fetch user stats:', statsError)
    }

    const statsMap = new Map<string, { total_ocr: number; test_records_count: number; daily_logs_count: number; last_usage_at: string | null; last_test_at: string | null; last_daily_at: string | null }>()
    for (const s of statsData || []) {
      statsMap.set(s.user_id, {
        total_ocr: Number(s.total_ocr) || 0,
        test_records_count: Number(s.test_records_count) || 0,
        daily_logs_count: Number(s.daily_logs_count) || 0,
        last_usage_at: s.last_usage_at,
        last_test_at: s.last_test_at,
        last_daily_at: s.last_daily_at,
      })
    }

    // 5. user_roles에서 관리자 역할 정보
    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('role', ['admin', 'super_admin'])

    const roleMap = new Map<string, string>()
    for (const r of rolesData || []) {
      // super_admin이 admin보다 우선
      const existing = roleMap.get(r.user_id)
      if (!existing || r.role === 'super_admin') {
        roleMap.set(r.user_id, r.role)
      }
    }

    // 6. 결과 조합
    const users = userIds.map(userId => {
      const authUser = authUserMap.get(userId)
      const profile = profileMap.get(userId)
      // 관리자 역할 판정: env 기반 > DB 기반
      const dbRole = roleMap.get(userId)
      const envAdmin = isAdminByEnv(userId)
      let role: string | null = null
      if (envAdmin) {
        role = dbRole === 'super_admin' ? 'super_admin' : 'env_admin'
      } else if (dbRole) {
        role = dbRole
      }

      // 마지막 활동: 데이터 기록 / usage_logs / 마지막 로그인 중 최신
      const stats = statsMap.get(userId)
      const candidates = [
        stats?.last_test_at,
        stats?.last_daily_at,
        stats?.last_usage_at,
        authUser?.last_sign_in_at,
      ].filter((v): v is string => !!v)
      const lastActive = candidates.length > 0
        ? candidates.reduce((a, b) => a > b ? a : b)
        : null

      return {
        user_id: userId,
        email: authUser?.email || '',
        nickname: profile?.nickname || null,
        phone: profile?.phone || null,
        tier: profile?.tier || 'free',
        role,
        pets: userPetsMap.get(userId) || [],
        total_ocr: stats?.total_ocr || 0,
        test_records: stats?.test_records_count || 0,
        daily_logs: stats?.daily_logs_count || 0,
        joined_at: authUser?.created_at || profile?.created_at || null,
        last_active: lastActive,
        terms_accepted_at: profile?.terms_accepted_at || null,
      }
    })

    // 정렬: 관리자 > tier 순서 > 기록 수 내림차순
    const roleOrder: Record<string, number> = { super_admin: 0, env_admin: 1, admin: 2 }
    const tierOrder: Record<string, number> = { premium: 0, basic: 1, free: 2 }
    users.sort((a, b) => {
      const aIsAdmin = a.role ? 0 : 1
      const bIsAdmin = b.role ? 0 : 1
      if (aIsAdmin !== bIsAdmin) return aIsAdmin - bIsAdmin
      if (a.role && b.role) {
        const roleDiff = (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9)
        if (roleDiff !== 0) return roleDiff
      }
      const tierDiff = (tierOrder[a.tier] ?? 9) - (tierOrder[b.tier] ?? 9)
      if (tierDiff !== 0) return tierDiff
      return (b.test_records + b.daily_logs) - (a.test_records + a.daily_logs)
    })

    return NextResponse.json({
      success: true,
      data: users,
      total: users.length,
    })
  } catch (error) {
    console.error('Admin users GET error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/admin/users
 * 관리자 권한 부여/해제
 * Body: { user_id: string, action: 'grant' | 'revoke' }
 */
export async function POST(request: NextRequest) {
  try {
    const { authorized, error, userId: currentUserId } = await requireAdmin()
    if (!authorized) {
      return NextResponse.json({ error }, { status: 403 })
    }

    const body = await request.json()
    const { user_id, action } = body

    if (!user_id || !action) {
      return NextResponse.json({ error: 'user_id와 action은 필수입니다' }, { status: 400 })
    }

    if (!['grant', 'revoke'].includes(action)) {
      return NextResponse.json({ error: 'action은 grant 또는 revoke여야 합니다' }, { status: 400 })
    }

    // 자기 자신의 권한은 변경 불가
    if (user_id === currentUserId) {
      return NextResponse.json({ error: '자신의 관리자 권한은 변경할 수 없습니다' }, { status: 400 })
    }

    const supabase = createServiceClient()

    if (action === 'grant') {
      const { error: dbError } = await supabase
        .from('user_roles')
        .upsert(
          { user_id, role: 'admin', granted_by: currentUserId },
          { onConflict: 'user_id,role' }
        )

      if (dbError) {
        console.error('Failed to grant admin role:', dbError)
        return NextResponse.json({ error: dbError.message }, { status: 500 })
      }
    } else {
      // env 기반 관리자는 DB에서 해제해도 여전히 관리자
      if (isAdminByEnv(user_id)) {
        return NextResponse.json(
          { error: '환경변수 기반 관리자는 여기서 해제할 수 없습니다' },
          { status: 400 }
        )
      }

      const { error: dbError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', user_id)
        .eq('role', 'admin')

      if (dbError) {
        console.error('Failed to revoke admin role:', dbError)
        return NextResponse.json({ error: dbError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin users POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/users
 * 사용자 tier 변경
 * Body: { user_id: string, tier: 'free' | 'basic' | 'premium' }
 */
export async function PATCH(request: NextRequest) {
  try {
    const { authorized, error } = await requireAdmin()
    if (!authorized) {
      return NextResponse.json({ error }, { status: 403 })
    }

    const body = await request.json()
    const { user_id, tier } = body

    if (!user_id || !tier) {
      return NextResponse.json({ error: 'user_id와 tier는 필수입니다' }, { status: 400 })
    }

    if (!['free', 'basic', 'premium'].includes(tier)) {
      return NextResponse.json({ error: 'tier는 free, basic, premium 중 하나여야 합니다' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // upsert: 프로필이 없으면 생성, 있으면 업데이트
    const { data, error: dbError } = await supabase
      .from('user_profiles')
      .upsert(
        { user_id, tier },
        { onConflict: 'user_id' }
      )
      .select()
      .single()

    if (dbError) {
      console.error('Failed to update user tier:', dbError)
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error('Admin users PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
