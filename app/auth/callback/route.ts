import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
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
      // exchangeCodeForSession 후 요청 쿠키에 세션이 없어 getUser()가 실패하므로
      // Service Role의 admin API로 identities를 조회
      if (user) {
        try {
          const serviceClient = createServiceClient()
          const { data: { user: fullUser } } = await serviceClient.auth.admin.getUserById(user.id)
          const kakaoIdentity = fullUser?.identities?.find(i => i.provider === 'kakao')

          if (kakaoIdentity?.identity_data) {
            const identityData = kakaoIdentity.identity_data as Record<string, string>

            // 기존 프로필 조회 (Service Role로 RLS 우회)
            const { data: profile } = await serviceClient
              .from('user_profiles')
              .select('nickname, terms_accepted_at, profile_image')
              .eq('user_id', user.id)
              .single()

            const updateData: Record<string, string> = {}

            // 전화번호: provider_token으로 카카오 API 직접 호출
            const providerToken = data.session?.provider_token
            if (providerToken) {
              try {
                const kakaoRes = await fetch('https://kapi.kakao.com/v2/user/me', {
                  headers: { Authorization: `Bearer ${providerToken}` },
                })
                if (kakaoRes.ok) {
                  const kakaoUser = await kakaoRes.json()
                  console.log('[Kakao API] kakao_account:', JSON.stringify(kakaoUser.kakao_account, null, 2))
                  const phoneNumber = kakaoUser.kakao_account?.phone_number
                  if (phoneNumber) updateData.phone = phoneNumber
                }
              } catch (e) {
                console.error('[Kakao API] Failed to fetch phone:', e)
              }
            }
            // 닉네임이 아직 없을 때만 카카오 닉네임 사용 (사용자 수정 보호)
            if (!profile?.nickname && identityData.name) {
              updateData.nickname = identityData.name
            }
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
              if (profile) {
                await serviceClient
                  .from('user_profiles')
                  .update(updateData)
                  .eq('user_id', user.id)
              } else {
                // 신규 사용자: 프로필 행이 없으면 생성
                await serviceClient
                  .from('user_profiles')
                  .insert({ user_id: user.id, tier: 'free', ...updateData })
              }
            }
          }
        } catch (e) {
          console.error('Failed to save kakao profile:', e)
        }
      }

      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  // 오류 발생 시 로그인 페이지로
  return NextResponse.redirect(new URL('/login', request.url))
}
