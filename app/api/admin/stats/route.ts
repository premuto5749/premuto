import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/stats
 * 관리자 대시보드 통계 (관리자 전용)
 */
export async function GET() {
  try {
    const { authorized, error } = await requireAdmin()
    if (!authorized) {
      return NextResponse.json({ error }, { status: 403 })
    }

    const supabase = createServiceClient()

    // 병렬로 통계 조회 (service client로 RLS 우회)
    const [
      { count: standardItemsCount },
      { count: aliasesCount },
      testRecordsResult,
      testResultsResult,
      dailyLogsResult
    ] = await Promise.all([
      supabase.from('standard_items_master').select('*', { count: 'exact', head: true }),
      supabase.from('item_aliases_master').select('*', { count: 'exact', head: true }),
      supabase.from('test_records').select('*', { count: 'exact', head: true }),
      supabase.from('test_results').select('*', { count: 'exact', head: true }),
      supabase.from('daily_logs').select('*', { count: 'exact', head: true })
    ])

    // 고유 사용자 수 (pets 테이블에서 user_id 기준)
    const { data: petsData } = await supabase
      .from('pets')
      .select('user_id')
    const uniqueUserIds = new Set(petsData?.map(r => r.user_id) || [])
    const usersCount = uniqueUserIds.size

    // 사용자별 커스텀 데이터 통계
    const { data: userCustomStats } = await supabase
      .from('user_standard_items')
      .select('user_id')

    const uniqueUsersWithCustomData = new Set(userCustomStats?.map(r => r.user_id) || []).size

    // 검사 유형별 통계
    const { data: examTypeStats } = await supabase
      .from('standard_items_master')
      .select('exam_type')

    const examTypeCounts: Record<string, number> = {}
    examTypeStats?.forEach(item => {
      const type = item.exam_type || 'Other'
      examTypeCounts[type] = (examTypeCounts[type] || 0) + 1
    })

    return NextResponse.json({
      success: true,
      data: {
        masterData: {
          standardItems: standardItemsCount || 0,
          aliases: aliasesCount || 0,
          examTypes: Object.keys(examTypeCounts).length,
          examTypeCounts
        },
        users: {
          total: usersCount || 0,
          withCustomData: uniqueUsersWithCustomData
        },
        records: {
          testRecords: testRecordsResult.count || 0,
          testResults: testResultsResult.count || 0,
          dailyLogs: dailyLogsResult.count || 0
        }
      }
    })
  } catch (error) {
    console.error('Admin Stats GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
