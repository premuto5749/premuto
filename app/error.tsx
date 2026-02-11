'use client'

import { useEffect, useState } from 'react'
import * as Sentry from '@sentry/nextjs'
import { Button } from '@/components/ui/button'
import { RefreshCw, Check } from 'lucide-react'

const KAKAO_CHANNEL_URL = 'http://pf.kakao.com/_gqxkRX'

export default function Error({
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

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="text-6xl">😿</div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-900">
            앗, 문제가 발생했어요
          </h2>
          <p className="text-sm text-gray-500">
            일시적인 오류일 수 있어요. 다시 시도해 주세요.
          </p>
        </div>

        <div className="space-y-3">
          <Button onClick={reset} className="w-full gap-2">
            <RefreshCw className="h-4 w-4" />
            다시 시도
          </Button>

          <Button
            variant="outline"
            onClick={handleCopyAndContact}
            className="w-full gap-2 bg-[#FEE500] hover:bg-[#FDD835] border-[#FEE500] hover:border-[#FDD835] text-[#3C1E1E]"
          >
            {copied ? <Check className="h-4 w-4" /> : null}
            {copied ? '복사됨! 카카오 채널로 이동 중...' : '에러 정보 복사 후 카카오로 문의'}
          </Button>
        </div>

        <a
          href="/daily-log"
          className="inline-block text-sm text-gray-400 hover:text-gray-600 underline"
        >
          홈으로 돌아가기
        </a>

        {error.digest && (
          <p className="text-xs text-gray-300">오류 코드: {error.digest}</p>
        )}
      </div>
    </div>
  )
}
