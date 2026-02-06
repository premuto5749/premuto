import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/user/reset-master-data
 * 사용자의 마스터 데이터 오버라이드를 초기화 (마스터 기본값으로 리셋)
 */
export async function POST() {
  try {
    const supabase = await createClient()

    // 현재 사용자 확인
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // reset_user_master_data 함수 호출
    const { error } = await supabase
      .rpc('reset_user_master_data', { p_user_id: user.id })

    if (error) {
      console.error('Failed to reset user master data:', error)
      return NextResponse.json(
        { error: 'Failed to reset master data' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Master data has been reset to default'
    })

  } catch (error) {
    console.error('Reset Master Data API error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/user/reset-master-data
 * 사용자의 커스텀/오버라이드 데이터 통계 조회
 */
export async function GET() {
  try {
    const supabase = await createClient()

    // 현재 사용자 확인
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // 사용자별 데이터 통계 조회
    const [
      { count: customItemsCount },
      { count: customAliasesCount },
      { count: customMappingsCount }
    ] = await Promise.all([
      supabase
        .from('user_standard_items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabase
        .from('user_item_aliases')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabase
        .from('user_item_mappings')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
    ])

    return NextResponse.json({
      success: true,
      data: {
        customItems: customItemsCount || 0,
        customAliases: customAliasesCount || 0,
        customMappings: customMappingsCount || 0,
        hasCustomData: (customItemsCount || 0) + (customAliasesCount || 0) + (customMappingsCount || 0) > 0
      }
    })

  } catch (error) {
    console.error('Get User Data Stats API error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
