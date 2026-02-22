import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { UserSettingsInput } from '@/types'

export const dynamic = 'force-dynamic'

// 사용자 설정 조회
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: settings, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {  // PGRST116 = no rows found
      console.error('Failed to fetch settings:', error)
      return NextResponse.json(
        { error: 'Failed to fetch settings' },
        { status: 500 }
      )
    }

    // 설정이 없으면 기본값 반환
    const defaultSettings = {
      id: null,
      user_id: user.id,
      theme: 'system',
      card_layout: null,
      created_at: null,
      updated_at: null,
    }

    return NextResponse.json({
      success: true,
      data: settings || defaultSettings
    })

  } catch (error) {
    console.error('Settings GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 사용자 설정 생성/수정 (upsert)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: UserSettingsInput = await request.json()

    // upsert로 처리
    const { data: settings, error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        ...body,
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to save settings:', error)
      return NextResponse.json(
        { error: 'Failed to save settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: settings
    })

  } catch (error) {
    console.error('Settings POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 계정 삭제 (모든 사용자 데이터 삭제)
export async function DELETE() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 모든 관련 데이터 삭제 (CASCADE로 자동 삭제되지만 명시적으로 삭제)
    // daily_logs 삭제
    await supabase.from('daily_logs').delete().eq('user_id', user.id)

    // medicine_presets 삭제
    await supabase.from('medicine_presets').delete().eq('user_id', user.id)

    // user_settings 삭제
    await supabase.from('user_settings').delete().eq('user_id', user.id)

    // hospitals 삭제
    await supabase.from('hospitals').delete().eq('user_id', user.id)

    return NextResponse.json({
      success: true,
      message: 'All user data deleted successfully'
    })

  } catch (error) {
    console.error('Settings DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
