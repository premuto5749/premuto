import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { checkUsageLimit, checkWeeklyUsageLimit, logUsage } from '@/lib/tier'

const BUCKET_NAME = 'daily-log-photos'
const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 1 // 1일 (내보내기용이므로 짧게)

async function convertPathsToSignedUrls(
  supabase: SupabaseClient,
  photoUrls: string[] | null
): Promise<string[]> {
  if (!photoUrls || photoUrls.length === 0) return []
  const results: string[] = []
  for (const pathOrUrl of photoUrls) {
    if (pathOrUrl.startsWith('http')) {
      results.push(pathOrUrl)
      continue
    }
    const { data: signedUrl, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(pathOrUrl, SIGNED_URL_EXPIRY)
    if (error || !signedUrl) {
      results.push(pathOrUrl)
    } else {
      results.push(signedUrl.signedUrl)
    }
  }
  return results
}

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const exportType = request.nextUrl.searchParams.get('type') || 'excel'

    let usageCheck
    if (exportType === 'photo') {
      usageCheck = await checkWeeklyUsageLimit(user.id, 'daily_log_photo_export')
    } else {
      usageCheck = await checkUsageLimit(user.id, 'daily_log_excel_export')
    }

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
    const { year, month, pet_id, export_type = 'excel' } = body as {
      year: number
      month: number // 0-indexed
      pet_id?: string
      export_type?: 'excel' | 'photo'
    }

    if (year == null || month == null) {
      return NextResponse.json(
        { error: 'year와 month는 필수입니다' },
        { status: 400 }
      )
    }

    // 사용 제한 체크 (export_type에 따라 분기)
    let usageCheck
    if (export_type === 'photo') {
      usageCheck = await checkWeeklyUsageLimit(user.id, 'daily_log_photo_export')
    } else {
      usageCheck = await checkUsageLimit(user.id, 'daily_log_excel_export')
    }
    if (!usageCheck.allowed) {
      const periodMsg = export_type === 'photo' ? '이번 주' : '오늘'
      return NextResponse.json({
        error: 'TIER_LIMIT_EXCEEDED',
        message: `${periodMsg} 내보내기 횟수를 모두 사용했습니다.`,
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

    const logs = data || []

    // photo export일 때만 signed URL 변환
    if (export_type === 'photo') {
      for (const log of logs) {
        if (log.photo_urls && log.photo_urls.length > 0) {
          log.photo_urls = await convertPathsToSignedUrls(supabase, log.photo_urls)
        }
      }
    }

    // 사용량 기록
    const usageAction = export_type === 'photo' ? 'daily_log_photo_export' : 'daily_log_excel_export'
    await logUsage(user.id, usageAction, 1, {
      year,
      month,
      pet_id: pet_id || null,
      record_count: logs.length,
      export_type,
    })

    const newUsed = usageCheck.used + 1
    const newRemaining = usageCheck.limit === -1 ? -1 : Math.max(0, usageCheck.limit - newUsed)

    return NextResponse.json({
      success: true,
      data: logs,
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
