import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * PATCH /api/standard-items/[id]
 * 표준 항목 업데이트 (사용자별 오버라이드)
 * - 마스터 항목 수정 시: user_standard_items에 오버라이드 생성
 * - 커스텀 항목 수정 시: user_standard_items에서 직접 업데이트
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    // 현재 사용자 확인
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

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

    // 1. 먼저 이 ID가 마스터 항목인지 사용자 커스텀 항목인지 확인
    const { data: masterItem } = await supabase
      .from('standard_items_master')
      .select('id')
      .eq('id', id)
      .single()

    if (masterItem) {
      // 마스터 항목 → user_standard_items에 오버라이드 생성/업데이트
      const { data: existingOverride } = await supabase
        .from('user_standard_items')
        .select('id')
        .eq('user_id', user.id)
        .eq('master_item_id', id)
        .single()

      if (existingOverride) {
        // 기존 오버라이드 업데이트
        const { data, error } = await supabase
          .from('user_standard_items')
          .update(updateData)
          .eq('id', existingOverride.id)
          .select()
          .single()

        if (error) {
          console.error('Failed to update user override:', error)
          return NextResponse.json(
            { error: 'Failed to update item' },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          data,
          type: 'override_updated'
        })
      } else {
        // 새 오버라이드 생성
        const { data, error } = await supabase
          .from('user_standard_items')
          .insert({
            user_id: user.id,
            master_item_id: id,
            ...updateData
          })
          .select()
          .single()

        if (error) {
          console.error('Failed to create user override:', error)
          return NextResponse.json(
            { error: 'Failed to create override' },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          data,
          type: 'override_created'
        })
      }
    } else {
      // 사용자 커스텀 항목인지 확인
      const { data: customItem, error: customError } = await supabase
        .from('user_standard_items')
        .select('id')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      if (customError || !customItem) {
        return NextResponse.json(
          { error: 'Item not found' },
          { status: 404 }
        )
      }

      // 커스텀 항목 직접 업데이트
      const { data, error } = await supabase
        .from('user_standard_items')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Failed to update custom item:', error)
        return NextResponse.json(
          { error: 'Failed to update item' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        data,
        type: 'custom_updated'
      })
    }

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
 * 특정 표준 항목 조회 (사용자 오버라이드 병합)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // 현재 사용자 확인
    const { data: { user } } = await supabase.auth.getUser()

    // 먼저 마스터 항목 조회
    const { data: masterItem } = await supabase
      .from('standard_items_master')
      .select('*')
      .eq('id', id)
      .single()

    if (masterItem) {
      // 사용자 오버라이드가 있으면 병합
      if (user) {
        const { data: override } = await supabase
          .from('user_standard_items')
          .select('*')
          .eq('user_id', user.id)
          .eq('master_item_id', id)
          .single()

        if (override) {
          // 오버라이드 필드 병합
          const mergedData = {
            ...masterItem,
            name: override.name ?? masterItem.name,
            display_name_ko: override.display_name_ko ?? masterItem.display_name_ko,
            default_unit: override.default_unit ?? masterItem.default_unit,
            exam_type: override.exam_type ?? masterItem.exam_type,
            category: override.category ?? masterItem.category,
            organ_tags: override.organ_tags ?? masterItem.organ_tags,
            description_common: override.description_common ?? masterItem.description_common,
            description_high: override.description_high ?? masterItem.description_high,
            description_low: override.description_low ?? masterItem.description_low,
            is_modified: true
          }

          return NextResponse.json({
            success: true,
            data: mergedData
          })
        }
      }

      return NextResponse.json({
        success: true,
        data: { ...masterItem, is_modified: false }
      })
    }

    // 마스터에 없으면 사용자 커스텀 항목 조회
    if (user) {
      const { data: customItem, error } = await supabase
        .from('user_standard_items')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      if (!error && customItem) {
        return NextResponse.json({
          success: true,
          data: { ...customItem, is_custom: true }
        })
      }
    }

    return NextResponse.json(
      { error: 'Standard item not found' },
      { status: 404 }
    )

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
 * 표준 항목 삭제 (사용자 오버라이드/커스텀만 삭제 가능)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // 현재 사용자 확인
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 마스터 항목인지 확인
    const { data: masterItem } = await supabase
      .from('standard_items_master')
      .select('id')
      .eq('id', id)
      .single()

    if (masterItem) {
      // 마스터 항목은 삭제 불가, 오버라이드만 삭제
      const { error } = await supabase
        .from('user_standard_items')
        .delete()
        .eq('user_id', user.id)
        .eq('master_item_id', id)

      if (error) {
        console.error('Failed to delete user override:', error)
        return NextResponse.json(
          { error: 'Failed to delete override' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Override deleted, item reset to master defaults'
      })
    }

    // 사용자 커스텀 항목 삭제
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
      .from('user_standard_items')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Failed to delete custom item:', error)
      return NextResponse.json(
        { error: 'Failed to delete item' },
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
