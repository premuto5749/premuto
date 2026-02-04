import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const masterOnly = searchParams.get('master') === 'true'

    // 현재 사용자 확인
    const { data: { user } } = await supabase.auth.getUser()

    // master=true 파라미터가 있으면 마스터 테이블만 반환 (관리자용)
    if (masterOnly) {
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
    }

    // 사용자가 있으면 오버라이드 병합 데이터 반환
    if (user) {
      const { data: mergedItems, error } = await supabase
        .rpc('get_user_standard_items', { p_user_id: user.id })

      if (error) {
        console.error('Failed to fetch merged standard items:', error)
        // 함수 호출 실패 시 마스터 테이블로 폴백
        const { data: fallbackItems } = await supabase
          .from('standard_items_master')
          .select('*')
          .order('category, name')

        return NextResponse.json({
          success: true,
          data: fallbackItems
        })
      }

      return NextResponse.json({
        success: true,
        data: mergedItems
      })
    }

    // 비로그인 시 마스터 테이블 반환
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

    const {
      name, display_name_ko, category, default_unit, exam_type, organ_tags,
      description_common, description_high, description_low
    } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    // 현재 사용자 확인
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // 마스터 테이블에서 중복 체크
    const { data: existingMaster } = await supabase
      .from('standard_items_master')
      .select('id')
      .eq('name', name)
      .single()

    if (existingMaster) {
      return NextResponse.json({
        success: true,
        data: existingMaster,
        message: 'Item already exists in master'
      })
    }

    // 사용자 커스텀 항목에서 중복 체크
    const { data: existingUser } = await supabase
      .from('user_standard_items')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', name)
      .is('master_item_id', null)
      .single()

    if (existingUser) {
      return NextResponse.json({
        success: true,
        data: existingUser,
        message: 'Item already exists in your custom items'
      })
    }

    // 새 사용자 커스텀 항목 생성 (master_item_id = null)
    const { data: newItem, error } = await supabase
      .from('user_standard_items')
      .insert({
        user_id: user.id,
        master_item_id: null,
        name,
        display_name_ko: display_name_ko || name,
        category: category || exam_type || 'Unmapped',
        default_unit,
        description_common,
        description_high,
        description_low,
        exam_type: exam_type || category || 'Unmapped',
        organ_tags: organ_tags || []
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create custom standard item:', error)
      return NextResponse.json(
        { error: 'Failed to create custom standard item' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { ...newItem, is_custom: true }
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
