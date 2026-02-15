import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SnackPresetInput } from '@/types'

export const dynamic = 'force-dynamic'

// 간식 프리셋 목록 조회
// ?pet_id=xxx 쿼리 파라미터가 있으면 해당 반려동물용 프리셋 + 전체 공통 프리셋(pet_id=null) 반환
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const petId = searchParams.get('pet_id')

    let query = supabase
      .from('snack_presets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (petId) {
      query = query.or(`pet_id.is.null,pet_id.eq.${petId}`)
    }

    const { data: presets, error } = await query

    if (error) {
      console.error('Failed to fetch snack presets:', error)
      return NextResponse.json(
        { error: 'Failed to fetch presets' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: presets || []
    })

  } catch (error) {
    console.error('Snack presets GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 새 프리셋 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: SnackPresetInput = await request.json()

    if (!body.name) {
      return NextResponse.json(
        { error: 'Snack name is required' },
        { status: 400 }
      )
    }

    const { data: preset, error } = await supabase
      .from('snack_presets')
      .insert({
        user_id: user.id,
        pet_id: body.pet_id || null,
        name: body.name,
        default_amount: body.default_amount ?? null,
        calories_per_unit: body.calories_per_unit ?? null,
        unit: body.unit || 'g',
        memo: body.memo || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create snack preset:', error)
      return NextResponse.json(
        { error: 'Failed to create preset' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: preset
    })

  } catch (error) {
    console.error('Snack presets POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 프리셋 수정
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Preset ID is required' },
        { status: 400 }
      )
    }

    const { data: preset, error } = await supabase
      .from('snack_presets')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Failed to update snack preset:', error)
      return NextResponse.json(
        { error: 'Failed to update preset' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: preset
    })

  } catch (error) {
    console.error('Snack presets PATCH error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 프리셋 삭제
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Preset ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('snack_presets')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Failed to delete snack preset:', error)
      return NextResponse.json(
        { error: 'Failed to delete preset' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Preset deleted successfully'
    })

  } catch (error) {
    console.error('Snack presets DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
