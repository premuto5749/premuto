import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const userId = user.id

    // 병렬 조회
    const [petsRes, dailyLogsCountRes, testRecordsCountRes, dailyLogsRes] = await Promise.all([
      supabase.from('pets').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('daily_logs').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('test_records').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('daily_logs').select('logged_at').eq('user_id', userId).order('logged_at', { ascending: false }).limit(3650),
    ])

    const petCount = petsRes.count || 0
    const totalDailyLogs = dailyLogsCountRes.count || 0
    const totalTestRecords = testRecordsCountRes.count || 0

    // streak 및 마지막 기록일 계산
    let streak = 0
    let lastRecordDate: string | null = null

    // logged_at에서 KST 기준 고유 날짜 추출
    const logDates: string[] = []
    if (dailyLogsRes.data) {
      const dateSet = new Set<string>()
      for (const row of dailyLogsRes.data) {
        const kst = new Date(new Date(row.logged_at).getTime() + 9 * 60 * 60 * 1000)
        dateSet.add(kst.toISOString().split('T')[0])
      }
      logDates.push(...Array.from(dateSet).sort().reverse())
    }

    if (logDates.length > 0) {
      lastRecordDate = logDates[0]

      // streak 계산: 오늘(KST)부터 연속된 날짜 수
      const now = new Date()
      const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000)
      const todayStr = kstNow.toISOString().split('T')[0]

      // 오늘 또는 어제부터 시작
      let checkDate = todayStr
      if (logDates[0] !== todayStr) {
        const yesterday = new Date(kstNow)
        yesterday.setUTCDate(yesterday.getUTCDate() - 1)
        checkDate = yesterday.toISOString().split('T')[0]
      }

      const dateSet = new Set(logDates)
      const current = new Date(checkDate + 'T00:00:00Z')

      while (dateSet.has(current.toISOString().split('T')[0])) {
        streak++
        current.setUTCDate(current.getUTCDate() - 1)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        createdAt: user.created_at,
        petCount,
        totalDailyLogs,
        totalTestRecords,
        streak,
        lastRecordDate,
      },
    })
  } catch (error) {
    console.error('Account stats API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
