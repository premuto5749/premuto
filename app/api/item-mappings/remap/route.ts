import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { old_standard_item_id, new_standard_item_id } = body

    if (!old_standard_item_id || !new_standard_item_id) {
      return NextResponse.json(
        { error: 'old_standard_item_id and new_standard_item_id are required' },
        { status: 400 }
      )
    }

    // 1. item_mappings의 모든 old_standard_item_id를 new_standard_item_id로 업데이트
    const { error: updateMappingsError } = await supabase
      .from('item_mappings_master')
      .update({ standard_item_id: new_standard_item_id })
      .eq('standard_item_id', old_standard_item_id)

    if (updateMappingsError) {
      console.error('Failed to update item mappings:', updateMappingsError)
      return NextResponse.json(
        { error: 'Failed to update item mappings' },
        { status: 500 }
      )
    }

    // 2. test_results의 모든 old_standard_item_id를 new_standard_item_id로 업데이트
    const { error: updateResultsError } = await supabase
      .from('test_results')
      .update({ standard_item_id: new_standard_item_id })
      .eq('standard_item_id', old_standard_item_id)

    if (updateResultsError) {
      console.error('Failed to update test results:', updateResultsError)
      return NextResponse.json(
        { error: 'Failed to update test results' },
        { status: 500 }
      )
    }

    // 3. 옵션: old standard_item 삭제 (Unmapped 카테고리인 경우)
    // 이것은 사용자가 원할 경우에만 수행
    // 지금은 삭제하지 않고 그대로 둡니다 (나중에 수동 정리 가능)

    return NextResponse.json({
      success: true,
      message: `Successfully remapped from ${old_standard_item_id} to ${new_standard_item_id}`
    })

  } catch (error) {
    console.error('Item Mappings Remap API error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
