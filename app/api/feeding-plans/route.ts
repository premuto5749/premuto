import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateRER } from '@/lib/calorie'
import type { FeedingPlanFood } from '@/types'

export const dynamic = 'force-dynamic'

// PGRST205 = table not found in schema cache (마이그레이션 미적용)
function isTableNotFound(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST205'
}

// 활동 계수 계산 (lib/calorie.ts의 getActivityFactor와 동일 로직)
function getActivityFactorFromParams(isNeutered: boolean, activityLevel: string): number {
  let baseFactor = isNeutered ? 1.2 : 1.4
  switch (activityLevel) {
    case 'low': baseFactor *= 0.85; break
    case 'high': baseFactor *= 1.2; break
  }
  return baseFactor
}

/**
 * GET /api/feeding-plans
 * ?pet_id=UUID&date=YYYY-MM-DD → carry-forward (plan_date <= date, 최신 1건)
 * ?pet_id=UUID&history=true → 전체 기록 (plan_date DESC)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const petId = searchParams.get('pet_id')
    const date = searchParams.get('date')
    const history = searchParams.get('history')

    if (!petId) {
      return NextResponse.json({ error: 'pet_id is required' }, { status: 400 })
    }

    if (history === 'true') {
      // 전체 기록
      const { data, error } = await supabase
        .from('feeding_plans')
        .select('*')
        .eq('pet_id', petId)
        .eq('user_id', user.id)
        .order('plan_date', { ascending: false })
        .limit(50)

      if (error) {
        if (isTableNotFound(error)) {
          return NextResponse.json({ success: true, data: [] })
        }
        console.error('Failed to fetch feeding plans:', error)
        return NextResponse.json({ error: 'Failed to fetch feeding plans' }, { status: 500 })
      }

      return NextResponse.json({ success: true, data: data || [] })
    }

    // Carry-forward: plan_date <= target_date, 최신 1건
    const targetDate = date || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })

    const { data, error } = await supabase
      .from('feeding_plans')
      .select('*')
      .eq('pet_id', petId)
      .eq('user_id', user.id)
      .lte('plan_date', targetDate)
      .order('plan_date', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      if (isTableNotFound(error)) {
        return NextResponse.json({ success: true, data: null })
      }
      // PGRST116 = no rows
      console.error('Failed to fetch feeding plan:', error)
      return NextResponse.json({ error: 'Failed to fetch feeding plan' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: data || null })
  } catch (error) {
    console.error('Feeding Plans GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/feeding-plans
 * UPSERT (pet_id + plan_date unique)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { pet_id, plan_date, weight_kg, is_neutered, activity_level, foods, feeding_frequency } = body

    // Validation
    if (!pet_id || !weight_kg || weight_kg <= 0) {
      return NextResponse.json({ error: 'pet_id and valid weight_kg are required' }, { status: 400 })
    }

    if (!foods || !Array.isArray(foods) || foods.length === 0) {
      return NextResponse.json({ error: 'At least one food is required' }, { status: 400 })
    }

    // 비율 합계 100% 확인
    const totalRatio = (foods as FeedingPlanFood[]).reduce((sum: number, f: FeedingPlanFood) => sum + (f.ratio_percent || 0), 0)
    if (Math.abs(totalRatio - 100) > 0.01) {
      return NextResponse.json({ error: 'Food ratios must sum to 100%' }, { status: 400 })
    }

    // 칼로리 계산
    const rer = Math.round(calculateRER(weight_kg))
    const activityFactor = getActivityFactorFromParams(is_neutered ?? false, activity_level || 'normal')
    const der = Math.round(rer * activityFactor)
    const date = plan_date || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })

    const planData = {
      user_id: user.id,
      pet_id,
      plan_date: date,
      weight_kg,
      is_neutered: is_neutered ?? false,
      activity_level: activity_level || 'normal',
      rer,
      activity_factor: activityFactor,
      der,
      foods,
      feeding_frequency: feeding_frequency || 2,
    }

    // UPSERT (pet_id + plan_date unique)
    const { data, error } = await supabase
      .from('feeding_plans')
      .upsert(planData, { onConflict: 'pet_id,plan_date' })
      .select()
      .single()

    if (error) {
      if (isTableNotFound(error)) {
        return NextResponse.json(
          { error: 'feeding_plans 테이블이 없습니다. 마이그레이션 033_feeding_plans.sql을 적용해주세요.' },
          { status: 503 }
        )
      }
      console.error('Failed to save feeding plan:', error)
      return NextResponse.json({ error: 'Failed to save feeding plan' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Feeding Plans POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/feeding-plans?id=UUID
 */
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
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('feeding_plans')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      if (isTableNotFound(error)) {
        return NextResponse.json(
          { error: 'feeding_plans 테이블이 없습니다. 마이그레이션 033_feeding_plans.sql을 적용해주세요.' },
          { status: 503 }
        )
      }
      console.error('Failed to delete feeding plan:', error)
      return NextResponse.json({ error: 'Failed to delete feeding plan' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Feeding Plans DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
