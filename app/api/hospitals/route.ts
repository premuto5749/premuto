import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: hospitals, error } = await supabase
      .from('hospitals')
      .select('*')
      .or(`user_id.eq.${user.id},user_id.is.null`)
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

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, address, phone, website, notes } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Hospital name is required' },
        { status: 400 }
      )
    }

    // 중복 체크 (동일 사용자 내에서만)
    const { data: existing } = await supabase
      .from('hospitals')
      .select('id, name')
      .eq('name', name)
      .eq('user_id', user.id)
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
        address: address || null,
        phone: phone || null,
        website: website || null,
        notes: notes || null,
        user_id: user.id
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
        { error: 'Hospital ID is required' },
        { status: 400 }
      )
    }

    const { data: hospital, error } = await supabase
      .from('hospitals')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Failed to update hospital:', error)
      return NextResponse.json(
        { error: 'Failed to update hospital' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: hospital
    })

  } catch (error) {
    console.error('Hospitals PATCH error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

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
        { error: 'Hospital ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('hospitals')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Failed to delete hospital:', error)
      return NextResponse.json(
        { error: 'Failed to delete hospital' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Hospital deleted successfully'
    })

  } catch (error) {
    console.error('Hospitals DELETE error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
