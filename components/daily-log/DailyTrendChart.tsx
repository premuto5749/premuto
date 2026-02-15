'use client'

import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { LOG_CATEGORY_CONFIG, type LogCategory } from '@/types'
import type { DailyStats } from '@/types'
import { formatNumber } from '@/lib/utils'

interface DailyTrendChartProps {
  year: number
  month: number // 0-indexed
  statsMap: Record<string, DailyStats>
  weightMap?: Record<string, number> // key: YYYY-MM-DD, value: kg
  selectedCategory: LogCategory
}

const CATEGORY_COLORS: Record<LogCategory, string> = {
  meal: '#f97316',     // orange
  water: '#3b82f6',    // blue
  snack: '#ec4899',    // pink
  medicine: '#a855f7', // purple
  poop: '#d97706',     // amber
  pee: '#eab308',      // yellow
  breathing: '#14b8a6', // teal
  weight: '#10b981',    // emerald
}

function getCategoryValue(stats: DailyStats, category: LogCategory): number | null {
  switch (category) {
    case 'meal':
      return stats.meal_count > 0 ? stats.total_meal_amount : null
    case 'water':
      return stats.water_count > 0 ? stats.total_water_amount : null
    case 'snack':
      return stats.snack_count > 0 ? stats.snack_count : null
    case 'medicine':
      return stats.medicine_count > 0 ? stats.medicine_count : null
    case 'poop':
      return stats.poop_count > 0 ? stats.poop_count : null
    case 'pee':
      return stats.pee_count > 0 ? stats.pee_count : null
    case 'breathing':
      return stats.breathing_count > 0 && stats.avg_breathing_rate ? Math.round(stats.avg_breathing_rate) : null
    case 'weight':
      return null // 체중은 weightMap에서 별도 처리
  }
}

function getCategoryUnit(category: LogCategory): string {
  switch (category) {
    case 'meal': return 'g'
    case 'water': return 'ml'
    case 'snack': return '회'
    case 'medicine': return '회'
    case 'poop': return '회'
    case 'pee': return '회'
    case 'breathing': return '회/분'
    case 'weight': return 'kg'
  }
}

export function DailyTrendChart({ year, month, statsMap, weightMap = {}, selectedCategory }: DailyTrendChartProps) {
  const chartData = useMemo(() => {
    // 체중은 weightMap에서 별도 처리
    if (selectedCategory === 'weight') {
      return Object.entries(weightMap)
        .filter(([dateKey]) => {
          const d = new Date(dateKey)
          return d.getFullYear() === year && d.getMonth() === month
        })
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dateKey, value]) => ({
          dateLabel: `${new Date(dateKey).getDate()}일`,
          value,
        }))
    }

    const entries = Object.entries(statsMap)
      .filter(([dateKey]) => {
        const d = new Date(dateKey)
        return d.getFullYear() === year && d.getMonth() === month
      })
      .sort(([a], [b]) => a.localeCompare(b))

    const points: { dateLabel: string; value: number }[] = []
    for (const [dateKey, stats] of entries) {
      const value = getCategoryValue(stats, selectedCategory)
      if (value !== null) {
        const day = new Date(dateKey).getDate()
        points.push({ dateLabel: `${day}일`, value })
      }
    }
    return points
  }, [statsMap, weightMap, year, month, selectedCategory])

  const color = CATEGORY_COLORS[selectedCategory]
  const unit = getCategoryUnit(selectedCategory)
  const label = LOG_CATEGORY_CONFIG[selectedCategory].label

  if (chartData.length === 0) {
    return (
      <div className="bg-background border rounded-lg p-4">
        <p className="text-sm font-medium mb-2">{label} 추이</p>
        <p className="text-sm text-muted-foreground text-center py-6">이번 달 {label} 기록이 없습니다</p>
      </div>
    )
  }

  return (
    <div className="bg-background border rounded-lg p-4">
      <p className="text-sm font-medium mb-2">
        {label} 추이
        <span className="text-xs text-muted-foreground ml-2">({unit})</span>
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            width={40}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload
                return (
                  <div className="bg-background border rounded-lg shadow-lg p-2 text-sm">
                    <p className="font-medium">{data.dateLabel}</p>
                    <p style={{ color }}>
                      {formatNumber(data.value)} {unit}
                    </p>
                  </div>
                )
              }
              return null
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={{ r: 3, fill: color }}
            activeDot={{ r: 5, stroke: color, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
