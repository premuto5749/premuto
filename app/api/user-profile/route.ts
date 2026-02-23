import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/user-profile
 * 현재 사용자의 프로필 조회 (nickname, phone)
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('nickname, phone, profile_image')
      .eq('user_id', user.id)
      .single()

    if (error) {
      return NextResponse.json({ success: true, data: { nickname: null, phone: null, profile_image: null } })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('user-profile GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/user-profile
 * 닉네임 수정
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const { nickname } = body

    if (!nickname || typeof nickname !== 'string' || nickname.trim().length === 0) {
      return NextResponse.json({ error: '닉네임을 입력해주세요' }, { status: 400 })
    }

    if (nickname.trim().length > 20) {
      return NextResponse.json({ error: '닉네임은 20자 이내로 입력해주세요' }, { status: 400 })
    }

    const { error } = await supabase
      .from('user_profiles')
      .update({ nickname: nickname.trim() })
      .eq('user_id', user.id)

    if (error) {
      console.error('user-profile PATCH error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('user-profile PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
