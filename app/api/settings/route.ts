import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
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

// 계정 삭제 (auth.users 삭제 → CASCADE로 모든 관련 데이터 자동 삭제)
export async function DELETE() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Storage에서 사용자 파일 삭제
    const { data: files } = await supabase.storage
      .from('uploads')
      .list(user.id)
    if (files && files.length > 0) {
      const filePaths = files.map(f => `${user.id}/${f.name}`)
      await supabase.storage.from('uploads').remove(filePaths)
    }

    // auth.users 삭제 (service role 필요) → CASCADE로 모든 테이블 데이터 자동 삭제
    const serviceClient = createServiceClient()
    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(user.id)

    if (deleteError) {
      console.error('Failed to delete auth user:', deleteError)
      return NextResponse.json(
        { error: '계정 삭제에 실패했습니다. 다시 시도해주세요.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Account and all user data deleted successfully'
    })

  } catch (error) {
    console.error('Settings DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
