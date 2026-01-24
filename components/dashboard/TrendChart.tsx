'use client'

import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface TestResult {
  id: string
  value: number
  ref_min: number | null
  ref_max: number | null
  status: string
  unit: string | null
  standard_items: {
    name: string
    display_name_ko: string | null
  }
}

interface TestRecord {
  id: string
  test_date: string
  test_results: TestResult[]
}

interface TrendChartProps {
  records: TestRecord[]
  itemName: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TrendChart({ records, itemName, open, onOpenChange }: TrendChartProps) {
  const chartData = useMemo(() => {
    if (!itemName) return null

    const dataPoints = records
      .map(record => {
        const result = record.test_results.find(
          r => r.standard_items.name === itemName
        )
        if (!result) return null

        return {
          date: record.test_date,
          dateLabel: new Date(record.test_date).toLocaleDateString('ko-KR', {
            year: '2-digit',
            month: 'numeric',
            day: 'numeric'
          }),
          value: result.value,
          ref_min: result.ref_min,
          ref_max: result.ref_max,
          status: result.status,
          unit: result.unit,
          displayName: result.standard_items.display_name_ko || result.standard_items.name
        }
      })
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .reverse() // 날짜 오름차순

    if (dataPoints.length === 0) return null

    // 참고치 범위 계산 (가장 최근 값 사용)
    const latestPoint = dataPoints[dataPoints.length - 1]
    const refMin = latestPoint?.ref_min
    const refMax = latestPoint?.ref_max

    return {
      data: dataPoints,
      refMin,
      refMax,
      unit: latestPoint?.unit || '',
      displayName: latestPoint?.displayName || itemName
    }
  }, [records, itemName])

  if (!chartData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{itemName}</DialogTitle>
            <DialogDescription>
              이 항목의 데이터가 없습니다
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {chartData.displayName} ({itemName})
          </DialogTitle>
          <DialogDescription>
            시계열 트렌드 분석 - 총 {chartData.data.length}개 데이터 포인트
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <ResponsiveContainer width="100%" height={400}>
            <LineChart
              data={chartData.data}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="dateLabel"
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                label={{ value: chartData.unit, angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload
                    return (
                      <div className="bg-background border rounded-lg shadow-lg p-3">
                        <p className="font-medium">{data.dateLabel}</p>
                        <p className="text-sm">
                          값: <span className="font-semibold">{data.value} {data.unit}</span>
                        </p>
                        {data.ref_min !== null && data.ref_max !== null && (
                          <p className="text-xs text-muted-foreground">
                            참고: {data.ref_min} - {data.ref_max}
                          </p>
                        )}
                        <p className="text-sm">
                          상태: {data.status === 'High' ? '🔴 High' : data.status === 'Low' ? '🔵 Low' : '🟢 Normal'}
                        </p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Legend />
              
              {/* 참고치 범위 표시 */}
              {chartData.refMax !== null && (
                <ReferenceLine
                  y={chartData.refMax}
                  stroke="red"
                  strokeDasharray="5 5"
                  label={{ value: `Max: ${chartData.refMax}`, position: 'right', fill: 'red' }}
                />
              )}
              {chartData.refMin !== null && (
                <ReferenceLine
                  y={chartData.refMin}
                  stroke="blue"
                  strokeDasharray="5 5"
                  label={{ value: `Min: ${chartData.refMin}`, position: 'right', fill: 'blue' }}
                />
              )}

              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', r: 5 }}
                activeDot={{ r: 7 }}
                name={chartData.displayName}
              />
            </LineChart>
          </ResponsiveContainer>

          <div className="mt-4 p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2">분석 요약</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">최소값</p>
                <p className="font-medium">
                  {Math.min(...chartData.data.map(d => d.value))} {chartData.unit}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">최대값</p>
                <p className="font-medium">
                  {Math.max(...chartData.data.map(d => d.value))} {chartData.unit}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">평균</p>
                <p className="font-medium">
                  {(chartData.data.reduce((sum, d) => sum + d.value, 0) / chartData.data.length).toFixed(2)} {chartData.unit}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">최근값</p>
                <p className="font-medium">
                  {chartData.data[chartData.data.length - 1].value} {chartData.unit}
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
