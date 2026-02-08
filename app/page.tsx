import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LoginPage from './login/page'

export default async function Home() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  // 로그인되지 않은 경우 로그인 페이지를 직접 렌더링
  // (redirect 대신 렌더링하여 Google OAuth 브랜딩 인증 시 홈페이지에서 개인정보처리방침 링크를 찾을 수 있도록)
  if (!session) {
    return <LoginPage />
  }

  // 반려동물 등록 여부 확인
  const { count } = await supabase
    .from('pets')
    .select('*', { count: 'exact', head: true })

  // 반려동물이 없으면 설정 페이지(반려동물 탭)로 리다이렉트
  if (count === 0) {
    redirect('/settings?tab=pet&onboarding=true')
  }

  // 반려동물이 있으면 일일 기록 페이지로 리다이렉트
  redirect('/daily-log')
}
