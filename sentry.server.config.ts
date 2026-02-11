import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: 0.1,

  beforeSend(event) {
    const message = event.exception?.values?.[0]?.value || ''

    // Supabase JWT/토큰 만료 에러 필터링
    if (message.includes('JWT expired') || message.includes('refresh_token_not_found')) return null

    return event
  },
})
