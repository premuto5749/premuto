import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: standardItems, error } = await supabase
      .from('standard_items_master')
      .select('*')
      .order('category, name')

    if (error) {
      console.error('Failed to fetch standard items:', error)
      return NextResponse.json(
        { error: 'Failed to fetch standard items' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: standardItems
    })

  } catch (error) {
    console.error('Standard Items API error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { name, display_name_ko, category, default_unit, description, exam_type, organ_tags } = body

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
      return NextResponse.json({
        success: true,
        data: existing,
        message: 'Item already exists'
      })
    }

    // 새 항목 생성
    const { data: newItem, error } = await supabase
      .from('standard_items_master')
      .insert({
        name,
        display_name_ko: display_name_ko || name,
        category: category || exam_type || 'Unmapped',
        default_unit,
        description,
        exam_type: exam_type || category || 'Unmapped',
        organ_tags: organ_tags || []
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create standard item:', error)
      return NextResponse.json(
        { error: 'Failed to create standard item' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: newItem
    })

  } catch (error) {
    console.error('Standard Items POST error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
