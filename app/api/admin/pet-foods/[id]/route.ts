import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/admin/pet-foods/[id]
 * 사료 수정 (관리자 전용)
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
    const supabase = createServiceClient()
    const body = await request.json()

    const updateData: Record<string, unknown> = {}

    const allowedFields = ['name', 'brand', 'calorie_density', 'food_type', 'target_animal', 'memo']

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'name' && typeof body[field] === 'string') {
          updateData[field] = body[field].trim()
        } else if (field === 'brand' && typeof body[field] === 'string') {
          updateData[field] = body[field].trim() || null
        } else if (field === 'memo' && typeof body[field] === 'string') {
          updateData[field] = body[field].trim() || null
        } else {
          updateData[field] = body[field]
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    const { data, error: dbError } = await supabase
      .from('pet_foods')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (dbError) {
      console.error('Failed to update pet food:', dbError)
      return NextResponse.json(
        { error: 'Failed to update pet food' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error) {
    console.error('Admin Pet Foods PATCH error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/pet-foods/[id]
 * 사료 삭제 (관리자 전용)
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
    const supabase = createServiceClient()

    const { error: dbError } = await supabase
      .from('pet_foods')
      .delete()
      .eq('id', id)

    if (dbError) {
      console.error('Failed to delete pet food:', dbError)
      return NextResponse.json(
        { error: 'Failed to delete pet food' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true
    })
  } catch (error) {
    console.error('Admin Pet Foods DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
