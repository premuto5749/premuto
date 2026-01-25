'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'

interface ExcelExportButtonProps {
  recordIds?: string[]
  dateFrom?: string
  dateTo?: string
  categories?: string[]
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
}

export function ExcelExportButton({
  recordIds,
  dateFrom,
  dateTo,
  categories,
  variant = 'outline',
  size = 'default'
}: ExcelExportButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/export-excel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          record_ids: recordIds,
          date_from: dateFrom,
          date_to: dateTo,
          categories,
          options: {
            format: 'pivot',
            includeReference: true,
            includeStatus: true,
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '내보내기에 실패했습니다')
      }

      // 파일 다운로드
      const blob = await response.blob()
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = 'mimo-blood-test-results.xlsx'

      if (contentDisposition) {
        const matches = contentDisposition.match(/filename="(.+)"/)
        if (matches && matches[1]) {
          filename = matches[1]
        }
      }

      // 다운로드 트리거
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

    } catch (err) {
      console.error('Export error:', err)
      setError(err instanceof Error ? err.message : '내보내기 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Button variant={variant} size={size} disabled>
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        내보내는 중...
      </Button>
    )
  }

  return (
    <div className="relative">
      <Button variant={variant} size={size} onClick={handleExport}>
        <Download className="w-4 h-4 mr-2" />
        Excel 내보내기
      </Button>

      {error && (
        <p className="absolute top-full mt-1 text-sm text-destructive whitespace-nowrap">
          {error}
        </p>
      )}
    </div>
  )
}
