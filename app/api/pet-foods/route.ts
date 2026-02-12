import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/pet-foods
 * 사료 목록 조회 (인증 사용자)
 */
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error: dbError } = await supabase
      .from('pet_foods')
      .select('*')
      .order('brand, name')

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
}
