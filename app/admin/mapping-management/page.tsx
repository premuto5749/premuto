'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { AppHeader } from '@/components/layout/AppHeader'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Loader2, Trash2, ShieldCheck, ArrowRight, RefreshCw, Search } from 'lucide-react'

interface UnmappedItem {
  id: string
  name: string
  display_name_ko: string | null
  category: string | null
  exam_type: string | null
  default_unit: string | null
  test_results_count: number
  suggested_action: 'delete' | 'merge' | 'keep' | 'review'
  merge_candidate: {
    id: string
    name: string
    similarity: number
  } | null
  reason: string
}

interface AnalysisSummary {
  total: number
  byAction: {
    delete: number
    merge: number
    keep: number
    review: number
  }
  byCategory: Record<string, number>
  totalTestResults: number
}

function ManualMappingButton({
  itemId,
  standardItems,
  excludeId,
  onSelect,
}: {
  itemId: string
  standardItems: Array<{ id: string; name: string; display_name_ko: string | null }>
  excludeId: string
  onSelect: (itemId: string, targetId: string, targetName: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredItems = standardItems
    .filter(item => item.id !== excludeId)
    .filter(item => {
      if (!searchValue) return true
      const query = searchValue.toLowerCase()
      return (
        item.name.toLowerCase().includes(query) ||
        (item.display_name_ko?.toLowerCase().includes(query) ?? false)
      )
    })
    .slice(0, 50)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <Search className="w-3 h-3 mr-1" />
          수동 매핑
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            ref={inputRef}
            placeholder="표준항목 검색..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>일치하는 항목이 없습니다</CommandEmpty>
            <CommandGroup>
              {filteredItems.map(item => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={() => {
                    onSelect(itemId, item.id, item.name)
                    setOpen(false)
                    setSearchValue('')
                  }}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{item.name}</span>
                    {item.display_name_ko && (
                      <span className="text-xs text-muted-foreground">{item.display_name_ko}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function MappingManagementContent() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  // 통계용 카운트
  const [totalItemCount, setTotalItemCount] = useState(0)
  const [unmappedCount, setUnmappedCount] = useState(0)

  // AI 분석 관련 상태
  const [analysisMode, setAnalysisMode] = useState(false)
  const [analyzedItems, setAnalyzedItems] = useState<UnmappedItem[]>([])
  const [analysisSummary, setAnalysisSummary] = useState<AnalysisSummary | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [selectedForCleanup, setSelectedForCleanup] = useState<Set<string>>(new Set())
  const [bulkCleaning, setBulkCleaning] = useState(false)

  // 표준항목 목록 (수동 매핑용)
  const [standardItems, setStandardItems] = useState<Array<{ id: string; name: string; display_name_ko: string | null }>>([])
  // 수동 매핑 오버라이드 (itemId → { targetId, targetName })
  const [manualMappings, setManualMappings] = useState<Record<string, { targetId: string; targetName: string }>>({})

  useEffect(() => {
    const init = async () => {
      try {
        // 권한 체크
        const authRes = await fetch('/api/admin/stats')
        if (authRes.status === 403) {
          setAuthError('관리자 권한이 필요합니다')
          setAuthorized(false)
          setLoading(false)
          return
        }
        if (!authRes.ok) {
          setAuthError('권한 확인 실패')
          setAuthorized(false)
          setLoading(false)
          return
        }
        setAuthorized(true)
        await fetchData()
      } catch {
        setAuthError('서버 오류가 발생했습니다')
        setLoading(false)
      }
    }
    init()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      // 모든 standard_items 가져오기
      const standardItemsResponse = await fetch('/api/standard-items')
      const standardItemsData = await standardItemsResponse.json()
      const standardItems = standardItemsData.data || []

      setTotalItemCount(standardItems.length)
      setUnmappedCount(standardItems.filter((item: { category?: string }) => item.category === 'Unmapped').length)
      setStandardItems(standardItems.map((item: { id: string; name: string; display_name_ko: string | null }) => ({
        id: item.id,
        name: item.name,
        display_name_ko: item.display_name_ko
      })))
    } catch (error) {
      console.error('Failed to fetch mapping data:', error)
    } finally {
      setLoading(false)
    }
  }

  // 마스터와 비교 분석 실행
  const handleAnalyze = async () => {
    setAnalyzing(true)
    try {
      const response = await fetch('/api/admin/analyze-unmapped')
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '분석 중 오류가 발생했습니다.')
      }

      setAnalyzedItems(result.items)
      setAnalysisSummary(result.summary)
      setAnalysisMode(true)

      // 삭제 권장 항목 자동 선택
      const deleteItems = result.items
        .filter((i: UnmappedItem) => i.suggested_action === 'delete')
        .map((i: UnmappedItem) => i.id)
      setSelectedForCleanup(new Set(deleteItems))
    } catch (error) {
      console.error('Analysis error:', error)
      alert(error instanceof Error ? error.message : '분석 중 오류가 발생했습니다.')
    } finally {
      setAnalyzing(false)
    }
  }

  // 선택 토글
  const toggleSelection = (itemId: string) => {
    setSelectedForCleanup(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  // 일괄 정리 실행
  const handleBulkCleanup = async () => {
    if (selectedForCleanup.size === 0) {
      alert('정리할 항목을 선택해주세요.')
      return
    }

    // 선택된 항목 분류
    const deleteActions = analyzedItems
      .filter(i => selectedForCleanup.has(i.id) && !manualMappings[i.id] && i.suggested_action === 'delete')
      .map(i => ({ action: 'delete' as const, itemId: i.id }))

    const mergeActions = analyzedItems
      .filter(i => {
        if (!selectedForCleanup.has(i.id)) return false
        // 수동 매핑이 있으면 merge로 처리
        if (manualMappings[i.id]) return true
        // 기존 merge 액션
        return i.suggested_action === 'merge' && i.merge_candidate
      })
      .map(i => ({
        action: 'merge' as const,
        itemId: i.id,
        targetItemId: manualMappings[i.id]?.targetId || i.merge_candidate!.id
      }))

    const totalActions = deleteActions.length + mergeActions.length

    if (totalActions === 0) {
      alert('실행 가능한 정리 작업이 없습니다.')
      return
    }

    if (!confirm(`${deleteActions.length}개 삭제, ${mergeActions.length}개 병합을 실행합니다. 계속하시겠습니까?`)) {
      return
    }

    setBulkCleaning(true)
    try {
      const response = await fetch('/api/admin/cleanup-unmapped', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actions: [...deleteActions, ...mergeActions],
          dryRun: false
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '정리 중 오류가 발생했습니다.')
      }

      alert(`정리 완료!\n- 삭제: ${result.deleted}개\n- 병합: ${result.merged}개\n- 이전된 검사결과: ${result.testResultsMigrated}건${result.errors.length > 0 ? `\n- 오류: ${result.errors.length}건` : ''}`)

      setSelectedForCleanup(new Set())
      setAnalysisMode(false)
      fetchData()
    } catch (error) {
      console.error('Bulk cleanup error:', error)
      alert(error instanceof Error ? error.message : '정리 중 오류가 발생했습니다.')
    } finally {
      setBulkCleaning(false)
    }
  }

  // 액션별 배지 색상
  const getActionBadge = (action: string) => {
    switch (action) {
      case 'delete': return <Badge variant="destructive">삭제 권장</Badge>
      case 'merge': return <Badge className="bg-blue-500">병합 권장</Badge>
      case 'keep': return <Badge variant="secondary">유지</Badge>
      default: return <Badge variant="outline">검토 필요</Badge>
    }
  }

  // 수동 매핑 선택 핸들러
  const handleManualMapping = (itemId: string, targetId: string, targetName: string) => {
    setManualMappings(prev => ({
      ...prev,
      [itemId]: { targetId, targetName }
    }))
    // 자동으로 선택 상태에 추가
    setSelectedForCleanup(prev => {
      const newSet = new Set(prev)
      newSet.add(itemId)
      return newSet
    })
  }

  // 수동 매핑 제거 핸들러
  const handleRemoveManualMapping = (itemId: string) => {
    setManualMappings(prev => {
      const newMap = { ...prev }
      delete newMap[itemId]
      return newMap
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-muted">
        <AppHeader title="[관리자] 미분류 항목 정리" />
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-muted">
        <AppHeader title="[관리자] 미분류 항목 정리" />
        <div className="container max-w-4xl mx-auto py-10 px-4">
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <ShieldCheck className="w-5 h-5" />
                접근 권한 없음
              </CardTitle>
              <CardDescription>
                {authError || '이 페이지에 접근할 권한이 없습니다.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/')}>
                메인으로 돌아가기
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader title="[관리자] 미분류 항목 정리" />

      <div className="container max-w-7xl mx-auto py-10 px-4">
        {/* 관리자 배지 */}
        <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-lg flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-primary" />
          <div>
            <p className="font-medium text-primary">관리자 전용</p>
            <p className="text-sm text-muted-foreground">마스터 데이터의 미분류 항목을 정리합니다. 모든 사용자에게 영향을 줍니다.</p>
          </div>
        </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-muted-foreground">전체 표준 항목</div>
            <div className="text-2xl font-bold">{totalItemCount}개</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-muted-foreground">Unmapped 항목</div>
            <div className="text-2xl font-bold text-orange-600">{unmappedCount}개</div>
          </CardContent>
        </Card>
      </div>

      {/* 마스터 비교 분석 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>마스터 데이터 비교 분석</span>
            <Button
              onClick={handleAnalyze}
              disabled={analyzing}
              variant="outline"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  분석 중...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  마스터와 비교 분석
                </>
              )}
            </Button>
          </CardTitle>
          <CardDescription>
            DB의 항목을 master_data_v3.json과 비교하여 정리가 필요한 항목을 찾습니다.
          </CardDescription>
        </CardHeader>
        {analysisSummary && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">마스터에 없는 항목</div>
                <div className="text-xl font-bold">{analysisSummary.total}개</div>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <div className="text-sm text-red-600">삭제 권장</div>
                <div className="text-xl font-bold text-red-600">{analysisSummary.byAction.delete}개</div>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-sm text-blue-600">병합 권장</div>
                <div className="text-xl font-bold text-blue-600">{analysisSummary.byAction.merge}개</div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">유지</div>
                <div className="text-xl font-bold text-gray-600">{analysisSummary.byAction.keep}개</div>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <div className="text-sm text-orange-600">검토 필요</div>
                <div className="text-xl font-bold text-orange-600">{analysisSummary.byAction.review}개</div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* 분석 결과 테이블 */}
      {analysisMode && analyzedItems.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>정리 대상 항목 ({analyzedItems.length}개)</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAnalysisMode(false)
                    setSelectedForCleanup(new Set())
                  }}
                >
                  취소
                </Button>
                <Button
                  onClick={handleBulkCleanup}
                  disabled={bulkCleaning || selectedForCleanup.size === 0}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {bulkCleaning ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      정리 중...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      선택 항목 정리 ({selectedForCleanup.size})
                    </>
                  )}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">선택</TableHead>
                    <TableHead className="w-[200px]">항목명</TableHead>
                    <TableHead className="w-[100px]">카테고리</TableHead>
                    <TableHead className="w-[80px]">검사결과</TableHead>
                    <TableHead className="w-[100px]">권장 액션</TableHead>
                    <TableHead className="w-[250px]">병합 대상</TableHead>
                    <TableHead>사유</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analyzedItems.map((item) => (
                    <TableRow
                      key={item.id}
                      className={selectedForCleanup.has(item.id) ? 'bg-red-50' : ''}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedForCleanup.has(item.id)}
                          onCheckedChange={() => toggleSelection(item.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {item.name}
                        {item.display_name_ko && (
                          <span className="block text-sm text-muted-foreground">
                            {item.display_name_ko}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.category === 'Unmapped' ? 'destructive' : 'outline'}>
                          {item.category || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.test_results_count > 0 ? 'default' : 'outline'}>
                          {item.test_results_count}
                        </Badge>
                      </TableCell>
                      <TableCell>{getActionBadge(item.suggested_action)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {manualMappings[item.id] ? (
                            <div className="flex items-center gap-1 text-sm">
                              <ArrowRight className="w-4 h-4 text-green-500" />
                              <span className="font-medium text-green-700">{manualMappings[item.id].targetName}</span>
                              <Badge variant="secondary" className="ml-1">수동</Badge>
                              <button
                                onClick={() => handleRemoveManualMapping(item.id)}
                                className="text-xs text-red-500 hover:text-red-700 ml-1"
                              >
                                ✕
                              </button>
                            </div>
                          ) : item.merge_candidate ? (
                            <div className="flex items-center gap-1 text-sm">
                              <ArrowRight className="w-4 h-4 text-blue-500" />
                              <span className="font-medium">{item.merge_candidate.name}</span>
                              <Badge variant="secondary" className="ml-1">
                                {item.merge_candidate.similarity}%
                              </Badge>
                            </div>
                          ) : null}
                          <ManualMappingButton
                            itemId={item.id}
                            standardItems={standardItems}
                            excludeId={item.id}
                            onSelect={handleManualMapping}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.reason}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      </div>

    </div>
  )
}

export default function MappingManagementPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
      <MappingManagementContent />
    </Suspense>
  )
}
