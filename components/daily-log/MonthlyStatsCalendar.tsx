'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { LOG_CATEGORY_CONFIG } from '@/types'
import type { DailyStats } from '@/types'
import { formatNumber } from '@/lib/utils'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']

// 카테고리별 도트 색상
const CATEGORY_DOT_COLORS: Record<string, string> = {
  meal: 'bg-orange-400',
  water: 'bg-blue-400',
  medicine: 'bg-purple-400',
  poop: 'bg-amber-600',
  pee: 'bg-yellow-400',
  breathing: 'bg-teal-400',
}

const CATEGORY_ORDER = ['meal', 'water', 'medicine', 'poop', 'pee', 'breathing'] as const

interface MonthlyStatsCalendarProps {
  year: number
  month: number // 0-indexed
  statsMap: Record<string, DailyStats> // key: YYYY-MM-DD
  selectedDate: string | null // YYYY-MM-DD
  onSelectDate: (date: string) => void
  onPrevMonth: () => void
  onNextMonth: () => void
  onGoToThisMonth: () => void
}

// 한국 시간(KST) 기준 오늘 날짜
function getKSTToday(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}

function formatSummaryValue(stats: DailyStats, category: string): string {
  switch (category) {
    case 'meal':
      return stats.meal_count > 0 ? `${formatNumber(stats.total_meal_amount)}g` : '-'
    case 'water':
      return stats.water_count > 0 ? `${formatNumber(stats.total_water_amount)}ml` : '-'
    case 'medicine':
      return stats.medicine_count > 0 ? `${stats.medicine_count}회` : '-'
    case 'poop':
      return stats.poop_count > 0 ? `${stats.poop_count}회` : '-'
    case 'pee':
      return stats.pee_count > 0 ? `${stats.pee_count}회` : '-'
    case 'breathing':
      return stats.avg_breathing_rate ? `${Math.round(stats.avg_breathing_rate)}회/분` : '-'
    default:
      return '-'
  }
}

export function MonthlyStatsCalendar({
  year,
  month,
  statsMap,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onGoToThisMonth,
}: MonthlyStatsCalendarProps) {
  const today = getKSTToday()
  const todayDate = new Date(today)
  const isCurrentMonth = todayDate.getFullYear() === year && todayDate.getMonth() === month

  // 해당 월의 첫째 날, 마지막 날
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDayOfWeek = firstDay.getDay()
  const daysInMonth = lastDay.getDate()

  // 달력 날짜 배열 생성
  const days: (number | null)[] = []
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(null)
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i)
  }

  const formatDateKey = (day: number) => {
    const m = String(month + 1).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    return `${year}-${m}-${d}`
  }

  const isToday = (day: number) => formatDateKey(day) === today
  const isSelected = (day: number) => selectedDate === formatDateKey(day)

  // 해당 날짜에 기록된 카테고리 목록 구하기
  const getCategories = (day: number): string[] => {
    const stats = statsMap[formatDateKey(day)]
    if (!stats) return []
    const cats: string[] = []
    if (stats.meal_count > 0) cats.push('meal')
    if (stats.water_count > 0) cats.push('water')
    if (stats.medicine_count > 0) cats.push('medicine')
    if (stats.poop_count > 0) cats.push('poop')
    if (stats.pee_count > 0) cats.push('pee')
    if (stats.breathing_count > 0) cats.push('breathing')
    return cats
  }

  const selectedStats = selectedDate ? statsMap[selectedDate] || null : null

  // 선택된 날짜 포맷
  const formatSelectedDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
  }

  return (
    <div className="bg-background border rounded-lg p-3">
      {/* 헤더: 월 네비게이션 */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={onPrevMonth} className="h-8 w-8">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-base">
            {year}년 {month + 1}월
          </span>
          {!isCurrentMonth && (
            <Button variant="outline" size="sm" className="text-xs h-6 px-2" onClick={onGoToThisMonth}>
              이번 달
            </Button>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onNextMonth} className="h-8 w-8">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map((day, i) => (
          <div
            key={day}
            className={cn(
              'text-center text-xs font-medium py-1',
              i === 0 && 'text-red-500',
              i === 6 && 'text-blue-500'
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          if (day === null) {
            return <div key={index} className="aspect-square" />
          }

          const categories = getCategories(day)
          const dayOfWeek = index % 7

          return (
            <button
              key={index}
              onClick={() => onSelectDate(formatDateKey(day))}
              className={cn(
                'aspect-square flex flex-col items-center justify-center rounded-lg transition-colors relative p-0.5',
                isSelected(day) && 'bg-primary text-primary-foreground',
                !isSelected(day) && isToday(day) && 'bg-muted ring-1 ring-primary',
                !isSelected(day) && !isToday(day) && 'hover:bg-muted',
                // 일요일/토요일 색상
                dayOfWeek === 0 && !isSelected(day) && 'text-red-500',
                dayOfWeek === 6 && !isSelected(day) && 'text-blue-500'
              )}
            >
              <span className="text-sm leading-none">{day}</span>
              {/* 카테고리 도트 */}
              {categories.length > 0 && (
                <div className="flex gap-[2px] mt-0.5 flex-wrap justify-center max-w-full">
                  {CATEGORY_ORDER.filter(c => categories.includes(c)).map((cat) => (
                    <span
                      key={cat}
                      className={cn(
                        'w-[5px] h-[5px] rounded-full',
                        isSelected(day) ? 'bg-primary-foreground/70' : CATEGORY_DOT_COLORS[cat]
                      )}
                    />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* 인라인 요약 */}
      {selectedDate && (
        <div className="mt-3 pt-3 border-t">
          <p className="text-sm font-medium mb-2">{formatSelectedDate(selectedDate)}</p>
          {selectedStats ? (
            <div className="grid grid-cols-3 gap-2">
              {CATEGORY_ORDER.map((cat) => (
                <div key={cat} className="flex items-center gap-1.5 text-sm">
                  <span>{LOG_CATEGORY_CONFIG[cat].icon}</span>
                  <span className="text-muted-foreground">{formatSummaryValue(selectedStats, cat)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">기록이 없습니다</p>
          )}
        </div>
      )}
    </div>
  )
}
