import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * PATCH /api/standard-items/[id]
 * 표준 항목 업데이트
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    const {
      name, display_name_ko, default_unit, exam_type, organ_tags, category,
      description_common, description_high, description_low
    } = body

    // 업데이트할 필드만 추출
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (display_name_ko !== undefined) updateData.display_name_ko = display_name_ko
    if (default_unit !== undefined) updateData.default_unit = default_unit
    if (exam_type !== undefined) {
      updateData.exam_type = exam_type
      updateData.category = exam_type // category도 동기화
    }
    if (category !== undefined && exam_type === undefined) {
      updateData.category = category
    }
    if (organ_tags !== undefined) updateData.organ_tags = organ_tags
    // 설명 필드
    if (description_common !== undefined) updateData.description_common = description_common
    if (description_high !== undefined) updateData.description_high = description_high
    if (description_low !== undefined) updateData.description_low = description_low

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('standard_items_master')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Failed to update standard item:', error)
      return NextResponse.json(
        { error: 'Failed to update standard item' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })

  } catch (error) {
    console.error('Standard Items PATCH error:', error)
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
 * GET /api/standard-items/[id]
 * 특정 표준 항목 조회
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('standard_items_master')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Failed to fetch standard item:', error)
      return NextResponse.json(
        { error: 'Standard item not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })

  } catch (error) {
    console.error('Standard Items GET error:', error)
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
 * DELETE /api/standard-items/[id]
 * 표준 항목 삭제
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // 해당 항목을 참조하는 test_results가 있는지 확인
    const { count } = await supabase
      .from('test_results')
      .select('*', { count: 'exact', head: true })
      .eq('standard_item_id', id)

    if (count && count > 0) {
      return NextResponse.json(
        { error: `이 항목을 참조하는 검사 결과가 ${count}개 있습니다. 먼저 결과를 삭제하거나 다른 항목으로 재매핑해주세요.` },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('standard_items_master')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Failed to delete standard item:', error)
      return NextResponse.json(
        { error: 'Failed to delete standard item' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true
    })

  } catch (error) {
    console.error('Standard Items DELETE error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
