// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // 로컬 개발에서는 기본 비활성화. 개발 중에도 봐야 하면 .env.local 에 NEXT_PUBLIC_SENTRY_DEV=1
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN &&
    (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_SENTRY_DEV === '1'),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,

  integrations: [
    Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
  ],

  tracesSampleRate: 0.1,
  enableLogs: true,
  sendDefaultPii: true,

  beforeSend(event) {
    const message = event.exception?.values?.[0]?.value || ''

    // Supabase JWT/토큰 만료 에러 필터링
    if (message.includes('JWT expired') || message.includes('refresh_token_not_found')) return null

    return event
  },
})
