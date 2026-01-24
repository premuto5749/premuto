import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: hospitals, error } = await supabase
      .from('hospitals')
      .select('*')
      .order('name')

    if (error) {
      console.error('Failed to fetch hospitals:', error)
      return NextResponse.json(
        { error: 'Failed to fetch hospitals' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: hospitals
    })

  } catch (error) {
    console.error('Hospitals API error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { name, address, phone, website, notes } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Hospital name is required' },
        { status: 400 }
      )
    }

    // 중복 체크
    const { data: existing } = await supabase
      .from('hospitals')
      .select('id, name')
      .eq('name', name)
      .single()

    if (existing) {
      return NextResponse.json({
        success: true,
        data: existing,
        message: 'Hospital already exists'
      })
    }

    // 새 병원 생성
    const { data: newHospital, error } = await supabase
      .from('hospitals')
      .insert({
        name,
        address,
        phone,
        website,
        notes
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create hospital:', error)
      return NextResponse.json(
        { error: 'Failed to create hospital' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: newHospital
    })

  } catch (error) {
    console.error('Hospitals POST error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
