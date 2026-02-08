import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/auth/admin'

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
    const authUserMap = new Map<string, { email: string; created_at: string }>()
    for (const u of authUsers) {
      authUserMap.set(u.id, { email: u.email || '', created_at: u.created_at })
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

    // 4. 오늘 사용량 (KST 기준)
    const now = new Date()
    const kstOffset = 9 * 60 * 60 * 1000
    const kstNow = new Date(now.getTime() + kstOffset)
    const todayStart = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()) - kstOffset)

    const { data: todayUsage } = await supabase
      .from('usage_logs')
      .select('user_id, action')
      .gte('created_at', todayStart.toISOString())

    const usageMap = new Map<string, { ocr: number; photo: number }>()
    for (const u of todayUsage || []) {
      if (!usageMap.has(u.user_id)) {
        usageMap.set(u.user_id, { ocr: 0, photo: 0 })
      }
      const entry = usageMap.get(u.user_id)!
      if (u.action === 'ocr_analysis') entry.ocr++
      else if (u.action === 'daily_log_photo') entry.photo++
    }

    // 5. 검사기록 수 / 일일기록 수
    const { data: testRecords } = await supabase
      .from('test_records')
      .select('user_id')

    const testCountMap = new Map<string, number>()
    for (const r of testRecords || []) {
      testCountMap.set(r.user_id, (testCountMap.get(r.user_id) || 0) + 1)
    }

    const { data: dailyLogs } = await supabase
      .from('daily_logs')
      .select('user_id')

    const dailyCountMap = new Map<string, number>()
    for (const r of dailyLogs || []) {
      dailyCountMap.set(r.user_id, (dailyCountMap.get(r.user_id) || 0) + 1)
    }

    // 6. 결과 조합
    const users = userIds.map(userId => {
      const authUser = authUserMap.get(userId)
      const profile = profileMap.get(userId)
      const usage = usageMap.get(userId)
      return {
        user_id: userId,
        email: authUser?.email || '',
        tier: profile?.tier || 'free',
        pets: userPetsMap.get(userId) || [],
        today_ocr: usage?.ocr || 0,
        today_photo: usage?.photo || 0,
        test_records: testCountMap.get(userId) || 0,
        daily_logs: dailyCountMap.get(userId) || 0,
        joined_at: authUser?.created_at || profile?.created_at || null,
      }
    })

    // tier 순서: premium > basic > free, 그 다음 기록 수 내림차순
    const tierOrder: Record<string, number> = { premium: 0, basic: 1, free: 2 }
    users.sort((a, b) => {
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
