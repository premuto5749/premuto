import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  // 로그인되지 않은 경우 로그인 페이지로
  if (!session) {
    redirect('/login')
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
