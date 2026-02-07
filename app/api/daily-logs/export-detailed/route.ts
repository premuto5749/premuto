import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkMonthlyUsageLimit, logUsage } from '@/lib/tier'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const usageCheck = await checkMonthlyUsageLimit(user.id, 'detailed_export')

    return NextResponse.json({
      tier: usageCheck.tier,
      used: usageCheck.used,
      limit: usageCheck.limit,
      remaining: usageCheck.remaining,
    })
  } catch (error) {
    console.error('Export detailed usage check error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { year, month, pet_id } = body as {
      year: number
      month: number // 0-indexed
      pet_id?: string
    }

    if (year == null || month == null) {
      return NextResponse.json(
        { error: 'year와 month는 필수입니다' },
        { status: 400 }
      )
    }

    // 월간 사용 제한 체크
    const usageCheck = await checkMonthlyUsageLimit(user.id, 'detailed_export')
    if (!usageCheck.allowed) {
      return NextResponse.json({
        error: 'TIER_LIMIT_EXCEEDED',
        message: '이번 달 상세 내보내기 횟수를 모두 사용했습니다.',
        tier: usageCheck.tier,
        used: usageCheck.used,
        limit: usageCheck.limit,
      }, { status: 403 })
    }

    // 해당 월 날짜 범위 (KST 기준)
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

    let query = supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .gte('logged_at', `${startDate}T00:00:00+09:00`)
      .lte('logged_at', `${endDate}T23:59:59.999+09:00`)
      .order('logged_at', { ascending: true })

    if (pet_id) {
      query = query.eq('pet_id', pet_id)
    }

    const { data, error } = await query

    if (error) {
      console.error('Export detailed logs query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 사용량 기록
    await logUsage(user.id, 'detailed_export', 1, {
      year,
      month,
      pet_id: pet_id || null,
      record_count: data?.length || 0,
    })

    const newUsed = usageCheck.used + 1
    const newRemaining = usageCheck.limit === -1 ? -1 : Math.max(0, usageCheck.limit - newUsed)

    return NextResponse.json({
      success: true,
      data: data || [],
      usage: {
        tier: usageCheck.tier,
        used: newUsed,
        limit: usageCheck.limit,
        remaining: newRemaining,
      },
    })

  } catch (error) {
    console.error('Export detailed API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
