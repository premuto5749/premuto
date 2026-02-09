'use client'

import { useState, useEffect, useCallback } from 'react'
import { AppHeader } from '@/components/layout/AppHeader'
import { MonthlyStatsCalendar } from '@/components/daily-log/MonthlyStatsCalendar'
import { MonthlyStatsCard } from '@/components/daily-log/MonthlyStatsCard'
import { DailyTrendChart } from '@/components/daily-log/DailyTrendChart'
import { DailyLogExcelExport } from '@/components/daily-log/DailyLogExcelExport'
import { usePet } from '@/contexts/PetContext'
import type { DailyStats } from '@/types'
import type { LogCategory } from '@/types'

// 한국 시간(KST, UTC+9) 기준 오늘 날짜 반환
function getKSTToday(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}

export default function DailyLogCalendarPage() {
  const today = getKSTToday()
  const todayDate = new Date(today)

  const [viewYear, setViewYear] = useState(todayDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(today)
  const [selectedCategory, setSelectedCategory] = useState<LogCategory>('meal')
  const [statsMap, setStatsMap] = useState<Record<string, DailyStats>>({})
  const [weightMap, setWeightMap] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)
  const { pets, currentPet, setCurrentPet, isLoading: isPetsLoading } = usePet()

  // 반려동물 로딩 완료 후 currentPet이 없으면 기본 반려동물 자동 선택
  useEffect(() => {
    if (!isPetsLoading && pets.length > 0 && !currentPet) {
      const defaultPet = pets.find(p => p.is_default) || pets[0]
      if (defaultPet) {
        setCurrentPet(defaultPet)
      }
    }
  }, [isPetsLoading, pets, currentPet, setCurrentPet])

  // 월간 통계 조회
  const fetchMonthStats = useCallback(async () => {
    if (isPetsLoading) return

    setIsLoading(true)
    try {
      const startDate = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-01`
      const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
      const endDate = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

      const petParam = currentPet ? `&pet_id=${currentPet.id}` : ''
      const [statsRes, weightRes] = await Promise.all([
        fetch(`/api/daily-logs?stats=true&start=${startDate}&end=${endDate}${petParam}`),
        fetch(`/api/daily-logs?start=${startDate}&end=${endDate}&category=weight${petParam}`),
      ])

      if (statsRes.ok) {
        const json = await statsRes.json()
        const map: Record<string, DailyStats> = {}
        for (const stat of (json.data || []) as DailyStats[]) {
          map[stat.log_date] = stat
        }
        setStatsMap(map)
      } else {
        setStatsMap({})
      }

      if (weightRes.ok) {
        const wJson = await weightRes.json()
        const wMap: Record<string, number> = {}
        for (const log of (wJson.data || []) as { logged_at: string; amount: number }[]) {
          const date = log.logged_at.slice(0, 10)
          wMap[date] = log.amount
        }
        setWeightMap(wMap)
      } else {
        setWeightMap({})
      }
    } catch (error) {
      console.error('Failed to fetch month stats:', error)
      setStatsMap({})
    } finally {
      setIsLoading(false)
    }
  }, [viewYear, viewMonth, currentPet, isPetsLoading])

  useEffect(() => {
    fetchMonthStats()
  }, [fetchMonthStats])

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1)
      setViewMonth(11)
    } else {
      setViewMonth(viewMonth - 1)
    }
    setSelectedDate(null)
  }

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1)
      setViewMonth(0)
    } else {
      setViewMonth(viewMonth + 1)
    }
    setSelectedDate(null)
  }

  const handleGoToThisMonth = () => {
    const t = new Date(getKSTToday())
    setViewYear(t.getFullYear())
    setViewMonth(t.getMonth())
    setSelectedDate(getKSTToday())
  }

  // 같은 날짜 재클릭 시 토글
  const handleSelectDate = (date: string) => {
    setSelectedDate(prev => prev === date ? null : date)
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title={currentPet ? `${currentPet.name} 일일 통계` : '일일 통계'} />

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            로딩 중...
          </div>
        ) : (
          <>
            {/* 월간 요약 카드 (평균, 클릭으로 그래프 항목 선택) */}
            <MonthlyStatsCard
              year={viewYear}
              month={viewMonth}
              statsMap={statsMap}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />

            {/* 추이 그래프 */}
            <DailyTrendChart
              year={viewYear}
              month={viewMonth}
              statsMap={statsMap}
              selectedCategory={selectedCategory}
            />

            {/* 월간 캘린더 (인라인 요약 포함) */}
            <MonthlyStatsCalendar
              year={viewYear}
              month={viewMonth}
              statsMap={statsMap}
              weightMap={weightMap}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              onGoToThisMonth={handleGoToThisMonth}
            />

            {/* 데이터 내보내기 */}
            <DailyLogExcelExport
              year={viewYear}
              month={viewMonth}
              statsMap={statsMap}
              petName={currentPet?.name || '반려동물'}
              petId={currentPet?.id || null}
            />
          </>
        )}
      </main>
    </div>
  )
}
