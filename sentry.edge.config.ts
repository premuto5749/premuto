import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Edge 런타임은 미들웨어 매 요청마다 실행되므로 낮게 설정
  tracesSampleRate: 0.05,
})
