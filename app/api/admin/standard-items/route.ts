import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/standard-items
 * 마스터 표준항목 목록 조회 (관리자 전용)
 */
export async function GET() {
  try {
    const { authorized, error } = await requireAdmin()
    if (!authorized) {
      return NextResponse.json({ error }, { status: 403 })
    }

    const supabase = await createClient()

    const { data, error: dbError } = await supabase
      .from('standard_items_master')
      .select('*')
      .order('exam_type, name')

    if (dbError) {
      return NextResponse.json(
        { error: 'Failed to fetch standard items' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error) {
    console.error('Admin Standard Items GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/standard-items
 * 마스터 표준항목 추가 (관리자 전용)
 */
export async function POST(request: NextRequest) {
  try {
    const { authorized, error } = await requireAdmin()
    if (!authorized) {
      return NextResponse.json({ error }, { status: 403 })
    }

    const supabase = await createClient()
    const body = await request.json()

    const {
      name,
      display_name_ko,
      default_unit,
      category,
      exam_type,
      organ_tags,
      description_common,
      description_high,
      description_low
    } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    // 중복 체크
    const { data: existing } = await supabase
      .from('standard_items_master')
      .select('id')
      .eq('name', name)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Item already exists' },
        { status: 409 }
      )
    }

    const { data, error: dbError } = await supabase
      .from('standard_items_master')
      .insert({
        name,
        display_name_ko: display_name_ko || name,
        default_unit,
        category: category || exam_type || 'Unmapped',
        exam_type: exam_type || category || 'Unmapped',
        organ_tags: organ_tags || [],
        description_common,
        description_high,
        description_low
      })
      .select()
      .single()

    if (dbError) {
      console.error('Failed to create master item:', dbError)
      return NextResponse.json(
        { error: 'Failed to create standard item' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error) {
    console.error('Admin Standard Items POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
