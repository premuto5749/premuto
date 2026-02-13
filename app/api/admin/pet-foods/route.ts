import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/pet-foods
 * 사료 목록 조회 (관리자 전용)
 */
export async function GET() {
  try {
    const { authorized, error } = await requireAdmin()
    if (!authorized) {
      return NextResponse.json({ error }, { status: 403 })
    }

    const supabase = await createClient()

    const { data, error: dbError } = await supabase
      .from('pet_foods')
      .select('*')
      .order('brand, name')

    if (dbError) {
      return NextResponse.json(
        { error: 'Failed to fetch pet foods' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error) {
    console.error('Admin Pet Foods GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/pet-foods
 * 사료 추가 (관리자 전용)
 */
export async function POST(request: NextRequest) {
  try {
    const { authorized, error } = await requireAdmin()
    if (!authorized) {
      return NextResponse.json({ error }, { status: 403 })
    }

    const supabase = createServiceClient()
    const body = await request.json()

    const { name, brand, calorie_density, food_type, target_animal, memo } = body

    if (!name?.trim()) {
      return NextResponse.json(
        { error: '사료명은 필수입니다' },
        { status: 400 }
      )
    }

    if (calorie_density == null || calorie_density <= 0) {
      return NextResponse.json(
        { error: '칼로리 밀도는 0보다 커야 합니다' },
        { status: 400 }
      )
    }

    const { data, error: dbError } = await supabase
      .from('pet_foods')
      .insert({
        name: name.trim(),
        brand: brand?.trim() || null,
        calorie_density,
        food_type: food_type || '건사료',
        target_animal: target_animal || '공통',
        memo: memo?.trim() || null,
      })
      .select()
      .single()

    if (dbError) {
      console.error('Failed to create pet food:', dbError)
      return NextResponse.json(
        { error: 'Failed to create pet food' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error) {
    console.error('Admin Pet Foods POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
