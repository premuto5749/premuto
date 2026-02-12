import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/item-aliases
 * 마스터 별칭 목록 조회 (관리자 전용)
 */
export async function GET() {
  try {
    const { authorized, error } = await requireAdmin()
    if (!authorized) {
      return NextResponse.json({ error }, { status: 403 })
    }

    const supabase = await createClient()

    const { data, error: dbError } = await supabase
      .from('item_aliases_master')
      .select(`
        id,
        alias,
        canonical_name,
        source_hint,
        standard_item_id,
        standard_items_master (
          id,
          name,
          display_name_ko
        )
      `)
      .order('alias')

    if (dbError) {
      return NextResponse.json(
        { error: 'Failed to fetch item aliases' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error) {
    console.error('Admin Item Aliases GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/item-aliases
 * 마스터 별칭 추가 (관리자 전용)
 */
export async function POST(request: NextRequest) {
  try {
    const { authorized, error } = await requireAdmin()
    if (!authorized) {
      return NextResponse.json({ error }, { status: 403 })
    }

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

    const serviceSupabase = createServiceClient()
    const { data, error: dbError } = await serviceSupabase
      .from('item_aliases_master')
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

    if (dbError) {
      console.error('Failed to create master alias:', dbError)
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
    console.error('Admin Item Aliases POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/item-aliases
 * 마스터 별칭 삭제 (관리자 전용)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { authorized, error } = await requireAdmin()
    if (!authorized) {
      return NextResponse.json({ error }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const serviceSupabase = createServiceClient()
    const { error: dbError } = await serviceSupabase
      .from('item_aliases_master')
      .delete()
      .eq('id', id)

    if (dbError) {
      console.error('Failed to delete master alias:', dbError)
      return NextResponse.json(
        { error: 'Failed to delete item alias' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true
    })
  } catch (error) {
    console.error('Admin Item Aliases DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
