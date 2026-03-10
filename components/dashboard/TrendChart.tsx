'use client'

import { useMemo } from 'react'
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatNumber } from '@/lib/utils'
import { convertUnit, getStandardUnit } from '@/lib/ocr/unit-converter'
import { unitsAreEquivalent } from '@/lib/ocr/unit-normalizer'

interface TestResult {
  id: string
  value: number
  ref_min: number | null
  ref_max: number | null
  status: string
  unit: string | null
  standard_items_master: {
    name: string
    display_name_ko: string | null
    default_unit?: string | null
    description_common?: string | null
    description_high?: string | null
    description_low?: string | null
  }
}

interface TestRecord {
  id: string
  test_date: string
  hospital_name?: string | null
  test_results: TestResult[]
}

interface TrendChartProps {
  records: TestRecord[]
  itemName: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  dateFrom?: string | null
  dateTo?: string | null
}

// 참고치 구간을 나타내는 인터페이스
interface RefRangeSegment {
  startDate: string
  endDate: string
  ref_min: number | null
  ref_max: number | null
  dataCount: number
}

export function TrendChart({ records, itemName, open, onOpenChange, dateFrom, dateTo }: TrendChartProps) {
  // 기간 필터 적용
  const filteredRecords = useMemo(() => {
    if (!dateFrom && !dateTo) return records
    return records.filter(record => {
      if (dateFrom && record.test_date < dateFrom) return false
      if (dateTo && record.test_date > dateTo) return false
      return true
    })
  }, [records, dateFrom, dateTo])

  const chartData = useMemo(() => {
    if (!itemName) return null

    const dataPoints = filteredRecords
      .map(record => {
        // 동일 항목의 중복 결과가 있을 경우 마지막 값을 선택 (PivotTable과 일관성 유지)
        const matchingResults = record.test_results.filter(
          r => r.standard_items_master.name === itemName
        )
        const result = matchingResults[matchingResults.length - 1]
        if (!result) return null

        const measuredUnit = result.unit
        let value = result.value
        let refMin = result.ref_min
        let refMax = result.ref_max
        let displayUnit: string | null = result.standard_items_master.default_unit || measuredUnit
        let originalValue: number | null = null
        let originalUnit: string | null = null
        let isConverted = false

        // 표준 단위로 변환 시도
        if (itemName && measuredUnit) {
          const standardUnit = getStandardUnit(itemName)
          if (standardUnit && !unitsAreEquivalent(measuredUnit, standardUnit)) {
            const conv = convertUnit(itemName, result.value, measuredUnit)
            if (conv.success && conv.convertedValue !== null && conv.standardUnit) {
              originalValue = result.value
              originalUnit = measuredUnit
              value = conv.convertedValue
              displayUnit = conv.standardUnit
              isConverted = true
              // 참고치도 동일하게 변환
              if (refMin !== null) {
                const refConv = convertUnit(itemName, refMin, measuredUnit)
                if (refConv.success && refConv.convertedValue !== null) {
                  refMin = refConv.convertedValue
                }
              }
              if (refMax !== null) {
                const refConv = convertUnit(itemName, refMax, measuredUnit)
                if (refConv.success && refConv.convertedValue !== null) {
                  refMax = refConv.convertedValue
                }
              }
            }
          }
        }

        return {
          date: record.test_date,
          dateLabel: new Date(record.test_date).toLocaleDateString('ko-KR', {
            year: '2-digit',
            month: 'numeric',
            day: 'numeric'
          }),
          value,
          ref_min: refMin,
          ref_max: refMax,
          status: result.status,
          unit: displayUnit,
          displayName: result.standard_items_master.display_name_ko || result.standard_items_master.name,
          hospitalName: record.hospital_name || null,
          originalValue,
          originalUnit,
          isConverted,
          descriptionCommon: result.standard_items_master.description_common || null,
          descriptionHigh: result.standard_items_master.description_high || null,
          descriptionLow: result.standard_items_master.description_low || null,
        }
      })
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .reverse() // 날짜 오름차순

    if (dataPoints.length === 0) return null

    // 참고치 변경 구간 계산
    const refRangeSegments: RefRangeSegment[] = []
    let currentSegment: RefRangeSegment | null = null

    dataPoints.forEach((point, index) => {
      const refChanged = currentSegment === null ||
        currentSegment.ref_min !== point.ref_min ||
        currentSegment.ref_max !== point.ref_max

      if (refChanged) {
        if (currentSegment) {
          currentSegment.endDate = dataPoints[index - 1].dateLabel
          refRangeSegments.push(currentSegment)
        }
        currentSegment = {
          startDate: point.dateLabel,
          endDate: point.dateLabel,
          ref_min: point.ref_min,
          ref_max: point.ref_max,
          dataCount: 1
        }
      } else {
        if (currentSegment) {
          currentSegment.dataCount++
          currentSegment.endDate = point.dateLabel
        }
      }
    })

    // 마지막 구간 추가
    if (currentSegment) {
      refRangeSegments.push(currentSegment)
    }

    // 참고치 범위 계산 (가장 최근 값 사용)
    const latestPoint = dataPoints[dataPoints.length - 1]
    const refMin = latestPoint?.ref_min
    const refMax = latestPoint?.ref_max

    // 참고치가 하나라도 다른지 확인
    const hasMultipleRefRanges = refRangeSegments.length > 1

    // 참고치가 하나라도 있는지 확인
    const hasAnyRefRange = dataPoints.some(d => d.ref_min !== null || d.ref_max !== null)

    // Y축 domain 계산 (모든 값, ref_min, ref_max 포함)
    const allYValues = dataPoints.flatMap(d => [
      d.value,
      d.ref_min,
      d.ref_max
    ]).filter((v): v is number => v !== null)

    const yMin = Math.min(...allYValues)
    const yMax = Math.max(...allYValues)
    // 약간의 패딩 추가
    const yPadding = (yMax - yMin) * 0.1 || 1
    const yDomain: [number, number] = [
      Math.max(0, yMin - yPadding),
      yMax + yPadding
    ]

    const hasAnyConversion = dataPoints.some(d => d.isConverted)

    return {
      data: dataPoints,
      refMin,
      refMax,
      refRangeSegments,
      hasMultipleRefRanges,
      hasAnyRefRange,
      hasAnyConversion,
      yDomain,
      unit: latestPoint?.unit || '',
      displayName: latestPoint?.displayName || itemName,
      descriptionCommon: latestPoint?.descriptionCommon || null,
      descriptionHigh: latestPoint?.descriptionHigh || null,
      descriptionLow: latestPoint?.descriptionLow || null,
    }
  }, [filteredRecords, itemName])

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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pr-8">
          <DialogTitle>
            {chartData.displayName} ({itemName})
          </DialogTitle>
          <DialogDescription>
            시계열 트렌드 분석 - 총 {chartData.data.length}개 데이터 포인트
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart
              data={chartData.data}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="dateLabel"
                angle={-45}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                domain={chartData.yDomain}
                label={{ value: chartData.unit, angle: -90, position: 'insideLeft' }}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload
                    return (
                      <div className="bg-background border rounded-lg shadow-lg p-3 z-50">
                        <p className="font-medium">{data.dateLabel}</p>
                        {data.hospitalName && (
                          <p className="text-xs text-muted-foreground">{data.hospitalName}</p>
                        )}
                        <p className="text-sm mt-1">
                          값: <span className="font-semibold">{formatNumber(data.value)} {data.unit}</span>
                        </p>
                        {data.isConverted && data.originalValue !== null && (
                          <p className="text-xs text-amber-600">
                            원본: {formatNumber(data.originalValue)} {data.originalUnit}
                          </p>
                        )}
                        {(data.ref_min !== null || data.ref_max !== null) && (
                          <p className="text-xs text-muted-foreground">
                            참고치: {data.ref_min !== null ? formatNumber(data.ref_min) : '-'} ~ {data.ref_max !== null ? formatNumber(data.ref_max) : '-'} {data.unit}
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

              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={(props) => {
                  const { cx, cy, payload } = props

                  // cx, cy가 없으면 렌더링하지 않음
                  if (cx === undefined || cy === undefined) return null

                  const statusColor = payload.status === 'High' ? '#ef4444' : payload.status === 'Low' ? '#3b82f6' : '#22c55e'

                  // 참고치 범위가 있으면 수직 바 그리기
                  const refMin = payload.ref_min
                  const refMax = payload.ref_max
                  const value = payload.value

                  const [, yDomainMax] = chartData.yDomain

                  // cy를 기준으로 상대적인 Y 좌표 계산
                  // cy는 value의 정확한 위치이므로, 이를 anchor로 사용
                  // cy = plotTop + (yDomainMax - value) * pixelsPerUnit
                  // pixelsPerUnit = (cy - plotTop) / (yDomainMax - value)

                  const plotTop = 5
                  const yDiff = yDomainMax - value

                  // yDiff가 0에 가까우면 기본 scale 사용 (310px / yRange)
                  const yRange = chartData.yDomain[1] - chartData.yDomain[0]
                  const pixelsPerUnit = Math.abs(yDiff) < 0.001
                    ? 310 / yRange
                    : (cy - plotTop) / yDiff

                  if (refMin !== null && refMax !== null) {
                    // cy 기준 상대 좌표 계산
                    const yRefMin = cy + (value - refMin) * pixelsPerUnit
                    const yRefMax = cy + (value - refMax) * pixelsPerUnit
                    const barWidth = 10

                    return (
                      <g>
                        {/* 참고치 범위 수직 바 (배경) */}
                        <rect
                          x={cx - barWidth / 2}
                          y={yRefMax}
                          width={barWidth}
                          height={Math.abs(yRefMin - yRefMax)}
                          fill="#22c55e"
                          fillOpacity={0.25}
                          rx={2}
                        />
                        {/* 상한선 */}
                        <line
                          x1={cx - barWidth}
                          y1={yRefMax}
                          x2={cx + barWidth}
                          y2={yRefMax}
                          stroke="#ef4444"
                          strokeWidth={2}
                        />
                        {/* 하한선 */}
                        <line
                          x1={cx - barWidth}
                          y1={yRefMin}
                          x2={cx + barWidth}
                          y2={yRefMin}
                          stroke="#3b82f6"
                          strokeWidth={2}
                        />
                        {/* 수직 연결선 */}
                        <line
                          x1={cx}
                          y1={yRefMax}
                          x2={cx}
                          y2={yRefMin}
                          stroke="#9ca3af"
                          strokeWidth={1}
                          strokeDasharray="3 3"
                        />
                        {/* 데이터 포인트 */}
                        <circle cx={cx} cy={cy} r={5} fill={statusColor} stroke="white" strokeWidth={2} />
                      </g>
                    )
                  }

                  return (
                    <circle cx={cx} cy={cy} r={5} fill={statusColor} stroke="white" strokeWidth={2} />
                  )
                }}
                activeDot={{ r: 7, stroke: 'hsl(var(--primary))', strokeWidth: 2 }}
                name={chartData.displayName}
              />
            </ComposedChart>
          </ResponsiveContainer>

          <div className="mt-4 p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2">분석 요약</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">최소값</p>
                <p className="font-medium">
                  {formatNumber(Math.min(...chartData.data.map(d => d.value)))} {chartData.unit}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">최대값</p>
                <p className="font-medium">
                  {formatNumber(Math.max(...chartData.data.map(d => d.value)))} {chartData.unit}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">평균</p>
                <p className="font-medium">
                  {formatNumber(parseFloat((chartData.data.reduce((sum, d) => sum + d.value, 0) / chartData.data.length).toFixed(2)))} {chartData.unit}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">최근값</p>
                <p className="font-medium">
                  {formatNumber(chartData.data[chartData.data.length - 1].value)} {chartData.unit}
                </p>
              </div>
            </div>
            {/* 항목 설명 */}
            {(chartData.descriptionCommon || chartData.descriptionHigh || chartData.descriptionLow) && (
              <div className="mt-3 pt-3 border-t">
                {chartData.descriptionCommon && (
                  <p className="text-sm text-muted-foreground mb-2">{chartData.descriptionCommon}</p>
                )}
                {(chartData.descriptionHigh || chartData.descriptionLow) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    {chartData.descriptionHigh && (
                      <div className="flex items-start gap-1.5">
                        <span className="text-red-500 flex-shrink-0">🔴 높을 때:</span>
                        <span className="text-muted-foreground">{chartData.descriptionHigh}</span>
                      </div>
                    )}
                    {chartData.descriptionLow && (
                      <div className="flex items-start gap-1.5">
                        <span className="text-blue-500 flex-shrink-0">🔵 낮을 때:</span>
                        <span className="text-muted-foreground">{chartData.descriptionLow}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {/* 참고치 변경 이력 */}
            <div className="mt-3 pt-3 border-t">
              <p className="text-sm font-medium mb-2">
                참고치 이력
                {chartData.hasMultipleRefRanges && (
                  <span className="ml-2 text-xs text-orange-500 font-normal">
                    ⚠️ 참고치가 {chartData.refRangeSegments.length}회 변경됨
                  </span>
                )}
              </p>
              {chartData.hasAnyRefRange ? (
                <div className="space-y-1">
                  {chartData.refRangeSegments.map((segment, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm flex-wrap">
                      <span className="text-muted-foreground min-w-[100px]">
                        {segment.startDate === segment.endDate
                          ? segment.startDate
                          : `${segment.startDate} ~ ${segment.endDate}`}
                      </span>
                      <span className="font-medium">
                        {segment.ref_min !== null ? formatNumber(segment.ref_min) : '-'} ~ {segment.ref_max !== null ? formatNumber(segment.ref_max) : '-'} {chartData.unit}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({segment.dataCount}건)
                      </span>
                      {index === chartData.refRangeSegments.length - 1 && (
                        <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">최근</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  참고치 정보가 없습니다. (검사지에 참고 범위가 기록되지 않았거나 OCR에서 인식되지 않았습니다)
                </p>
              )}
            </div>
            <div className="mt-3 pt-3 border-t">
              <p className="text-sm text-muted-foreground mb-2">범례:</p>
              <div className="flex flex-wrap gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-[#ef4444]"></span>
                  <span>High (기준치 초과)</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-[#22c55e]"></span>
                  <span>Normal (정상 범위)</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-[#3b82f6]"></span>
                  <span>Low (기준치 미만)</span>
                </div>
              </div>
              {chartData.hasAnyRefRange && (
                <div className="flex flex-wrap gap-4 text-xs mt-2">
                  <div className="flex items-center gap-1">
                    <svg width="20" height="16" className="flex-shrink-0">
                      <rect x="6" y="2" width="8" height="12" fill="#22c55e" fillOpacity="0.2" rx="1" />
                      <line x1="4" y1="2" x2="16" y2="2" stroke="#ef4444" strokeWidth="2" />
                      <line x1="4" y1="14" x2="16" y2="14" stroke="#3b82f6" strokeWidth="2" />
                    </svg>
                    <span>참고치 범위 (빨강=상한, 파랑=하한)</span>
                  </div>
                </div>
              )}
            </div>
            {chartData.hasAnyConversion && (
              <p className="mt-2 text-xs text-amber-600">
                * 일부 데이터가 비교를 위해 표준 단위({chartData.unit})로 변환되었습니다. 툴팁에서 원본 값을 확인할 수 있습니다.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
