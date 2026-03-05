import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/with-auth'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

/**
 * GET /api/pet-foods
 * 사료 목록 조회 (인증 사용자)
 * ?pet_id=xxx - 특정 반려동물용 필터
 * ?category=xxx - 카테고리 필터
 * ?include_nutrients=true - 영양소 정보 포함
 */
export const GET = withAuth(async (request, { supabase }) => {
  try {
    const { searchParams } = new URL(request.url)
    const petId = searchParams.get('pet_id')
    const category = searchParams.get('category')
    const includeNutrients = searchParams.get('include_nutrients') === 'true'

    const selectQuery = includeNutrients
      ? '*, pet_food_nutrients(*, nutrient_units(symbol))'
      : '*'

    let query = supabase
      .from('pet_foods')
      .select(selectQuery)
      .order('is_active', { ascending: false })
      .order('brand')
      .order('name')

    if (petId) {
      query = query.eq('pet_id', petId)
    }

    if (category) {
      query = query.eq('food_category', category)
    }

    const { data, error: dbError } = await query

    if (dbError) {
      console.error('Failed to fetch pet foods:', dbError)
      return NextResponse.json(
        { error: 'Failed to fetch pet foods' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data || []
    })
  } catch (error) {
    console.error('Pet Foods GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

/**
 * POST /api/pet-foods
 * 새 사료 생성 (영양소 포함 가능)
 */
export const POST = withAuth(async (request, { supabase, user }) => {
  try {
    const body = await request.json()

    if (!body.name) {
      return NextResponse.json(
        { error: 'Food name is required' },
        { status: 400 }
      )
    }

    // Insert pet_food
    const { data: food, error: foodError } = await supabase
      .from('pet_foods')
      .insert({
        user_id: user.id,
        pet_id: body.pet_id || null,
        name: body.name,
        brand: body.brand || null,
        food_category: body.food_category || '건사료',
        calories_per_kg: body.calories_per_kg ?? null,
        serving_size_g: body.serving_size_g ?? null,
        is_active: body.is_active ?? true,
        memo: body.memo || null,
      })
      .select()
      .single()

    if (foodError) {
      console.error('Failed to create pet food:', foodError)
      return NextResponse.json(
        { error: 'Failed to create pet food' },
        { status: 500 }
      )
    }

    // Insert nutrients if provided
    let nutrients = null
    if (body.nutrients && Array.isArray(body.nutrients) && body.nutrients.length > 0) {
      const serviceClient = createServiceClient()

      // Fetch nutrient_units to build symbol -> id map
      const { data: units, error: unitsError } = await serviceClient
        .from('nutrient_units')
        .select('id, symbol')

      if (unitsError) {
        console.error('Failed to fetch nutrient units:', unitsError)
        return NextResponse.json(
          { error: 'Failed to fetch nutrient units' },
          { status: 500 }
        )
      }

      const symbolToId: Record<string, string> = {}
      for (const u of units || []) {
        symbolToId[u.symbol] = u.id
      }

      const nutrientRows = body.nutrients.map((n: {
        nutrient_name: string
        amount: number
        unit_symbol?: string
        unit_id?: string
        per_basis?: string
      }) => ({
        pet_food_id: food.id,
        nutrient_name: n.nutrient_name,
        amount: n.amount,
        unit_id: n.unit_id || (n.unit_symbol ? symbolToId[n.unit_symbol] : null) || null,
        per_basis: n.per_basis || 'per_100g',
      }))

      const { data: insertedNutrients, error: nutrientError } = await supabase
        .from('pet_food_nutrients')
        .insert(nutrientRows)
        .select('*, nutrient_units(symbol)')

      if (nutrientError) {
        console.error('Failed to insert nutrients:', nutrientError)
        // Food was created but nutrients failed - return food with warning
        return NextResponse.json({
          success: true,
          data: { ...food, pet_food_nutrients: [] },
          warning: 'Food created but nutrients failed to save'
        })
      }

      nutrients = insertedNutrients
    }

    return NextResponse.json({
      success: true,
      data: nutrients ? { ...food, pet_food_nutrients: nutrients } : food
    })
  } catch (error) {
    console.error('Pet Foods POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

/**
 * PATCH /api/pet-foods
 * 사료 수정 (영양소 교체 가능)
 */
export const PATCH = withAuth(async (request, { supabase, user }) => {
  try {
    const body = await request.json()
    const { id, nutrients, ...updateFields } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Food ID is required' },
        { status: 400 }
      )
    }

    // Update pet_food fields
    const { data: food, error: foodError } = await supabase
      .from('pet_foods')
      .update({ ...updateFields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (foodError) {
      console.error('Failed to update pet food:', foodError)
      return NextResponse.json(
        { error: 'Failed to update pet food' },
        { status: 500 }
      )
    }

    // Replace nutrients if provided
    let updatedNutrients = null
    if (nutrients && Array.isArray(nutrients)) {
      // Delete existing nutrients
      const { error: deleteError } = await supabase
        .from('pet_food_nutrients')
        .delete()
        .eq('pet_food_id', id)

      if (deleteError) {
        console.error('Failed to delete existing nutrients:', deleteError)
        return NextResponse.json(
          { error: 'Failed to update nutrients' },
          { status: 500 }
        )
      }

      // Insert new nutrients if any
      if (nutrients.length > 0) {
        const serviceClient = createServiceClient()

        const { data: units, error: unitsError } = await serviceClient
          .from('nutrient_units')
          .select('id, symbol')

        if (unitsError) {
          console.error('Failed to fetch nutrient units:', unitsError)
          return NextResponse.json(
            { error: 'Failed to fetch nutrient units' },
            { status: 500 }
          )
        }

        const symbolToId: Record<string, string> = {}
        for (const u of units || []) {
          symbolToId[u.symbol] = u.id
        }

        const nutrientRows = nutrients.map((n: {
          nutrient_name: string
          amount: number
          unit_symbol?: string
          unit_id?: string
          per_basis?: string
        }) => ({
          pet_food_id: id,
          nutrient_name: n.nutrient_name,
          amount: n.amount,
          unit_id: n.unit_id || (n.unit_symbol ? symbolToId[n.unit_symbol] : null) || null,
          per_basis: n.per_basis || 'per_100g',
        }))

        const { data: insertedNutrients, error: nutrientError } = await supabase
          .from('pet_food_nutrients')
          .insert(nutrientRows)
          .select('*, nutrient_units(symbol)')

        if (nutrientError) {
          console.error('Failed to insert nutrients:', nutrientError)
          return NextResponse.json({
            success: true,
            data: { ...food, pet_food_nutrients: [] },
            warning: 'Food updated but nutrients failed to save'
          })
        }

        updatedNutrients = insertedNutrients
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedNutrients !== null
        ? { ...food, pet_food_nutrients: updatedNutrients }
        : food
    })
  } catch (error) {
    console.error('Pet Foods PATCH error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

/**
 * DELETE /api/pet-foods?id=xxx
 * 사료 삭제 (CASCADE로 영양소도 함께 삭제)
 */
export const DELETE = withAuth(async (request, { supabase, user }) => {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Food ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('pet_foods')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Failed to delete pet food:', error)
      return NextResponse.json(
        { error: 'Failed to delete pet food' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Pet food deleted successfully'
    })
  } catch (error) {
    console.error('Pet Foods DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
