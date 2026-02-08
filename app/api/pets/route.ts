import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PetInput, Pet } from '@/types'

export const dynamic = 'force-dynamic'

// 반려동물 목록 조회
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: pets, error } = await supabase
      .from('pets')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Failed to fetch pets:', error)
      return NextResponse.json(
        { error: 'Failed to fetch pets' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: pets || []
    })

  } catch (error) {
    console.error('Pets GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 새 반려동물 추가
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: PetInput = await request.json()

    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: 'Pet name is required' },
        { status: 400 }
      )
    }

    // 첫 번째 반려동물이면 기본으로 설정
    const { count } = await supabase
      .from('pets')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    const isFirst = count === 0
    const isDefault = body.is_default ?? isFirst

    // 기본 반려동물로 설정하는 경우 기존 기본 해제
    if (isDefault) {
      await supabase
        .from('pets')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .eq('is_default', true)
    }

    const { data: pet, error } = await supabase
      .from('pets')
      .insert({
        user_id: user.id,
        name: body.name.trim(),
        type: body.type || null,
        breed: body.breed || null,
        birth_date: body.birth_date || null,
        weight_kg: body.weight_kg || null,
        photo_url: body.photo_url || null,
        is_default: isDefault,
        sort_order: (count || 0),
        is_neutered: body.is_neutered ?? false,
        activity_level: body.activity_level || 'normal',
        food_calorie_density: body.food_calorie_density ?? null,
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create pet:', error)
      return NextResponse.json(
        { error: 'Failed to create pet' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: pet
    })

  } catch (error) {
    console.error('Pets POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 반려동물 정보 수정
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: PetInput & { id: string } = await request.json()

    if (!body.id) {
      return NextResponse.json(
        { error: 'Pet ID is required' },
        { status: 400 }
      )
    }

    // 기본 반려동물로 설정하는 경우 기존 기본 해제
    if (body.is_default) {
      await supabase
        .from('pets')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .eq('is_default', true)
        .neq('id', body.id)
    }

    const updateData: Partial<Pet> = {}
    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.type !== undefined) updateData.type = body.type
    if (body.breed !== undefined) updateData.breed = body.breed
    if (body.birth_date !== undefined) updateData.birth_date = body.birth_date
    if (body.weight_kg !== undefined) updateData.weight_kg = body.weight_kg
    if (body.photo_url !== undefined) updateData.photo_url = body.photo_url
    if (body.is_default !== undefined) updateData.is_default = body.is_default
    if (body.is_neutered !== undefined) updateData.is_neutered = body.is_neutered
    if (body.activity_level !== undefined) updateData.activity_level = body.activity_level
    if (body.food_calorie_density !== undefined) updateData.food_calorie_density = body.food_calorie_density

    const { data: pet, error } = await supabase
      .from('pets')
      .update(updateData)
      .eq('id', body.id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Failed to update pet:', error)
      return NextResponse.json(
        { error: 'Failed to update pet' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: pet
    })

  } catch (error) {
    console.error('Pets PATCH error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 반려동물 삭제
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
        { error: 'Pet ID is required' },
        { status: 400 }
      )
    }

    // 삭제할 반려동물이 기본인지 확인
    const { data: petToDelete } = await supabase
      .from('pets')
      .select('is_default')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    const { error } = await supabase
      .from('pets')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Failed to delete pet:', error)
      return NextResponse.json(
        { error: 'Failed to delete pet' },
        { status: 500 }
      )
    }

    // 삭제한 반려동물이 기본이었으면 다른 반려동물을 기본으로 설정
    if (petToDelete?.is_default) {
      const { data: remainingPets } = await supabase
        .from('pets')
        .select('id')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true })
        .limit(1)

      if (remainingPets && remainingPets.length > 0) {
        await supabase
          .from('pets')
          .update({ is_default: true })
          .eq('id', remainingPets[0].id)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Pet deleted successfully'
    })

  } catch (error) {
    console.error('Pets DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
