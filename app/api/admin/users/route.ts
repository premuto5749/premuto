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
      .select('user_id, tier, created_at, updated_at')

    const profileMap = new Map<string, { tier: string; created_at: string; updated_at: string }>()
    for (const p of profiles || []) {
      profileMap.set(p.user_id, { tier: p.tier, created_at: p.created_at, updated_at: p.updated_at })
    }

    // 4. 누적 OCR 사용량 + 마지막 활동 시간 (usage_logs 전체)
    const { data: allUsage } = await supabase
      .from('usage_logs')
      .select('user_id, action, created_at')

    const totalOcrMap = new Map<string, number>()
    const usageLastActivityMap = new Map<string, string>()
    for (const u of allUsage || []) {
      if (u.action === 'ocr_analysis') {
        totalOcrMap.set(u.user_id, (totalOcrMap.get(u.user_id) || 0) + 1)
      }
      // usage_logs의 최근 활동도 last_active에 반영
      const existing = usageLastActivityMap.get(u.user_id)
      if (!existing || u.created_at > existing) {
        usageLastActivityMap.set(u.user_id, u.created_at)
      }
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

    // 6. 검사기록 수 + 최근 활동일 / 일일기록 수 + 최근 활동일
    const { data: testRecords } = await supabase
      .from('test_records')
      .select('user_id, created_at')

    const testCountMap = new Map<string, number>()
    const lastActivityMap = new Map<string, string>()
    for (const r of testRecords || []) {
      testCountMap.set(r.user_id, (testCountMap.get(r.user_id) || 0) + 1)
      const existing = lastActivityMap.get(r.user_id)
      if (!existing || r.created_at > existing) {
        lastActivityMap.set(r.user_id, r.created_at)
      }
    }

    const { data: dailyLogs } = await supabase
      .from('daily_logs')
      .select('user_id, created_at')

    const dailyCountMap = new Map<string, number>()
    for (const r of dailyLogs || []) {
      dailyCountMap.set(r.user_id, (dailyCountMap.get(r.user_id) || 0) + 1)
      const existing = lastActivityMap.get(r.user_id)
      if (!existing || r.created_at > existing) {
        lastActivityMap.set(r.user_id, r.created_at)
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
      const candidates = [
        lastActivityMap.get(userId),
        usageLastActivityMap.get(userId),
        authUser?.last_sign_in_at,
      ].filter((v): v is string => !!v)
      const lastActive = candidates.length > 0
        ? candidates.reduce((a, b) => a > b ? a : b)
        : null

      return {
        user_id: userId,
        email: authUser?.email || '',
        tier: profile?.tier || 'free',
        role,
        pets: userPetsMap.get(userId) || [],
        total_ocr: totalOcrMap.get(userId) || 0,
        test_records: testCountMap.get(userId) || 0,
        daily_logs: dailyCountMap.get(userId) || 0,
        joined_at: authUser?.created_at || profile?.created_at || null,
        last_active: lastActive,
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
