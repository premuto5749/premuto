import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: "premuto",
  project: "premuto",

  // 소스맵을 Sentry에 업로드하되 브라우저에서는 숨김
  hideSourceMaps: true,

  // Upload a larger set of source maps for prettier stack traces
  widenClientFileUpload: true,

  // 광고 차단기 우회를 위한 tunnel route
  tunnelRoute: '/monitoring',

  // CI 환경이 아니면 빌드 로그 숨김
  silent: !process.env.CI,

  // 빌드 시 Sentry CLI 텔레메트리 비활성화
  telemetry: false,

  // Vercel Cron Monitors 자동 연동
  automaticVercelMonitors: true,

  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
})
