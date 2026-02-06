import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { MedicinePresetInput } from '@/types'

// 약 프리셋 목록 조회
// ?pet_id=xxx 쿼리 파라미터가 있으면 해당 반려동물용 프리셋 + 전체 공통 프리셋(pet_id=null) 반환
// 쿼리 파라미터가 없으면 모든 프리셋 반환 (설정 페이지용)
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
      .from('medicine_presets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    // pet_id가 전달되면 해당 pet + 전체 공통(pet_id=null) 프리셋만 필터링
    if (petId) {
      query = query.or(`pet_id.is.null,pet_id.eq.${petId}`)
    }

    const { data: presets, error } = await query

    if (error) {
      console.error('Failed to fetch presets:', error)
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
    console.error('Medicine presets GET error:', error)
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

    const body: MedicinePresetInput = await request.json()

    if (!body.preset_name) {
      return NextResponse.json(
        { error: 'Preset name is required' },
        { status: 400 }
      )
    }

    const { data: preset, error } = await supabase
      .from('medicine_presets')
      .insert({
        user_id: user.id,
        pet_id: body.pet_id || null,  // null = 모든 반려동물
        preset_name: body.preset_name,
        medicines: body.medicines || []
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create preset:', error)
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
    console.error('Medicine presets POST error:', error)
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
      .from('medicine_presets')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Failed to update preset:', error)
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
    console.error('Medicine presets PATCH error:', error)
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
      .from('medicine_presets')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Failed to delete preset:', error)
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
    console.error('Medicine presets DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
