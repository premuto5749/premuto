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

      // 카카오 OAuth 로그인 시 프로필 정보를 user_profiles에 저장
      if (user) {
        const kakaoIdentity = user.identities?.find(i => i.provider === 'kakao')
        if (kakaoIdentity?.identity_data) {
          const identityData = kakaoIdentity.identity_data as Record<string, string>
          try {
            // 기존 프로필 조회 (terms_accepted_at 존재 여부 확인)
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('terms_accepted_at, profile_image')
              .eq('user_id', user.id)
              .single()

            const updateData: Record<string, string> = {}

            if (identityData.phone_number) updateData.phone = identityData.phone_number
            if (identityData.name) updateData.nickname = identityData.name
            // 사용자가 직접 업로드한 이미지(Storage path)가 없을 때만 카카오 이미지 사용
            if (!profile?.profile_image || profile.profile_image.startsWith('http')) {
              if (identityData.avatar_url || identityData.picture) {
                updateData.profile_image = identityData.avatar_url || identityData.picture
              }
            }
            // 약관 동의 시점이 없으면 현재 시각으로 기록
            if (!profile?.terms_accepted_at) {
              updateData.terms_accepted_at = new Date().toISOString()
            }

            if (Object.keys(updateData).length > 0) {
              await supabase
                .from('user_profiles')
                .update(updateData)
                .eq('user_id', user.id)
            }
          } catch (e) {
            console.error('Failed to save kakao profile:', e)
          }
        }
      }

      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  // 오류 발생 시 로그인 페이지로
  return NextResponse.redirect(new URL('/login', request.url))
}
