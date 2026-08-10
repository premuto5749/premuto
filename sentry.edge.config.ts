// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
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

  // Edge 런타임은 미들웨어 매 요청마다 실행되므로 낮게 설정
  tracesSampleRate: 0.05,
  enableLogs: true,
  sendDefaultPii: true,
})
