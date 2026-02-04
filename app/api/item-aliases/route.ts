import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/item-aliases
 * 모든 항목 별칭 조회 (사용자 오버라이드 병합)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const masterOnly = searchParams.get('master') === 'true'

    // 현재 사용자 확인
    const { data: { user } } = await supabase.auth.getUser()

    // master=true 파라미터가 있으면 마스터 테이블만 반환
    if (masterOnly) {
      const { data, error } = await supabase
        .from('item_aliases_master')
        .select('id, alias, canonical_name, source_hint, standard_item_id')
        .order('alias')

      if (error) {
        console.error('Failed to fetch item aliases:', error)
        return NextResponse.json(
          { error: 'Failed to fetch item aliases' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        data: data || []
      })
    }

    // 사용자가 있으면 오버라이드 병합 데이터 반환
    if (user) {
      const { data: mergedAliases, error } = await supabase
        .rpc('get_user_item_aliases', { p_user_id: user.id })

      if (error) {
        console.error('Failed to fetch merged item aliases:', error)
        // 함수 호출 실패 시 마스터 테이블로 폴백
        const { data: fallbackData } = await supabase
          .from('item_aliases_master')
          .select('id, alias, canonical_name, source_hint, standard_item_id')
          .order('alias')

        return NextResponse.json({
          success: true,
          data: fallbackData || []
        })
      }

      return NextResponse.json({
        success: true,
        data: mergedAliases || []
      })
    }

    // 비로그인 시 마스터 테이블 반환
    const { data, error } = await supabase
      .from('item_aliases_master')
      .select('id, alias, canonical_name, source_hint, standard_item_id')
      .order('alias')

    if (error) {
      console.error('Failed to fetch item aliases:', error)
      return NextResponse.json(
        { error: 'Failed to fetch item aliases' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data || []
    })

  } catch (error) {
    console.error('Item Aliases GET error:', error)
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
 * POST /api/item-aliases
 * 새 별칭 등록 (사용자 커스텀 별칭)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { alias, canonical_name, source_hint, standard_item_id } = body

    if (!alias || !canonical_name) {
      return NextResponse.json(
        { error: 'alias and canonical_name are required' },
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

    // standard_item_id가 없으면 canonical_name으로 조회
    let itemId = standard_item_id
    if (!itemId) {
      const { data: item } = await supabase
        .from('standard_items_master')
        .select('id')
        .ilike('name', canonical_name)
        .single()

      if (!item) {
        return NextResponse.json(
          { error: `Standard item '${canonical_name}' not found` },
          { status: 404 }
        )
      }
      itemId = item.id
    }

    // 사용자 커스텀 별칭으로 저장 (master_alias_id = null)
    const { data, error } = await supabase
      .from('user_item_aliases')
      .upsert({
        user_id: user.id,
        master_alias_id: null,
        alias,
        canonical_name,
        source_hint: source_hint || null,
        standard_item_id: itemId
      }, {
        onConflict: 'user_id,alias'
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create user item alias:', error)
      return NextResponse.json(
        { error: 'Failed to create item alias' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { ...data, is_custom: true }
    })

  } catch (error) {
    console.error('Item Aliases POST error:', error)
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
 * DELETE /api/item-aliases
 * 별칭 삭제 (사용자 커스텀 별칭만 삭제 가능)
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
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

    // 사용자 커스텀 별칭에서 삭제 시도
    const { error } = await supabase
      .from('user_item_aliases')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Failed to delete user item alias:', error)
      return NextResponse.json(
        { error: 'Failed to delete item alias' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true
    })

  } catch (error) {
    console.error('Item Aliases DELETE error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
