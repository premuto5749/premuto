import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  // 로그인되지 않은 경우 로그인 페이지로
  if (!session) {
    redirect('/login')
  }

  // 로그인된 경우 일일 기록 페이지로 리다이렉트
  redirect('/daily-log')
}
