'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LOG_CATEGORY_CONFIG, type LogCategory } from '@/types'
import type { DailyStats } from '@/types'
import { formatNumber } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface MonthlyStatsCardProps {
  year: number
  month: number // 0-indexed
  statsMap: Record<string, DailyStats> // key: YYYY-MM-DD
  weightMap?: Record<string, number> // key: YYYY-MM-DD, value: kg
  selectedCategory: LogCategory
  onSelectCategory: (category: LogCategory) => void
}

export function MonthlyStatsCard({ year, month, statsMap, weightMap = {}, selectedCategory, onSelectCategory }: MonthlyStatsCardProps) {
  const statsArray = Object.values(statsMap)
  const daysWithRecords = statsArray.length

  // 카테고리별 기록이 있는 날 수 계산
  const mealDays = statsArray.filter(s => s.meal_count > 0)
  const waterDays = statsArray.filter(s => s.water_count > 0)
  const medicineDays = statsArray.filter(s => s.medicine_count > 0)
  const poopDays = statsArray.filter(s => s.poop_count > 0)
  const peeDays = statsArray.filter(s => s.pee_count > 0)
  const breathingDays = statsArray.filter(s => s.breathing_count > 0 && s.avg_breathing_rate)
  const snackDays = statsArray.filter(s => s.snack_count > 0)

  // 평균 계산 (해당 카테고리 기록이 있는 날만 기준)
  const avgMeal = mealDays.length > 0
    ? mealDays.reduce((sum, s) => sum + s.total_meal_amount, 0) / mealDays.length
    : 0
  const avgWater = waterDays.length > 0
    ? waterDays.reduce((sum, s) => sum + s.total_water_amount, 0) / waterDays.length
    : 0
  const avgMedicine = medicineDays.length > 0
    ? medicineDays.reduce((sum, s) => sum + s.medicine_count, 0) / medicineDays.length
    : 0
  const avgPoop = poopDays.length > 0
    ? poopDays.reduce((sum, s) => sum + s.poop_count, 0) / poopDays.length
    : 0
  const avgPee = peeDays.length > 0
    ? peeDays.reduce((sum, s) => sum + s.pee_count, 0) / peeDays.length
    : 0
  const avgBreathing = breathingDays.length > 0
    ? breathingDays.reduce((sum, s) => sum + (s.avg_breathing_rate || 0), 0) / breathingDays.length
    : 0
  const avgSnack = snackDays.length > 0
    ? snackDays.reduce((sum, s) => sum + s.snack_count, 0) / snackDays.length
    : 0

  // 체중: weightMap에서 마지막(최신) 기록 가져오기
  const weightEntries = Object.entries(weightMap)
    .filter(([dateKey]) => {
      const d = new Date(dateKey)
      return d.getFullYear() === year && d.getMonth() === month
    })
    .sort(([a], [b]) => b.localeCompare(a)) // 최신 날짜 먼저
  const latestWeight = weightEntries.length > 0 ? weightEntries[0][1] : null

  const items: { category: LogCategory; label: string; value: string }[] = [
    {
      category: 'meal',
      label: '식사',
      value: avgMeal > 0 ? `${formatNumber(Math.round(avgMeal))}g/일` : '-',
    },
    {
      category: 'water',
      label: '음수',
      value: avgWater > 0 ? `${formatNumber(Math.round(avgWater))}ml/일` : '-',
    },
    {
      category: 'snack',
      label: '간식',
      value: avgSnack > 0 ? `${avgSnack.toFixed(1)}회/일` : '-',
    },
    {
      category: 'poop',
      label: '배변',
      value: avgPoop > 0 ? `${avgPoop.toFixed(1)}회/일` : '-',
    },
    {
      category: 'pee',
      label: '배뇨',
      value: avgPee > 0 ? `${avgPee.toFixed(1)}회/일` : '-',
    },
    {
      category: 'medicine',
      label: '약',
      value: avgMedicine > 0 ? `${avgMedicine.toFixed(1)}회/일` : '-',
    },
    {
      category: 'breathing',
      label: '호흡수',
      value: avgBreathing > 0 ? `${Math.round(avgBreathing)}회/분` : '-',
    },
    {
      category: 'weight',
      label: '체중',
      value: latestWeight !== null ? `${latestWeight}kg` : '-',
    },
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {year}년 {month + 1}월 요약
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            {daysWithRecords}일 기록 기준
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {items.map((item) => (
            <button
              key={item.category}
              onClick={() => onSelectCategory(item.category)}
              className={cn(
                'p-3 rounded-lg text-center transition-all',
                selectedCategory === item.category
                  ? 'bg-muted ring-2 ring-primary'
                  : 'bg-muted/50 hover:bg-muted/80'
              )}
            >
              <div className="text-2xl mb-1">{LOG_CATEGORY_CONFIG[item.category].icon}</div>
              <div className="text-xs text-muted-foreground">{item.label}</div>
              <div className="font-semibold text-sm">{item.value}</div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
