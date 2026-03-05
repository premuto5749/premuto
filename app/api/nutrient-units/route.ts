import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/with-auth'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async (request, { supabase }) => {
  try {
    const { data, error } = await supabase
      .from('nutrient_units')
      .select('*')
      .order('sort_order')

    if (error) {
      console.error('Failed to fetch nutrient units:', error)
      return NextResponse.json(
        { error: 'Failed to fetch nutrient units' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data || []
    })
  } catch (error) {
    console.error('Nutrient Units GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
