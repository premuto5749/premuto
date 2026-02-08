'use client'

import { useCallback, useState } from 'react'
import { FileSpreadsheet, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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

export function DailyLogExcelExport({ year, month, statsMap, petName, petId }: DailyLogExcelExportProps) {
  const { toast } = useToast()

  const [isExporting, setIsExporting] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const monthLabel = month + 1

  // Excel 워크북 생성
  const buildWorkbook = useCallback((logs: DailyLog[]) => {
    const workbook = XLSX.utils.book_new()

    // ==============================
    // Sheet 1: 개요
    // ==============================
    const overviewRows: (string | number | null)[][] = []

    overviewRows.push([`${petName} 건강기록`])
    overviewRows.push([`${year}년 ${monthLabel}월`])
    overviewRows.push([])

    const monthEntries = Object.entries(statsMap)
      .filter(([dateKey]) => {
        const d = new Date(dateKey)
        return d.getFullYear() === year && d.getMonth() === month
      })
      .sort(([a], [b]) => a.localeCompare(b))

    overviewRows.push(['기록일수', `${monthEntries.length}일`])
    overviewRows.push([])
    overviewRows.push(['카테고리별 월간 통계'])
    overviewRows.push([])

    const totalMealAmount = monthEntries.reduce((sum, [, s]) => sum + s.total_meal_amount, 0)
    const totalMealCount = monthEntries.reduce((sum, [, s]) => sum + s.meal_count, 0)
    const mealDays = monthEntries.filter(([, s]) => s.meal_count > 0).length

    const totalWaterAmount = monthEntries.reduce((sum, [, s]) => sum + s.total_water_amount, 0)
    const totalWaterCount = monthEntries.reduce((sum, [, s]) => sum + s.water_count, 0)
    const waterDays = monthEntries.filter(([, s]) => s.water_count > 0).length

    const totalMedicineCount = monthEntries.reduce((sum, [, s]) => sum + s.medicine_count, 0)
    const totalPoopCount = monthEntries.reduce((sum, [, s]) => sum + s.poop_count, 0)
    const totalPeeCount = monthEntries.reduce((sum, [, s]) => sum + s.pee_count, 0)

    const breathingEntries = monthEntries.filter(([, s]) => s.breathing_count > 0 && s.avg_breathing_rate != null)
    const totalBreathingCount = monthEntries.reduce((sum, [, s]) => sum + s.breathing_count, 0)
    const breathingRates = breathingEntries.map(([, s]) => s.avg_breathing_rate!)
    const avgBreathing = breathingRates.length > 0
      ? Math.round(breathingRates.reduce((a, b) => a + b, 0) / breathingRates.length)
      : null
    const maxBreathing = breathingRates.length > 0 ? Math.round(Math.max(...breathingRates)) : null
    const minBreathing = breathingRates.length > 0 ? Math.round(Math.min(...breathingRates)) : null

    overviewRows.push(['[ 식사 ]'])
    overviewRows.push(['총 섭취량', `${totalMealAmount}g`])
    overviewRows.push(['일평균', mealDays > 0 ? `${Math.round(totalMealAmount / mealDays)}g` : '-'])
    overviewRows.push(['기록 횟수', `${totalMealCount}회`])
    overviewRows.push([])

    overviewRows.push(['[ 음수 ]'])
    overviewRows.push(['총 음수량', `${totalWaterAmount}ml`])
    overviewRows.push(['일평균', waterDays > 0 ? `${Math.round(totalWaterAmount / waterDays)}ml` : '-'])
    overviewRows.push(['기록 횟수', `${totalWaterCount}회`])
    overviewRows.push([])

    overviewRows.push(['[ 약 ]'])
    overviewRows.push(['총 복용 횟수', `${totalMedicineCount}회`])
    overviewRows.push([])

    overviewRows.push(['[ 배변 ]'])
    overviewRows.push(['총 횟수', `${totalPoopCount}회`])
    overviewRows.push([])

    overviewRows.push(['[ 배뇨 ]'])
    overviewRows.push(['총 횟수', `${totalPeeCount}회`])
    overviewRows.push([])

    overviewRows.push(['[ 호흡수 ]'])
    overviewRows.push(['평균', avgBreathing != null ? `${avgBreathing}회/분` : '-'])
    overviewRows.push(['최대', maxBreathing != null ? `${maxBreathing}회/분` : '-'])
    overviewRows.push(['최소', minBreathing != null ? `${minBreathing}회/분` : '-'])
    overviewRows.push(['측정 횟수', `${totalBreathingCount}회`])

    const overviewSheet = XLSX.utils.aoa_to_sheet(overviewRows)
    overviewSheet['!cols'] = [{ wch: 16 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(workbook, overviewSheet, '개요')

    // ==============================
    // 카테고리별 시트 생성
    // ==============================
    const logsByCategory: Record<string, DailyLog[]> = {}
    for (const log of logs) {
      if (!logsByCategory[log.category]) {
        logsByCategory[log.category] = []
      }
      logsByCategory[log.category].push(log)
    }

    const formatDateTime = (loggedAt: string) => {
      const dt = new Date(loggedAt)
      const dateStr = dt.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
      const timeStr = dt.toLocaleTimeString('ko-KR', {
        timeZone: 'Asia/Seoul',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      return { dateStr, timeStr }
    }

    if (logsByCategory['meal']) {
      const rows: (string | number | null)[][] = [['날짜', '시간', '급여량(g)', '남긴 양(g)', '실제 섭취량(g)', '메모']]
      for (const log of logsByCategory['meal']) {
        const { dateStr, timeStr } = formatDateTime(log.logged_at)
        const actual = log.amount != null && log.leftover_amount != null
          ? log.amount - log.leftover_amount
          : log.amount
        rows.push([dateStr, timeStr, log.amount ?? null, log.leftover_amount ?? null, actual ?? null, log.memo || null])
      }
      const sheet = XLSX.utils.aoa_to_sheet(rows)
      sheet['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 25 }]
      XLSX.utils.book_append_sheet(workbook, sheet, '식사')
    }

    if (logsByCategory['water']) {
      const rows: (string | number | null)[][] = [['날짜', '시간', '음수량(ml)', '메모']]
      for (const log of logsByCategory['water']) {
        const { dateStr, timeStr } = formatDateTime(log.logged_at)
        rows.push([dateStr, timeStr, log.amount ?? null, log.memo || null])
      }
      const sheet = XLSX.utils.aoa_to_sheet(rows)
      sheet['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 25 }]
      XLSX.utils.book_append_sheet(workbook, sheet, '음수')
    }

    if (logsByCategory['medicine']) {
      const rows: (string | number | null)[][] = [['날짜', '시간', '약 이름', '복용량', '단위', '메모']]
      for (const log of logsByCategory['medicine']) {
        const { dateStr, timeStr } = formatDateTime(log.logged_at)
        rows.push([
          dateStr, timeStr,
          log.medicine_name || null,
          log.amount ?? null,
          log.unit || (LOG_CATEGORY_CONFIG[log.category]?.unit ?? null),
          log.memo || null,
        ])
      }
      const sheet = XLSX.utils.aoa_to_sheet(rows)
      sheet['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 15 }, { wch: 10 }, { wch: 8 }, { wch: 25 }]
      XLSX.utils.book_append_sheet(workbook, sheet, '약')
    }

    if (logsByCategory['poop']) {
      const rows: (string | number | null)[][] = [['날짜', '시간', '메모']]
      for (const log of logsByCategory['poop']) {
        const { dateStr, timeStr } = formatDateTime(log.logged_at)
        rows.push([dateStr, timeStr, log.memo || null])
      }
      const sheet = XLSX.utils.aoa_to_sheet(rows)
      sheet['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 25 }]
      XLSX.utils.book_append_sheet(workbook, sheet, '배변')
    }

    if (logsByCategory['pee']) {
      const rows: (string | number | null)[][] = [['날짜', '시간', '메모']]
      for (const log of logsByCategory['pee']) {
        const { dateStr, timeStr } = formatDateTime(log.logged_at)
        rows.push([dateStr, timeStr, log.memo || null])
      }
      const sheet = XLSX.utils.aoa_to_sheet(rows)
      sheet['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 25 }]
      XLSX.utils.book_append_sheet(workbook, sheet, '배뇨')
    }

    if (logsByCategory['breathing']) {
      const rows: (string | number | null)[][] = [['날짜', '시간', '호흡수(회/분)', '메모']]
      for (const log of logsByCategory['breathing']) {
        const { dateStr, timeStr } = formatDateTime(log.logged_at)
        rows.push([dateStr, timeStr, log.amount ?? null, log.memo || null])
      }
      const sheet = XLSX.utils.aoa_to_sheet(rows)
      sheet['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 25 }]
      XLSX.utils.book_append_sheet(workbook, sheet, '호흡수')
    }

    return workbook
  }, [year, month, monthLabel, statsMap, petName])

  // 엑셀 내보내기 실행
  const executeExport = useCallback(async () => {
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
            description: '오늘 무료 내보내기를 모두 사용했습니다. Basic 요금제부터 무제한 이용 가능합니다.',
            variant: 'destructive',
          })
          return
        }
        toast({
          title: '오류',
          description: result.error || '데이터를 가져오지 못했습니다',
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
          description: `${monthLabel}월에 기록된 데이터가 없습니다`,
          variant: 'destructive',
        })
        return
      }

      const workbook = buildWorkbook(logs)
      const monthStr = String(monthLabel).padStart(2, '0')
      const baseFilename = `${petName}_${year}년${monthStr}월_건강기록`

      XLSX.writeFile(workbook, `${baseFilename}.xlsx`)

      if (usage.limit !== -1) {
        toast({
          title: '다운로드 완료',
          description: `건강기록이 다운로드되었습니다. 오늘 ${usage.used}/${usage.limit}회 사용`,
        })
      } else {
        toast({
          title: '다운로드 완료',
          description: '건강기록이 다운로드되었습니다',
        })
      }
    } catch (error) {
      console.error('Export error:', error)
      toast({
        title: '오류',
        description: '내보내기 중 오류가 발생했습니다',
        variant: 'destructive',
      })
    } finally {
      setIsExporting(false)
    }
  }, [year, month, monthLabel, petName, petId, toast, buildWorkbook])

  // 버튼 클릭: tier 확인 후 분기
  const handleExportClick = useCallback(async () => {
    setIsChecking(true)
    try {
      const res = await fetch('/api/daily-logs/export-detailed?type=excel')
      if (!res.ok) {
        toast({
          title: '오류',
          description: '사용량 확인 중 오류가 발생했습니다',
          variant: 'destructive',
        })
        return
      }

      const data = await res.json() as { tier: string; used: number; limit: number; remaining: number }

      if (data.tier === 'free') {
        if (data.remaining > 0) {
          setShowConfirm(true)
        } else {
          toast({
            title: '내보내기 제한',
            description: '오늘 무료 내보내기를 모두 사용했습니다. Basic 요금제부터 무제한 이용 가능합니다.',
            variant: 'destructive',
          })
        }
      } else {
        await executeExport()
      }
    } catch (error) {
      console.error('Usage check error:', error)
      toast({
        title: '오류',
        description: '사용량 확인 중 오류가 발생했습니다',
        variant: 'destructive',
      })
    } finally {
      setIsChecking(false)
    }
  }, [executeExport, toast])

  const hasData = Object.keys(statsMap).length > 0
  const isLoading = isChecking || isExporting

  return (
    <>
      <Button
        variant="outline"
        className="w-full"
        onClick={handleExportClick}
        disabled={!hasData || isLoading}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <FileSpreadsheet className="h-4 w-4 mr-2" />
        )}
        {monthLabel}월 엑셀 다운로드
      </Button>

      {/* Excel 확인 다이얼로그 */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>일 1회 제공 기능</AlertDialogTitle>
            <AlertDialogDescription>
              무료 요금제에서는 일 1회 엑셀 내보내기가 제공됩니다. 오늘 내보내기 기회를 사용하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowConfirm(false); executeExport() }}>다운로드</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
