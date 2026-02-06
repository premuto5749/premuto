import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Service Role 클라이언트 (RLS 우회)
 * 서버 사이드 admin 전용 - 절대 클라이언트에 노출하지 말 것
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
