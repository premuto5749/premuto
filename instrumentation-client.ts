import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // 로컬 개발에서는 기본 비활성화. 개발 중에도 봐야 하면 .env.local 에 NEXT_PUBLIC_SENTRY_DEV=1
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN &&
    (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_SENTRY_DEV === '1'),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,

  integrations: [
    Sentry.replayIntegration(),
    Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
  ],

  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  enableLogs: true,

  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  sendDefaultPii: true,

  beforeSend(event) {
    const message = event.exception?.values?.[0]?.value || ''
    const type = event.exception?.values?.[0]?.type || ''

    // ResizeObserver 노이즈 필터
    if (message.includes('ResizeObserver loop')) return null

    // ChunkLoadError (코드 스플릿 캐시 불일치)
    if (type === 'ChunkLoadError' || message.includes('Loading chunk')) return null

    // 네트워크 에러
    if (message === 'Failed to fetch' || message === 'Load failed' || message === 'NetworkError') return null

    // AbortError (사용자 취소)
    if (type === 'AbortError' || message.includes('The user aborted a request')) return null

    // Supabase 토큰 만료
    if (message.includes('JWT expired') || message.includes('refresh_token_not_found')) return null

    return event
  },

  ignoreErrors: [
    // 브라우저 확장 프로그램
    /extensions\//i,
    /^chrome-extension:\/\//,
    /^moz-extension:\/\//,
  ],
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
