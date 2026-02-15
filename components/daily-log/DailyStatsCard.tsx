'use client'

import { useState, useRef, useCallback } from 'react'
import { ArrowRightLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DailyStats, LogCategory } from '@/types'
import { LOG_CATEGORY_CONFIG } from '@/types'
import { formatNumber, formatLocalDate } from '@/lib/utils'

interface CalorieData {
  intake: number
  target: number
  percentage: number
  intakeGrams?: number
  targetGrams?: number
}

interface DailyStatsCardProps {
  stats: DailyStats | null
  date: string
  selectedCategory?: LogCategory | null
  onCategoryClick?: (category: LogCategory) => void
  currentWeight?: number | null
  calorieData?: CalorieData | null
}

export function DailyStatsCard({ stats, date, selectedCategory, onCategoryClick, currentWeight, calorieData }: DailyStatsCardProps) {
  const [showGrams, setShowGrams] = useState(false)
  const [statsPage, setStatsPage] = useState(0)
  const touchStartX = useRef<number>(0)

  const handleStatsTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }, [])

  const handleStatsTouchEnd = useCallback((e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) {
      if (diff > 0 && statsPage === 0) setStatsPage(1)
      else if (diff < 0 && statsPage === 1) setStatsPage(0)
    }
  }, [statsPage])
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (dateStr === formatLocalDate(today)) {
      return '오늘'
    } else if (dateStr === formatLocalDate(yesterday)) {
      return '어제'
    }

    return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
  }

  if (!stats) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{formatDate(date)} 요약</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">기록이 없습니다</p>
        </CardContent>
      </Card>
    )
  }

  const allStatItems = [
    {
      category: 'meal' as LogCategory,
      icon: LOG_CATEGORY_CONFIG.meal.icon,
      label: '식사',
      value: stats.total_meal_amount > 0 ? `${formatNumber(stats.total_meal_amount)}g` : '-',
      count: stats.meal_count,
      color: LOG_CATEGORY_CONFIG.meal.color,
    },
    {
      category: 'water' as LogCategory,
      icon: LOG_CATEGORY_CONFIG.water.icon,
      label: '음수',
      value: stats.total_water_amount > 0 ? `${formatNumber(stats.total_water_amount)}ml` : '-',
      count: stats.water_count,
      color: LOG_CATEGORY_CONFIG.water.color,
    },
    {
      category: 'snack' as LogCategory,
      icon: LOG_CATEGORY_CONFIG.snack.icon,
      label: '간식',
      value: stats.snack_count > 0 ? `${stats.snack_count}회` : '-',
      count: stats.snack_count,
      color: LOG_CATEGORY_CONFIG.snack.color,
    },
    {
      category: 'poop' as LogCategory,
      icon: LOG_CATEGORY_CONFIG.poop.icon,
      label: '배변',
      value: stats.poop_count > 0 ? `${stats.poop_count}회` : '-',
      count: stats.poop_count,
      color: LOG_CATEGORY_CONFIG.poop.color,
    },
    {
      category: 'pee' as LogCategory,
      icon: LOG_CATEGORY_CONFIG.pee.icon,
      label: '배뇨',
      value: stats.pee_count > 0 ? `${stats.pee_count}회` : '-',
      count: stats.pee_count,
      color: LOG_CATEGORY_CONFIG.pee.color,
    },
    {
      category: 'breathing' as LogCategory,
      icon: LOG_CATEGORY_CONFIG.breathing.icon,
      label: '호흡수',
      value: stats.avg_breathing_rate ? `${Math.round(stats.avg_breathing_rate)}회/분` : '-',
      count: stats.breathing_count,
      color: LOG_CATEGORY_CONFIG.breathing.color,
    },
    {
      category: 'medicine' as LogCategory,
      icon: LOG_CATEGORY_CONFIG.medicine.icon,
      label: '약',
      value: stats.medicine_count > 0 ? `${stats.medicine_count}회` : '-',
      count: stats.medicine_count,
      color: LOG_CATEGORY_CONFIG.medicine.color,
    },
  ]

  const page1Items = allStatItems.slice(0, 6)
  const page2Items = allStatItems.slice(6)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{formatDate(date)} 요약</CardTitle>
          {currentWeight && (
            <span className="text-sm text-muted-foreground">⚖️ {currentWeight}kg</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          onTouchStart={handleStatsTouchStart}
          onTouchEnd={handleStatsTouchEnd}
        >
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-300 ease-in-out"
              style={{ transform: statsPage === 1 ? 'translateX(-100%)' : 'translateX(0)' }}
            >
              {/* 페이지 1: 6개 (3x2) */}
              <div className="min-w-full">
                <div className="grid grid-cols-3 gap-3">
                  {page1Items.map((item) => {
                    const isSelected = selectedCategory === item.category
                    const isClickable = item.count > 0
                    return (
                      <div
                        key={item.label}
                        className={`p-3 rounded-lg text-center transition-all ${
                          isSelected
                            ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                            : 'bg-muted/50'
                        } ${
                          isClickable && onCategoryClick
                            ? isSelected
                              ? 'cursor-pointer hover:bg-primary/90 active:scale-95'
                              : 'cursor-pointer hover:bg-muted active:scale-95'
                            : ''
                        }`}
                        onClick={() => {
                          if (isClickable && onCategoryClick) {
                            onCategoryClick(item.category)
                          }
                        }}
                      >
                        <div className="text-2xl mb-1">{item.icon}</div>
                        <div className={`text-xs ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                          {item.label}
                        </div>
                        <div className="font-semibold">{item.value}</div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 페이지 2: 약 */}
              <div className="min-w-full">
                <div className="grid grid-cols-3 gap-3">
                  {page2Items.map((item) => {
                    const isSelected = selectedCategory === item.category
                    const isClickable = item.count > 0
                    return (
                      <div
                        key={item.label}
                        className={`p-3 rounded-lg text-center transition-all ${
                          isSelected
                            ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                            : 'bg-muted/50'
                        } ${
                          isClickable && onCategoryClick
                            ? isSelected
                              ? 'cursor-pointer hover:bg-primary/90 active:scale-95'
                              : 'cursor-pointer hover:bg-muted active:scale-95'
                            : ''
                        }`}
                        onClick={() => {
                          if (isClickable && onCategoryClick) {
                            onCategoryClick(item.category)
                          }
                        }}
                      >
                        <div className="text-2xl mb-1">{item.icon}</div>
                        <div className={`text-xs ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                          {item.label}
                        </div>
                        <div className="font-semibold">{item.value}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* 페이지 인디케이터 */}
          <div className="flex justify-center gap-2 mt-2">
            <button
              className={`w-2 h-2 rounded-full transition-colors ${statsPage === 0 ? 'bg-primary' : 'bg-muted-foreground/30'}`}
              onClick={() => setStatsPage(0)}
            />
            <button
              className={`w-2 h-2 rounded-full transition-colors ${statsPage === 1 ? 'bg-primary' : 'bg-muted-foreground/30'}`}
              onClick={() => setStatsPage(1)}
            />
          </div>
        </div>
        {/* 칼로리 프로그레스 바 (탭하면 kcal ↔ 사료량g 토글) */}
        {calorieData && (() => {
          const diffKcal = calorieData.intake - calorieData.target
          const diffGrams = (calorieData.intakeGrams ?? 0) - (calorieData.targetGrams ?? 0)
          const isOver = diffKcal > 0
          const diffLabel = (diff: number, unit: string) =>
            diff > 0 ? `(+${formatNumber(diff)}${unit})` : `(${formatNumber(diff)}${unit})`
          return (
            <div
              className="p-3 bg-muted/50 rounded-lg cursor-pointer active:scale-[0.99] transition-all"
              onClick={() => setShowGrams(prev => !prev)}
            >
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-muted-foreground flex items-center gap-1">
                  {showGrams ? '사료량' : '칼로리'}
                  <ArrowRightLeft className="w-3 h-3" />
                </span>
                <span className={`font-medium ${isOver ? 'text-red-600' : ''}`}>
                  {showGrams
                    ? <>
                        {formatNumber(calorieData.intakeGrams ?? 0)}g / {formatNumber(calorieData.targetGrams ?? 0)}g {diffLabel(diffGrams, 'g')}
                      </>
                    : <>
                        {formatNumber(calorieData.intake)} / {formatNumber(calorieData.target)} kcal {diffLabel(diffKcal, 'kcal')}
                      </>
                  }
                </span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isOver ? 'bg-red-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(calorieData.percentage, 100)}%` }}
                />
              </div>
            </div>
          )
        })()}
      </CardContent>
    </Card>
  )
}
