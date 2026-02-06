import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()

    // 각 standard_item_id별로 매핑된 raw_name 개수 집계
    const { data: mappings, error } = await supabase
      .from('item_mappings_master')
      .select('standard_item_id')

    if (error) {
      console.error('Failed to fetch item mappings:', error)
      return NextResponse.json(
        { error: 'Failed to fetch item mappings' },
        { status: 500 }
      )
    }

    // 각 standard_item_id별로 test_results 개수 집계
    const { data: results, error: resultsError } = await supabase
      .from('test_results')
      .select('standard_item_id')

    if (resultsError) {
      console.error('Failed to fetch test results:', resultsError)
    }

    // 매핑 통계 계산
    const mappingStats: Record<string, number> = {}
    mappings?.forEach(mapping => {
      if (mapping.standard_item_id) {
        mappingStats[mapping.standard_item_id] = (mappingStats[mapping.standard_item_id] || 0) + 1
      }
    })

    // 검사 결과 통계 계산
    const resultStats: Record<string, number> = {}
    results?.forEach(result => {
      if (result.standard_item_id) {
        resultStats[result.standard_item_id] = (resultStats[result.standard_item_id] || 0) + 1
      }
    })

    return NextResponse.json({
      success: true,
      data: mappingStats,
      resultStats: resultStats
    })

  } catch (error) {
    console.error('Item Mappings Stats API error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
