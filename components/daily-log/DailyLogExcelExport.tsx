'use client'

import { useCallback } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import * as XLSX from 'xlsx'
import type { DailyStats } from '@/types'

interface DailyLogExcelExportProps {
  year: number
  month: number // 0-indexed
  statsMap: Record<string, DailyStats>
  petName: string
}

export function DailyLogExcelExport({ year, month, statsMap, petName }: DailyLogExcelExportProps) {
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

  const hasData = Object.keys(statsMap).length > 0

  return (
    <Button
      variant="outline"
      className="w-full"
      onClick={handleExport}
      disabled={!hasData}
    >
      <Download className="h-4 w-4 mr-2" />
      {month + 1}월 데이터 내보내기 (Excel)
    </Button>
  )
}
