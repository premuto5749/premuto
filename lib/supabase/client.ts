import { createBrowserClient } from '@supabase/ssr'
import { COOKIE_MAX_AGE } from '@/lib/constants'

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
