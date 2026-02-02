import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/item-aliases
 * 모든 항목 별칭 조회
 */
export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('item_aliases')
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
 * 새 별칭 등록
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

    // standard_item_id가 없으면 canonical_name으로 조회
    let itemId = standard_item_id
    if (!itemId) {
      const { data: item } = await supabase
        .from('standard_items')
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

    // 중복 체크 및 업서트
    const { data, error } = await supabase
      .from('item_aliases')
      .upsert({
        alias,
        canonical_name,
        source_hint: source_hint || null,
        standard_item_id: itemId
      }, {
        onConflict: 'alias'
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create item alias:', error)
      return NextResponse.json(
        { error: 'Failed to create item alias' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data
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
 * 별칭 삭제 (query param: id)
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

    const { error } = await supabase
      .from('item_aliases')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Failed to delete item alias:', error)
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
