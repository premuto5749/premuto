'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AppHeader } from '@/components/layout/AppHeader'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Upload, Loader2, CheckCircle2, Filter, X } from 'lucide-react'
import Link from 'next/link'
import { PivotTable } from '@/components/dashboard/PivotTable'
import { TrendChart } from '@/components/dashboard/TrendChart'

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
    default_unit: string | null
  }
}

interface TestRecord {
  id: string
  test_date: string
  hospital_name: string | null
  machine_type: string | null
  created_at: string
  test_results: TestResult[]
}

interface ItemInfo {
  name: string
  display_name_ko: string | null
  category: string | null
}

function DashboardContent() {
  const searchParams = useSearchParams()
  const saved = searchParams.get('saved')

  const [records, setRecords] = useState<TestRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [isChartOpen, setIsChartOpen] = useState(false)

  // 특정항목 모아보기 상태
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [tempSelectedItems, setTempSelectedItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchTestRecords()
  }, [])

  const fetchTestRecords = async () => {
    try {
      const response = await fetch('/api/test-results')
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '데이터 조회에 실패했습니다')
      }

      setRecords(result.data || [])
    } catch (err) {
      console.error('Fetch error:', err)
      setError(err instanceof Error ? err.message : '데이터 조회 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  // 모든 검사 항목 목록 추출 (카테고리별 그룹핑)
  const allItems = useMemo(() => {
    const itemMap = new Map<string, ItemInfo>()

    records.forEach(record => {
      record.test_results.forEach(result => {
        if (!itemMap.has(result.standard_items.name)) {
          itemMap.set(result.standard_items.name, {
            name: result.standard_items.name,
            display_name_ko: result.standard_items.display_name_ko,
            category: result.standard_items.category
          })
        }
      })
    })

    // 카테고리별로 그룹핑
    const byCategory = new Map<string, ItemInfo[]>()
    itemMap.forEach(item => {
      const category = item.category || 'Other'
      if (!byCategory.has(category)) {
        byCategory.set(category, [])
      }
      byCategory.get(category)!.push(item)
    })

    // 각 카테고리 내 정렬
    byCategory.forEach(items => {
      items.sort((a, b) => a.name.localeCompare(b.name))
    })

    return byCategory
  }, [records])

  // 필터링된 records
  const filteredRecords = useMemo(() => {
    if (selectedItems.size === 0) return records

    return records.map(record => ({
      ...record,
      test_results: record.test_results.filter(result =>
        selectedItems.has(result.standard_items.name)
      )
    })).filter(record => record.test_results.length > 0)
  }, [records, selectedItems])

  const handleItemClick = (itemName: string) => {
    setSelectedItem(itemName)
    setIsChartOpen(true)
  }

  const handleChartClose = (open: boolean) => {
    setIsChartOpen(open)
    if (!open) {
      setSelectedItem(null)
    }
  }

  const openFilterModal = () => {
    setTempSelectedItems(new Set(selectedItems))
    setIsFilterModalOpen(true)
  }

  const handleToggleItem = (itemName: string) => {
    const newSet = new Set(tempSelectedItems)
    if (newSet.has(itemName)) {
      newSet.delete(itemName)
    } else {
      newSet.add(itemName)
    }
    setTempSelectedItems(newSet)
  }

  const handleToggleCategory = (category: string) => {
    const items = allItems.get(category) || []
    const allSelected = items.every(item => tempSelectedItems.has(item.name))

    const newSet = new Set(tempSelectedItems)
    if (allSelected) {
      items.forEach(item => newSet.delete(item.name))
    } else {
      items.forEach(item => newSet.add(item.name))
    }
    setTempSelectedItems(newSet)
  }

  const handleApplyFilter = () => {
    setSelectedItems(tempSelectedItems)
    setIsFilterModalOpen(false)
  }

  const handleClearFilter = () => {
    setSelectedItems(new Set())
  }

  const isFiltering = selectedItems.size > 0

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <AppHeader title="검사 결과 대시보드" />
        <div className="container max-w-6xl mx-auto py-10">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <AppHeader title="검사 결과 대시보드" />

      <div className="container max-w-6xl mx-auto py-10 px-4">

      {saved && (
        <Card className="mb-6 border-green-500 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <p className="font-medium text-green-900 dark:text-green-100">
                검사 결과가 성공적으로 저장되었습니다!
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {records.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>저장된 검사 결과가 없습니다</CardTitle>
            <CardDescription>
              첫 번째 검사지를 업로드하여 데이터를 추가해보세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Button asChild size="lg">
                <Link href="/upload">
                  <Upload className="w-4 h-4 mr-2" />
                  첫 검사지 업로드하기
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-muted-foreground">
              총 {records.length}개의 검사 기록
              {isFiltering && (
                <span className="ml-2 text-primary">
                  ({selectedItems.size}개 항목 필터링 중)
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              {isFiltering ? (
                <Button variant="outline" onClick={handleClearFilter}>
                  <X className="w-4 h-4 mr-2" />
                  선택 해제
                </Button>
              ) : (
                <Button variant="outline" onClick={openFilterModal}>
                  <Filter className="w-4 h-4 mr-2" />
                  특정항목 모아보기
                </Button>
              )}
              <Button asChild>
                <Link href="/upload">
                  <Upload className="w-4 h-4 mr-2" />
                  새 검사지 업로드
                </Link>
              </Button>
            </div>
          </div>

          <PivotTable records={filteredRecords} onItemClick={handleItemClick} />

          <TrendChart
            records={records}
            itemName={selectedItem}
            open={isChartOpen}
            onOpenChange={handleChartClose}
          />

          {/* 항목 선택 모달 */}
          <Dialog open={isFilterModalOpen} onOpenChange={setIsFilterModalOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>검사 항목 선택</DialogTitle>
                <DialogDescription>
                  모아볼 검사 항목을 선택하세요. 선택한 항목만 테이블에 표시됩니다.
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto py-4 space-y-4">
                {Array.from(allItems.entries()).map(([category, items]) => {
                  const allSelected = items.every(item => tempSelectedItems.has(item.name))
                  const someSelected = items.some(item => tempSelectedItems.has(item.name))

                  return (
                    <div key={category} className="space-y-2">
                      <div className="flex items-center gap-2 sticky top-0 bg-background py-1">
                        <Checkbox
                          id={`category-${category}`}
                          checked={allSelected}
                          ref={(el) => {
                            if (el) {
                              (el as HTMLButtonElement & { indeterminate?: boolean }).indeterminate = someSelected && !allSelected
                            }
                          }}
                          onCheckedChange={() => handleToggleCategory(category)}
                        />
                        <label
                          htmlFor={`category-${category}`}
                          className="text-sm font-semibold cursor-pointer"
                        >
                          {category} ({items.length})
                        </label>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pl-6">
                        {items.map(item => (
                          <div key={item.name} className="flex items-center gap-2">
                            <Checkbox
                              id={`item-${item.name}`}
                              checked={tempSelectedItems.has(item.name)}
                              onCheckedChange={() => handleToggleItem(item.name)}
                            />
                            <label
                              htmlFor={`item-${item.name}`}
                              className="text-sm cursor-pointer truncate"
                              title={`${item.name}${item.display_name_ko ? ` (${item.display_name_ko})` : ''}`}
                            >
                              {item.name}
                              {item.display_name_ko && (
                                <span className="text-muted-foreground ml-1 text-xs">
                                  ({item.display_name_ko})
                                </span>
                              )}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              <DialogFooter className="border-t pt-4">
                <div className="flex items-center justify-between w-full">
                  <span className="text-sm text-muted-foreground">
                    {tempSelectedItems.size}개 항목 선택됨
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsFilterModalOpen(false)}>
                      취소
                    </Button>
                    <Button onClick={handleApplyFilter} disabled={tempSelectedItems.size === 0}>
                      확인
                    </Button>
                  </div>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="container max-w-6xl mx-auto py-10">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
