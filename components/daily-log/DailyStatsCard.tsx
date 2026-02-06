'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DailyStats } from '@/types'
import { LOG_CATEGORY_CONFIG } from '@/types'
import { formatNumber } from '@/lib/utils'

interface DailyStatsCardProps {
  stats: DailyStats | null
  date: string
}

export function DailyStatsCard({ stats, date }: DailyStatsCardProps) {
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (dateStr === today.toISOString().split('T')[0]) {
      return '오늘'
    } else if (dateStr === yesterday.toISOString().split('T')[0]) {
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

  const statItems = [
    {
      icon: LOG_CATEGORY_CONFIG.meal.icon,
      label: '식사',
      value: stats.total_meal_amount > 0 ? `${formatNumber(stats.total_meal_amount)}g` : '-',
      count: stats.meal_count,
      color: LOG_CATEGORY_CONFIG.meal.color,
    },
    {
      icon: LOG_CATEGORY_CONFIG.water.icon,
      label: '음수',
      value: stats.total_water_amount > 0 ? `${formatNumber(stats.total_water_amount)}ml` : '-',
      count: stats.water_count,
      color: LOG_CATEGORY_CONFIG.water.color,
    },
    {
      icon: LOG_CATEGORY_CONFIG.medicine.icon,
      label: '약',
      value: stats.medicine_count > 0 ? `${stats.medicine_count}회` : '-',
      count: stats.medicine_count,
      color: LOG_CATEGORY_CONFIG.medicine.color,
    },
    {
      icon: LOG_CATEGORY_CONFIG.poop.icon,
      label: '배변',
      value: stats.poop_count > 0 ? `${stats.poop_count}회` : '-',
      count: stats.poop_count,
      color: LOG_CATEGORY_CONFIG.poop.color,
    },
    {
      icon: LOG_CATEGORY_CONFIG.pee.icon,
      label: '배뇨',
      value: stats.pee_count > 0 ? `${stats.pee_count}회` : '-',
      count: stats.pee_count,
      color: LOG_CATEGORY_CONFIG.pee.color,
    },
    {
      icon: LOG_CATEGORY_CONFIG.breathing.icon,
      label: '호흡수',
      value: stats.avg_breathing_rate ? `${Math.round(stats.avg_breathing_rate)}회/분` : '-',
      count: stats.breathing_count,
      color: LOG_CATEGORY_CONFIG.breathing.color,
    },
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{formatDate(date)} 요약</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {statItems.map((item) => (
            <div
              key={item.label}
              className="p-3 rounded-lg text-center bg-muted/50"
            >
              <div className="text-2xl mb-1">{item.icon}</div>
              <div className="text-xs text-muted-foreground">{item.label}</div>
              <div className="font-semibold">{item.value}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
