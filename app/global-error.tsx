'use client'

import { useEffect, useState } from 'react'
import * as Sentry from '@sentry/nextjs'

const KAKAO_CHANNEL_URL = 'http://pf.kakao.com/_gqxkRX'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  const handleCopyAndContact = async () => {
    const info = [
      `[Premuto 오류 리포트]`,
      `페이지: ${window.location.href}`,
      `시간: ${new Date().toLocaleString('ko-KR')}`,
      `오류: ${error.message}`,
      error.digest ? `코드: ${error.digest}` : '',
    ].filter(Boolean).join('\n')

    try {
      await navigator.clipboard.writeText(info)
      setCopied(true)
      setTimeout(() => {
        window.open(KAKAO_CHANNEL_URL, '_blank')
      }, 500)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.open(KAKAO_CHANNEL_URL, '_blank')
    }
  }

  const buttonBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    height: '44px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none',
    transition: 'opacity 0.2s',
  }

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          backgroundColor: '#ffffff',
          color: '#111827',
        }}
      >
        <div
          style={{
            display: 'flex',
            minHeight: '100vh',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 16px',
          }}
        >
          <div style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: '24px' }}>😿</div>
            <h2
              style={{
                fontSize: '20px',
                fontWeight: 600,
                color: '#111827',
                margin: '0 0 8px 0',
              }}
            >
              앗, 문제가 발생했어요
            </h2>
            <p
              style={{
                fontSize: '14px',
                color: '#6b7280',
                margin: '0 0 32px 0',
              }}
            >
              일시적인 오류일 수 있어요. 다시 시도해 주세요.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={reset}
                style={{
                  ...buttonBase,
                  backgroundColor: '#18181b',
                  color: '#ffffff',
                }}
              >
                ↻ 다시 시도
              </button>

              <button
                onClick={handleCopyAndContact}
                style={{
                  ...buttonBase,
                  backgroundColor: '#FEE500',
                  color: '#3C1E1E',
                }}
              >
                {copied ? '✓ 복사됨! 카카오 채널로 이동 중...' : '에러 정보 복사 후 카카오로 문의'}
              </button>
            </div>

            {error.digest && (
              <p style={{ fontSize: '12px', color: '#d1d5db', marginTop: '24px' }}>
                오류 코드: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}
