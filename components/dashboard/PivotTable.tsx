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

type SortType = 'by_exam_type' | 'by_organ' | 'by_clinical_priority' | 'by_panel'

interface PivotTableProps {
  records: TestRecord[]
  onItemClick?: (itemName: string) => void
  sortType?: SortType
  organFilter?: string | null
  panelFilter?: string | null
}

// 숫자를 소수점 첫째자리까지 표시 (정수면 그대로)
function formatValue(value: number): string {
  if (Number.isInteger(value)) {
    return value.toString()
  }
  return value.toFixed(1)
}

// 0값 여부 확인 (측정된 0 vs 데이터 없음 구분)
function isZeroValue(value: number): boolean {
  return value === 0
}

// 패널별 아이템 매핑
const PANEL_ITEMS: Record<string, string[]> = {
  'Basic': ['WBC', 'RBC', 'HGB', 'HCT', 'PLT', 'ALT', 'BUN', 'Creatinine', 'Glucose', 'Protein-Total'],
  'Pre-anesthetic': ['WBC', 'RBC', 'HGB', 'HCT', 'PLT', 'ALT', 'AST', 'BUN', 'Creatinine', 'Glucose', 'Protein-Total', 'Albumin', 'PT', 'APTT'],
  'Senior': ['WBC', 'RBC', 'HGB', 'HCT', 'PLT', 'ALT', 'AST', 'ALKP', 'GGT', 'BUN', 'Creatinine', 'SDMA', 'Glucose', 'Protein-Total', 'Albumin', 'T.Cholesterol', 'Triglycerides', 'T.Bilirubin', 'Phosphorus', 'Calcium', 'Na', 'K', 'Cl', 'CRP', 'UPC', '요비중'],
  'Pancreatitis': ['cPL', 'Lipase', 'Amylase', 'Glucose', 'Triglycerides', 'Calcium', 'CRP', 'WBC'],
  'Coagulation': ['PLT', 'PT', 'APTT', 'Fibrinogen', 'D-dimer', 'TEG_R', 'TEG_K', 'TEG_Angle', 'TEG_MA'],
  'Emergency': ['pH', 'pCO2', 'pO2', 'cHCO3', 'BE', 'Lactate', 'Na', 'K', 'Cl', 'Calcium', 'HCT', 'HGB', 'Glucose'],
  'Cardiac': ['proBNP', '심장사상충', 'E', 'LVIDd', 'Systolic BP', 'CK'],
  'Kidney': ['BUN', 'Creatinine', 'BUN:Cr Ratio', 'SDMA', 'Phosphorus', 'Calcium', 'UPC', 'PH(뇨)', '요비중', 'mOsm', 'K', 'Na', 'Albumin'],
}

const PANEL_LABELS: Record<string, string> = {
  'Basic': '기본 혈액검사',
  'Pre-anesthetic': '마취 전 검사',
  'Senior': '노령견 종합',
  'Pancreatitis': '췌장염 집중',
  'Coagulation': '응고 검사',
  'Emergency': '응급/중환자',
  'Cardiac': '심장 검사',
  'Kidney': '신장 집중',
}

// 장기별 아이템 매핑 (v3 마스터 데이터 기반)
const ORGAN_ITEMS: Record<string, string[]> = {
  '기본신체': ['BT', 'BW', 'Pulse', 'Systolic BP'],
  '혈액': ['HCT', 'HGB', 'RBC', 'WBC', 'PLT', 'NEU', 'LYM', 'MONO', 'EOS', 'BASO', 'RDW', 'MCV', 'MCH', 'MCHC'],
  '간': ['ALT', 'AST', 'ALKP', 'GGT', 'T.Bilirubin', 'NH3', 'Albumin', 'Globulin', 'Protein-Total'],
  '신장': ['BUN', 'Creatinine', 'SDMA', 'Phosphorus', 'UPC', 'PH(뇨)', '요비중', 'mOsm'],
  '췌장': ['Lipase', 'Amylase', 'cPL', 'Glucose', 'Triglycerides'],
  '심장': ['proBNP', '심장사상충', 'CK', 'LDH', 'E', 'LVIDd', 'Pulse', 'Systolic BP'],
  '전해질': ['Na', 'K', 'Cl', 'Calcium', 'Phosphorus', 'NA/K'],
  '산염기': ['pH', 'pH(T)', 'pCO2', 'pCO2(T)', 'cHCO3', 'BE', 'Lactate', 'Anion Gap'],
  '호흡': ['pO2', 'pO2(T)', 'sO2', 'ctO2'],
  '지혈': ['PLT', 'PT', 'APTT', 'Fibrinogen', 'D-dimer', 'MPV', 'PDW', 'PCT'],
  '안과': ['눈물량(OD)', '눈물량(OS)', '안압(OD)', '안압(OS)'],
}

export function PivotTable({ records, onItemClick, sortType = 'by_exam_type', organFilter, panelFilter }: PivotTableProps) {
  // 날짜순으로 정렬 (오래된 날짜가 왼쪽, 최신이 오른쪽)
  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) =>
      new Date(a.test_date).getTime() - new Date(b.test_date).getTime()
    )
  }, [records])

  // 피벗 데이터 구조 생성
  const pivotData = useMemo(() => {
    // 모든 고유 항목 수집
    const allItems = new Set<string>()
    const itemDetails = new Map<string, { name: string; ko: string; category: string; refRangeDisplay: string | null }>()

    // 각 항목별로 고유한 참고치 개수 추적
    const refRangesByItem = new Map<string, Set<string>>()

    sortedRecords.forEach(record => {
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

    // 정렬 유형에 따라 항목 그룹화 및 정렬
    const itemsByCategory = new Map<string, string[]>()

    // 검사유형 순서
    const examTypeOrder = ['Vital', 'CBC', 'Chemistry', 'Special', 'Blood Gas', 'Coagulation', '뇨검사', '안과검사', 'Echo']

    if (sortType === 'by_organ' && organFilter) {
      // 특정 장기 필터링
      const organItemNames = ORGAN_ITEMS[organFilter] || []
      const filteredItems = Array.from(itemDetails.keys()).filter(name => organItemNames.includes(name))
      if (filteredItems.length > 0) {
        itemsByCategory.set(organFilter, filteredItems.sort())
      }
    } else if (sortType === 'by_organ') {
      // 장기별 그룹화
      const organOrder = Object.keys(ORGAN_ITEMS)
      organOrder.forEach(organ => {
        const organItemNames = ORGAN_ITEMS[organ] || []
        const matchedItems = Array.from(itemDetails.keys()).filter(name => organItemNames.includes(name))
        if (matchedItems.length > 0) {
          itemsByCategory.set(organ, matchedItems.sort())
        }
      })
      // 기타 항목
      const allOrganItems = Object.values(ORGAN_ITEMS).flat()
      const otherItems = Array.from(itemDetails.keys()).filter(name => !allOrganItems.includes(name))
      if (otherItems.length > 0) {
        itemsByCategory.set('기타', otherItems.sort())
      }
    } else if (sortType === 'by_panel' && panelFilter) {
      // 특정 패널 필터링
      const panelItemNames = PANEL_ITEMS[panelFilter] || []
      const filteredItems = Array.from(itemDetails.keys()).filter(name => panelItemNames.includes(name))
      if (filteredItems.length > 0) {
        itemsByCategory.set(PANEL_LABELS[panelFilter] || panelFilter, filteredItems.sort())
      }
    } else if (sortType === 'by_panel') {
      // 패널별 그룹화
      Object.entries(PANEL_ITEMS).forEach(([panel, panelItemNames]) => {
        const matchedItems = Array.from(itemDetails.keys()).filter(name => panelItemNames.includes(name))
        if (matchedItems.length > 0) {
          itemsByCategory.set(PANEL_LABELS[panel] || panel, matchedItems.sort())
        }
      })
    } else {
      // 기본: 검사유형별 (by_exam_type)
      itemDetails.forEach((detail, itemName) => {
        const category = detail.category
        if (!itemsByCategory.has(category)) {
          itemsByCategory.set(category, [])
        }
        itemsByCategory.get(category)!.push(itemName)
      })

      // 검사유형 순서대로 정렬
      const sortedByCategory = new Map<string, string[]>()
      examTypeOrder.forEach(type => {
        if (itemsByCategory.has(type)) {
          sortedByCategory.set(type, itemsByCategory.get(type)!.sort())
        }
      })
      // 나머지 카테고리
      itemsByCategory.forEach((items, category) => {
        if (!sortedByCategory.has(category)) {
          sortedByCategory.set(category, items.sort())
        }
      })
      itemsByCategory.clear()
      sortedByCategory.forEach((items, category) => {
        itemsByCategory.set(category, items)
      })
    }

    // 각 그룹 내에서 항목 정렬
    itemsByCategory.forEach((items) => {
      items.sort()
    })

    // 날짜별 데이터 맵 생성
    const dateMap = new Map<string, Map<string, TestResult>>()
    sortedRecords.forEach(record => {
      const resultMap = new Map<string, TestResult>()
      record.test_results.forEach(result => {
        resultMap.set(result.standard_items.name, result)
      })
      dateMap.set(record.test_date, resultMap)
    })

    return { itemsByCategory, itemDetails, dateMap }
  }, [sortedRecords, sortType, organFilter, panelFilter])

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
    const currentIndex = sortedRecords.findIndex(r => r.id === currentRecord.id)
    if (currentIndex <= 0) return { changed: false, previousRef: null }

    const currentResult = currentRecord.test_results.find(r => r.standard_items.name === itemName)
    if (!currentResult) return { changed: false, previousRef: null }

    // 이전 검사 결과 찾기
    for (let i = currentIndex - 1; i >= 0; i--) {
      const previousResult = sortedRecords[i].test_results.find(r => r.standard_items.name === itemName)
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

  if (sortedRecords.length === 0) {
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
      <CardContent className="px-0 sm:px-6">
        <div className="overflow-auto max-h-[70vh]">
          <table className="w-full border-collapse text-xs sm:text-sm">
            <thead className="sticky top-0 z-30 bg-background">
              <tr className="border-b">
                <th className="sticky left-0 z-40 bg-background p-2 sm:p-3 text-left font-medium border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[100px] sm:min-w-[150px]">
                  항목
                </th>
                {sortedRecords.map((record) => (
                  <th key={record.id} className="p-2 sm:p-3 text-center font-medium min-w-[70px] sm:min-w-[100px] bg-background">
                    <div className="text-xs sm:text-sm">
                      <div>{new Date(record.test_date).toLocaleDateString('ko-KR', {
                        year: '2-digit',
                        month: 'numeric',
                        day: 'numeric'
                      })}</div>
                      {record.hospital_name && <div className="text-[10px] sm:text-xs text-muted-foreground">{record.hospital_name}</div>}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from(pivotData.itemsByCategory.entries()).map(([category, items]) => (
                <React.Fragment key={category}>
                  <tr className="bg-muted/50">
                    <td className="sticky left-0 z-20 p-2 font-semibold text-[10px] sm:text-xs uppercase bg-muted/50 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      {category}
                    </td>
                    {sortedRecords.map((record) => (
                      <td key={record.id} className="bg-muted/50"></td>
                    ))}
                  </tr>
                  {items.map((itemName) => {
                    const detail = pivotData.itemDetails.get(itemName)!
                    return (
                      <tr key={itemName} className="border-b hover:bg-muted/50">
                        <td
                          className="sticky left-0 z-10 bg-background p-2 sm:p-3 border-r cursor-pointer hover:bg-accent shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] align-top min-w-[100px] sm:min-w-[150px]"
                          onClick={() => onItemClick?.(itemName)}
                        >
                          <div className="font-medium text-xs sm:text-sm truncate max-w-[90px] sm:max-w-none">{detail.name}</div>
                          <div className="text-[10px] sm:text-xs text-muted-foreground truncate max-w-[90px] sm:max-w-none">{detail.ko}</div>
                          {detail.refRangeDisplay && (
                            <div className={`text-[10px] sm:text-xs mt-0.5 sm:mt-1 truncate max-w-[90px] sm:max-w-none ${detail.refRangeDisplay === '여러 참고치 적용됨' ? 'text-orange-600' : 'text-muted-foreground'}`}>
                              {detail.refRangeDisplay}
                            </div>
                          )}
                        </td>
                        {sortedRecords.map((record) => {
                          const result = pivotData.dateMap.get(record.test_date)?.get(itemName)
                          const refChange = result ? hasRefRangeChanged(record, itemName) : { changed: false, previousRef: null }

                          return (
                            <td
                              key={`${record.id}-${itemName}`}
                              className={`p-1 sm:p-3 text-center align-top ${result ? getStatusColor(result.status) : ''}`}
                            >
                              {result ? (
                                <SimpleTooltip
                                  content={
                                    <div className="text-left space-y-1 max-w-xs">
                                      <div className="font-semibold border-b pb-1">
                                        {detail.name} ({detail.ko})
                                      </div>
                                      <div>검사일: {new Date(record.test_date).toLocaleDateString('ko-KR')}</div>
                                      <div>
                                        결과값: {formatValue(result.value)} {result.unit}
                                        {isZeroValue(result.value) && (
                                          <span className="text-xs text-muted-foreground ml-1">(측정값)</span>
                                        )}
                                      </div>
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
                                      {getStatusIcon(result.status)} {formatValue(result.value)}
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
                                <span className="text-muted-foreground/50 text-lg">-</span>
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
