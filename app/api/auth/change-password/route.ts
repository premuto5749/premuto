import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/with-auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/change-password
 * 비밀번호 변경
 */
export const POST = withAuth(async (request, { supabase, user }) => {
  try {
    if (!user.email) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다' },
        { status: 401 }
      )
    }

    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요' },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: '새 비밀번호는 6자 이상이어야 합니다' },
        { status: 400 }
      )
    }

    // 현재 비밀번호 확인
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })

    if (signInError) {
      return NextResponse.json(
        { success: false, error: '현재 비밀번호가 일치하지 않습니다' },
        { status: 400 }
      )
    }

    // 새 비밀번호로 변경
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (updateError) {
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json(
      { success: false, error: '비밀번호 변경에 실패했습니다' },
      { status: 500 }
    )
  }
})
