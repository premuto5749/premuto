import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: standardItems, error } = await supabase
      .from('standard_items')
      .select('*')
      .order('category, name')

    if (error) {
      console.error('Failed to fetch standard items:', error)
      return NextResponse.json(
        { error: 'Failed to fetch standard items' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: standardItems
    })

  } catch (error) {
    console.error('Standard Items API error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
