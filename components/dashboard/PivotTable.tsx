'use client'

import React, { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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
    const itemDetails = new Map<string, { name: string; ko: string; category: string }>()
    
    records.forEach(record => {
      record.test_results.forEach(result => {
        const itemName = result.standard_items.name
        allItems.add(itemName)
        if (!itemDetails.has(itemName)) {
          itemDetails.set(itemName, {
            name: itemName,
            ko: result.standard_items.display_name_ko || itemName,
            category: result.standard_items.category || 'Other'
          })
        }
      })
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
                        </td>
                        {records.map((record) => {
                          const result = pivotData.dateMap.get(record.test_date)?.get(itemName)
                          return (
                            <td
                              key={`${record.id}-${itemName}`}
                              className={`p-3 text-center ${result ? getStatusColor(result.status) : ''}`}
                            >
                              {result ? (
                                <div>
                                  <div className="font-medium">
                                    {getStatusIcon(result.status)} {result.value}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {result.unit}
                                  </div>
                                  {result.ref_text && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {result.ref_text}
                                    </div>
                                  )}
                                </div>
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
