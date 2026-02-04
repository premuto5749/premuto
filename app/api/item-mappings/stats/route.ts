import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    // 통계 계산
    const stats: Record<string, number> = {}
    mappings?.forEach(mapping => {
      if (mapping.standard_item_id) {
        stats[mapping.standard_item_id] = (stats[mapping.standard_item_id] || 0) + 1
      }
    })

    return NextResponse.json({
      success: true,
      data: stats
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
