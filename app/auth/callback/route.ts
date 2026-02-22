import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // 비밀번호 재설정 플로우 감지:
      // Supabase PKCE 리다이렉트 시 next 파라미터가 유실될 수 있으므로
      // recovery_sent_at 타임스탬프로 비밀번호 재설정 플로우를 판별
      const user = data?.user
      if (user?.recovery_sent_at) {
        const recoverySentAt = new Date(user.recovery_sent_at)
        const minutesSinceRecovery = (Date.now() - recoverySentAt.getTime()) / (1000 * 60)

        if (minutesSinceRecovery < 60) {
          return NextResponse.redirect(new URL('/reset-password', request.url))
        }
      }

      // OAuth 가입 시 약관 동의 시점 기록 (쿠키에서 읽어 user_metadata에 저장)
      const termsAcceptedAt = request.cookies.get('terms_accepted_at')?.value
      if (termsAcceptedAt && !user?.user_metadata?.terms_accepted_at) {
        await supabase.auth.updateUser({
          data: { terms_accepted_at: termsAcceptedAt }
        })
      }

      const response = NextResponse.redirect(new URL(next, request.url))

      // 약관 동의 쿠키 삭제
      if (termsAcceptedAt) {
        response.cookies.delete('terms_accepted_at')
      }

      return response
    }
  }

  // 오류 발생 시 로그인 페이지로
  return NextResponse.redirect(new URL('/login', request.url))
}
