'use client'

import React, { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SimpleTooltip } from '@/components/ui/simple-tooltip'
import { AlertCircle } from 'lucide-react'

interface TestResult {
  id: string
  standard_item_id: string
  value: number
  ref_min: number | null
  ref_max: number | null
  ref_text: string | null
  status: string
  unit: string | null
  standard_items: {
    name: string
    display_name_ko: string | null
    category: string | null
  }
}

interface TestRecord {
  id: string
  test_date: string
  hospital_name: string | null
  test_results: TestResult[]
}

interface PivotTableProps {
  records: TestRecord[]
  onItemClick?: (itemName: string) => void
}

export function PivotTable({ records, onItemClick }: PivotTableProps) {
  // 피벗 데이터 구조 생성
  const pivotData = useMemo(() => {
    // 모든 고유 항목 수집
    const allItems = new Set<string>()
    const itemDetails = new Map<string, { name: string; ko: string; category: string; refRangeDisplay: string | null }>()

    // 각 항목별로 고유한 참고치 개수 추적
    const refRangesByItem = new Map<string, Set<string>>()

    records.forEach(record => {
      record.test_results.forEach(result => {
        const itemName = result.standard_items.name
        allItems.add(itemName)

        if (!itemDetails.has(itemName)) {
          itemDetails.set(itemName, {
            name: itemName,
            ko: result.standard_items.display_name_ko || itemName,
            category: result.standard_items.category || 'Other',
            refRangeDisplay: null
          })
        }

        // 참고치 추적
        if (result.ref_text) {
          if (!refRangesByItem.has(itemName)) {
            refRangesByItem.set(itemName, new Set())
          }
          refRangesByItem.get(itemName)!.add(result.ref_text)
        } else if (result.ref_min !== null || result.ref_max !== null) {
          // ref_text가 없으면 ref_min-ref_max로 생성
          const refRange = `${result.ref_min ?? '?'}-${result.ref_max ?? '?'}`
          if (!refRangesByItem.has(itemName)) {
            refRangesByItem.set(itemName, new Set())
          }
          refRangesByItem.get(itemName)!.add(refRange)
        }
      })
    })

    // 참고치 표시 결정: 단일 참고치면 그 값을, 여러 참고치면 "여러 참고치 적용됨"
    refRangesByItem.forEach((refRanges, itemName) => {
      const detail = itemDetails.get(itemName)
      if (detail) {
        if (refRanges.size === 1) {
          detail.refRangeDisplay = Array.from(refRanges)[0]
        } else if (refRanges.size > 1) {
          detail.refRangeDisplay = '여러 참고치 적용됨'
        }
      }
    })

    // 카테고리별로 항목 그룹화 및 정렬
    const itemsByCategory = new Map<string, string[]>()
    itemDetails.forEach((detail, itemName) => {
      const category = detail.category
      if (!itemsByCategory.has(category)) {
        itemsByCategory.set(category, [])
      }
      itemsByCategory.get(category)!.push(itemName)
    })

    // 각 카테고리 내에서 항목 정렬
    itemsByCategory.forEach((items) => {
      items.sort()
    })

    // 날짜별 데이터 맵 생성
    const dateMap = new Map<string, Map<string, TestResult>>()
    records.forEach(record => {
      const resultMap = new Map<string, TestResult>()
      record.test_results.forEach(result => {
        resultMap.set(result.standard_items.name, result)
      })
      dateMap.set(record.test_date, resultMap)
    })

    return { itemsByCategory, itemDetails, dateMap }
  }, [records])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'High':
        return 'bg-red-100 dark:bg-red-950/30 text-red-900 dark:text-red-100'
      case 'Low':
        return 'bg-blue-100 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100'
      case 'Normal':
        return 'bg-green-50 dark:bg-green-950/20'
      default:
        return ''
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'High':
        return '🔴'
      case 'Low':
        return '🔵'
      case 'Normal':
        return '🟢'
      default:
        return ''
    }
  }

  // 이전 검사와 참고치가 변경되었는지 확인
  const hasRefRangeChanged = (currentRecord: TestRecord, itemName: string): { changed: boolean; previousRef: string | null } => {
    const currentIndex = records.findIndex(r => r.id === currentRecord.id)
    if (currentIndex <= 0) return { changed: false, previousRef: null }

    const currentResult = currentRecord.test_results.find(r => r.standard_items.name === itemName)
    if (!currentResult) return { changed: false, previousRef: null }

    // 이전 검사 결과 찾기
    for (let i = currentIndex - 1; i >= 0; i--) {
      const previousResult = records[i].test_results.find(r => r.standard_items.name === itemName)
      if (previousResult) {
        const currentRef = currentResult.ref_text || `${currentResult.ref_min}-${currentResult.ref_max}`
        const previousRef = previousResult.ref_text || `${previousResult.ref_min}-${previousResult.ref_max}`

        if (currentRef !== previousRef) {
          return { changed: true, previousRef: previousResult.ref_text || previousRef }
        }
        return { changed: false, previousRef: null }
      }
    }

    return { changed: false, previousRef: null }
  }

  if (records.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">데이터가 없습니다</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>검사 결과 피벗 테이블</CardTitle>
        <CardDescription>
          항목을 클릭하면 시계열 그래프를 볼 수 있습니다
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="sticky left-0 bg-background p-3 text-left font-medium border-r">
                  항목
                </th>
                {records.map((record) => (
                  <th key={record.id} className="p-3 text-center font-medium min-w-[120px]">
                    <div>
                      {new Date(record.test_date).toLocaleDateString('ko-KR', {
                        year: '2-digit',
                        month: 'numeric',
                        day: 'numeric'
                      })}
                    </div>
                    {record.hospital_name && (
                      <div className="text-xs text-muted-foreground font-normal mt-1">
                        {record.hospital_name}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from(pivotData.itemsByCategory.entries()).map(([category, items]) => (
                <React.Fragment key={category}>
                  <tr className="bg-muted/50">
                    <td colSpan={records.length + 1} className="p-2 font-semibold text-xs uppercase">
                      {category}
                    </td>
                  </tr>
                  {items.map((itemName) => {
                    const detail = pivotData.itemDetails.get(itemName)!
                    return (
                      <tr key={itemName} className="border-b hover:bg-muted/50">
                        <td
                          className="sticky left-0 bg-background p-3 border-r cursor-pointer hover:bg-accent"
                          onClick={() => onItemClick?.(itemName)}
                        >
                          <div className="font-medium">{detail.name}</div>
                          <div className="text-xs text-muted-foreground">{detail.ko}</div>
                          {detail.refRangeDisplay && (
                            <div className={`text-xs mt-1 ${detail.refRangeDisplay === '여러 참고치 적용됨' ? 'text-orange-600' : 'text-muted-foreground'}`}>
                              {detail.refRangeDisplay}
                            </div>
                          )}
                        </td>
                        {records.map((record) => {
                          const result = pivotData.dateMap.get(record.test_date)?.get(itemName)
                          const refChange = result ? hasRefRangeChanged(record, itemName) : { changed: false, previousRef: null }

                          return (
                            <td
                              key={`${record.id}-${itemName}`}
                              className={`p-3 text-center ${result ? getStatusColor(result.status) : ''}`}
                            >
                              {result ? (
                                <SimpleTooltip
                                  content={
                                    <div className="text-left space-y-1 max-w-xs">
                                      <div className="font-semibold border-b pb-1">
                                        {detail.name} ({detail.ko})
                                      </div>
                                      <div>검사일: {new Date(record.test_date).toLocaleDateString('ko-KR')}</div>
                                      <div>결과값: {result.value} {result.unit}</div>
                                      <div>
                                        참고치: {result.ref_text || `${result.ref_min ?? '?'}-${result.ref_max ?? '?'}`}
                                      </div>
                                      <div>상태: {getStatusIcon(result.status)} {result.status}</div>
                                      {record.hospital_name && (
                                        <div>병원: {record.hospital_name}</div>
                                      )}
                                      {refChange.changed && (
                                        <div className="text-orange-600 border-t pt-1 mt-1">
                                          ⚠️ 참고치 변경됨 (이전: {refChange.previousRef})
                                        </div>
                                      )}
                                    </div>
                                  }
                                  side="top"
                                >
                                  <div className="cursor-help">
                                    <div className="font-medium flex items-center justify-center gap-1">
                                      {getStatusIcon(result.status)} {result.value}
                                      {refChange.changed && (
                                        <AlertCircle className="w-3 h-3 text-orange-600 inline" />
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {result.unit}
                                    </div>
                                  </div>
                                </SimpleTooltip>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
