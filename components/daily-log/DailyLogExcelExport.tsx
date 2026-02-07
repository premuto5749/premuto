'use client'

import { useCallback, useState } from 'react'
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import * as XLSX from 'xlsx'
import type { DailyStats, DailyLog } from '@/types'
import { LOG_CATEGORY_CONFIG } from '@/types'

interface DailyLogExcelExportProps {
  year: number
  month: number // 0-indexed
  statsMap: Record<string, DailyStats>
  petName: string
  petId: string | null
}

const CATEGORY_LABEL: Record<string, string> = {
  meal: '식사',
  water: '음수',
  medicine: '약',
  poop: '배변',
  pee: '배뇨',
  breathing: '호흡수',
}

export function DailyLogExcelExport({ year, month, statsMap, petName, petId }: DailyLogExcelExportProps) {
  const { toast } = useToast()
  const [isExporting, setIsExporting] = useState(false)

  // 기존: 기본 내보내기 (요약만)
  const handleExport = useCallback(() => {
    const entries = Object.entries(statsMap)
      .filter(([dateKey]) => {
        const d = new Date(dateKey)
        return d.getFullYear() === year && d.getMonth() === month
      })
      .sort(([a], [b]) => a.localeCompare(b))

    if (entries.length === 0) return

    const headers = ['날짜', '식사(g)', '음수(ml)', '약(회)', '배변(회)', '배뇨(회)', '호흡수(평균)']
    const rows: (string | number | null)[][] = [headers]

    for (const [dateKey, stats] of entries) {
      rows.push([
        dateKey,
        stats.meal_count > 0 ? stats.total_meal_amount : null,
        stats.water_count > 0 ? stats.total_water_amount : null,
        stats.medicine_count > 0 ? stats.medicine_count : null,
        stats.poop_count > 0 ? stats.poop_count : null,
        stats.pee_count > 0 ? stats.pee_count : null,
        stats.breathing_count > 0 && stats.avg_breathing_rate
          ? Math.round(stats.avg_breathing_rate)
          : null,
      ])
    }

    const workbook = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet(rows)

    sheet['!cols'] = [
      { wch: 12 }, // 날짜
      { wch: 10 }, // 식사
      { wch: 10 }, // 음수
      { wch: 8 },  // 약
      { wch: 8 },  // 배변
      { wch: 8 },  // 배뇨
      { wch: 12 }, // 호흡수
    ]

    XLSX.utils.book_append_sheet(workbook, sheet, `${month + 1}월 건강기록`)

    const monthStr = String(month + 1).padStart(2, '0')
    const filename = `${petName}_${year}년${monthStr}월_건강기록.xlsx`
    XLSX.writeFile(workbook, filename)
  }, [year, month, statsMap, petName])

  // 신규: 상세 내보내기 (요약 + 개별 기록)
  const handleDetailedExport = useCallback(async () => {
    setIsExporting(true)
    try {
      const res = await fetch('/api/daily-logs/export-detailed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month, pet_id: petId }),
      })

      if (!res.ok) {
        const result = await res.json()
        if (result.error === 'TIER_LIMIT_EXCEEDED') {
          toast({
            title: '내보내기 제한',
            description: '이번 달 무료 상세 내보내기를 모두 사용했습니다. Basic 요금제부터 무제한 이용 가능합니다.',
            variant: 'destructive',
          })
          return
        }
        toast({
          title: '오류',
          description: result.error || '상세 데이터를 가져오지 못했습니다',
          variant: 'destructive',
        })
        return
      }

      const result = await res.json()
      const logs: DailyLog[] = result.data || []
      const usage = result.usage as { tier: string; used: number; limit: number; remaining: number }

      if (logs.length === 0) {
        toast({
          title: '데이터 없음',
          description: `${month + 1}월에 기록된 데이터가 없습니다`,
          variant: 'destructive',
        })
        return
      }

      // 멀티시트 Excel 생성
      const workbook = XLSX.utils.book_new()

      // Sheet 1: 월간 요약
      const summaryEntries = Object.entries(statsMap)
        .filter(([dateKey]) => {
          const d = new Date(dateKey)
          return d.getFullYear() === year && d.getMonth() === month
        })
        .sort(([a], [b]) => a.localeCompare(b))

      const summaryHeaders = ['날짜', '식사(g)', '음수(ml)', '약(회)', '배변(회)', '배뇨(회)', '호흡수(평균)']
      const summaryRows: (string | number | null)[][] = [summaryHeaders]

      for (const [dateKey, stats] of summaryEntries) {
        summaryRows.push([
          dateKey,
          stats.meal_count > 0 ? stats.total_meal_amount : null,
          stats.water_count > 0 ? stats.total_water_amount : null,
          stats.medicine_count > 0 ? stats.medicine_count : null,
          stats.poop_count > 0 ? stats.poop_count : null,
          stats.pee_count > 0 ? stats.pee_count : null,
          stats.breathing_count > 0 && stats.avg_breathing_rate
            ? Math.round(stats.avg_breathing_rate)
            : null,
        ])
      }

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows)
      summarySheet['!cols'] = [
        { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 12 },
      ]
      XLSX.utils.book_append_sheet(workbook, summarySheet, '월간 요약')

      // Sheet 2: 상세 기록
      const detailHeaders = ['날짜', '시간', '카테고리', '양', '단위', '남긴 양', '약 이름', '메모']
      const detailRows: (string | number | null)[][] = [detailHeaders]

      for (const log of logs) {
        const loggedAt = new Date(log.logged_at)
        const dateStr = loggedAt.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
        const timeStr = loggedAt.toLocaleTimeString('ko-KR', {
          timeZone: 'Asia/Seoul',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })

        const categoryLabel = CATEGORY_LABEL[log.category] || log.category
        const actualAmount = log.category === 'meal' && log.amount != null && log.leftover_amount != null
          ? log.amount - log.leftover_amount
          : log.amount

        detailRows.push([
          dateStr,
          timeStr,
          categoryLabel,
          actualAmount ?? null,
          log.unit || (LOG_CATEGORY_CONFIG[log.category]?.unit ?? null),
          log.category === 'meal' ? (log.leftover_amount ?? null) : null,
          log.medicine_name || null,
          log.memo || null,
        ])
      }

      const detailSheet = XLSX.utils.aoa_to_sheet(detailRows)
      detailSheet['!cols'] = [
        { wch: 12 }, // 날짜
        { wch: 8 },  // 시간
        { wch: 8 },  // 카테고리
        { wch: 10 }, // 양
        { wch: 8 },  // 단위
        { wch: 10 }, // 남긴 양
        { wch: 15 }, // 약 이름
        { wch: 25 }, // 메모
      ]
      XLSX.utils.book_append_sheet(workbook, detailSheet, '상세 기록')

      const monthStr = String(month + 1).padStart(2, '0')
      const filename = `${petName}_${year}년${monthStr}월_상세_건강기록.xlsx`
      XLSX.writeFile(workbook, filename)

      // 토스트 안내
      if (usage.limit !== -1) {
        toast({
          title: '다운로드 완료',
          description: `상세 데이터가 다운로드되었습니다. 이번 달 무료 내보내기 ${usage.used}/${usage.limit}회 사용`,
        })
      } else {
        toast({
          title: '다운로드 완료',
          description: '상세 데이터가 다운로드되었습니다',
        })
      }
    } catch (error) {
      console.error('Detailed export error:', error)
      toast({
        title: '오류',
        description: '상세 내보내기 중 오류가 발생했습니다',
        variant: 'destructive',
      })
    } finally {
      setIsExporting(false)
    }
  }, [year, month, statsMap, petName, petId, toast])

  const hasData = Object.keys(statsMap).length > 0

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        className="w-full"
        onClick={handleExport}
        disabled={!hasData}
      >
        <Download className="h-4 w-4 mr-2" />
        {month + 1}월 데이터 내보내기 (Excel)
      </Button>
      <Button
        variant="outline"
        className="w-full"
        onClick={handleDetailedExport}
        disabled={!hasData || isExporting}
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <FileSpreadsheet className="h-4 w-4 mr-2" />
        )}
        {month + 1}월 상세 내보내기
      </Button>
    </div>
  )
}
