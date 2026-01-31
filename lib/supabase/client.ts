import { createBrowserClient } from '@supabase/ssr'

// 7일을 초 단위로 (7 * 24 * 60 * 60)
const COOKIE_MAX_AGE = 604800

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        maxAge: COOKIE_MAX_AGE,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
    }
  )
}
