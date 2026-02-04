import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/admin'

/**
 * GET /api/admin/standard-items/[id]
 * 마스터 표준항목 상세 조회 (관리자 전용)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, error } = await requireAdmin()
    if (!authorized) {
      return NextResponse.json({ error }, { status: 403 })
    }

    const { id } = await params
    const supabase = await createClient()

    const { data, error: dbError } = await supabase
      .from('standard_items_master')
      .select('*')
      .eq('id', id)
      .single()

    if (dbError || !data) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error) {
    console.error('Admin Standard Items GET [id] error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/standard-items/[id]
 * 마스터 표준항목 수정 (관리자 전용)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, error } = await requireAdmin()
    if (!authorized) {
      return NextResponse.json({ error }, { status: 403 })
    }

    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    const updateData: Record<string, unknown> = {}

    // 허용된 필드만 업데이트
    const allowedFields = [
      'name', 'display_name_ko', 'default_unit', 'category',
      'exam_type', 'organ_tags', 'description_common',
      'description_high', 'description_low', 'sort_order'
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    const { data, error: dbError } = await supabase
      .from('standard_items_master')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (dbError) {
      console.error('Failed to update master item:', dbError)
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
    console.error('Admin Standard Items PATCH error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/standard-items/[id]
 * 마스터 표준항목 삭제 (관리자 전용)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, error } = await requireAdmin()
    if (!authorized) {
      return NextResponse.json({ error }, { status: 403 })
    }

    const { id } = await params
    const supabase = await createClient()

    // 연관된 test_results가 있는지 확인
    const { count } = await supabase
      .from('test_results')
      .select('*', { count: 'exact', head: true })
      .eq('standard_item_id', id)

    if (count && count > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete item with existing test results',
          resultCount: count
        },
        { status: 409 }
      )
    }

    // 연관된 별칭 삭제
    await supabase
      .from('item_aliases_master')
      .delete()
      .eq('standard_item_id', id)

    // 항목 삭제
    const { error: dbError } = await supabase
      .from('standard_items_master')
      .delete()
      .eq('id', id)

    if (dbError) {
      console.error('Failed to delete master item:', dbError)
      return NextResponse.json(
        { error: 'Failed to delete standard item' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true
    })
  } catch (error) {
    console.error('Admin Standard Items DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
