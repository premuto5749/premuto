'use client'

import { useState, useEffect, Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { AppHeader } from '@/components/layout/AppHeader'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Save, AlertTriangle, Sparkles, AlertCircle } from 'lucide-react'
import type { StandardItem } from '@/types'

interface MappingData {
  standard_item: StandardItem
  is_unmapped: boolean // Unmapped 카테고리 여부
  mapping_count: number // 이 항목으로 매핑된 raw_name 개수
  result_count: number // 실제 검사 결과 개수
}

function MappingManagementContent() {
  const [items, setItems] = useState<MappingData[]>([])
  const [allStandardItems, setAllStandardItems] = useState<StandardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [aiCleaning, setAiCleaning] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unmapped'>('unmapped')
  const [selectedRemappings, setSelectedRemappings] = useState<Record<string, string>>({})
  const [rateLimitError, setRateLimitError] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      // 모든 standard_items 가져오기
      const standardItemsResponse = await fetch('/api/standard-items')
      const standardItemsData = await standardItemsResponse.json()
      const standardItems: StandardItem[] = standardItemsData.data || []
      setAllStandardItems(standardItems)

      // item_mappings 통계 가져오기
      const mappingsResponse = await fetch('/api/item-mappings/stats')
      const mappingsData = await mappingsResponse.json()
      const mappingStats: Record<string, number> = mappingsData.data || {}

      // 모든 항목 조합 (병합 가능하도록)
      const mappingDataList: MappingData[] = standardItems.map(item => ({
        standard_item: item,
        is_unmapped: item.category === 'Unmapped',
        mapping_count: mappingStats[item.id] || 0,
        result_count: 0 // TODO: 실제 검사 결과 개수 추가
      }))

      setItems(mappingDataList)
    } catch (error) {
      console.error('Failed to fetch mapping data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRemapItem = (itemId: string, newStandardItemId: string) => {
    setSelectedRemappings(prev => ({
      ...prev,
      [itemId]: newStandardItemId
    }))
  }

  const handleSaveRemappings = async () => {
    setSaving(true)

    try {
      const remappingPromises = Object.entries(selectedRemappings).map(async ([oldId, newId]) => {
        const response = await fetch('/api/item-mappings/remap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            old_standard_item_id: oldId,
            new_standard_item_id: newId
          })
        })

        if (!response.ok) {
          throw new Error(`Failed to remap item ${oldId}`)
        }

        return response.json()
      })

      await Promise.all(remappingPromises)

      alert('매핑이 성공적으로 업데이트되었습니다.')
      setSelectedRemappings({})
      fetchData() // 새로고침

    } catch (error) {
      console.error('Save remappings error:', error)
      alert(error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const filteredItems = items.filter(item => {
    if (filter === 'unmapped') {
      return item.is_unmapped
    }
    return true
  })

  const unmappedCount = items.filter(i => i.is_unmapped).length
  const remappingCount = Object.keys(selectedRemappings).length

  const handleAiCleanup = async () => {
    if (unmappedCount === 0) {
      alert('정리할 Unmapped 항목이 없습니다.')
      return
    }

    if (!confirm(`AI가 ${unmappedCount}개의 Unmapped 항목을 자동으로 정리합니다. 계속하시겠습니까?`)) {
      return
    }

    setAiCleaning(true)
    try {
      const response = await fetch('/api/item-mappings/ai-cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const result = await response.json()

      if (!response.ok) {
        // AI 사용량 제한 에러 처리
        if (response.status === 429 || result.error === 'AI_RATE_LIMIT') {
          setRateLimitError(true)
          return
        }
        throw new Error(result.error || 'AI 정리 중 오류가 발생했습니다.')
      }

      alert(`AI 정리 완료!\n- 매핑된 항목: ${result.data.mapped_count}개\n- 실패한 항목: ${result.data.failed_count}개`)
      setSelectedRemappings({})
      fetchData() // 새로고침
    } catch (error) {
      console.error('AI cleanup error:', error)
      alert(error instanceof Error ? error.message : 'AI 정리 중 오류가 발생했습니다.')
    } finally {
      setAiCleaning(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-muted">
        <AppHeader title="검사항목 매핑 관리" />
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader title="검사항목 매핑 관리" />

      <div className="container max-w-7xl mx-auto py-10 px-4">

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-muted-foreground">전체 표준 항목</div>
            <div className="text-2xl font-bold">{items.length}개</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-muted-foreground">Unmapped 항목</div>
            <div className="text-2xl font-bold text-orange-600">{unmappedCount}개</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-muted-foreground">재매핑 대기</div>
            <div className="text-2xl font-bold text-blue-600">{remappingCount}개</div>
          </CardContent>
        </Card>
      </div>

      {/* 필터 및 AI 정리 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">필터:</span>
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              전체
            </Button>
            <Button
              variant={filter === 'unmapped' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('unmapped')}
            >
              Unmapped만
            </Button>
          </div>
        </div>

        {/* AI 정리 버튼 */}
        <Button
          onClick={handleAiCleanup}
          disabled={aiCleaning || unmappedCount === 0}
          variant="outline"
          className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-400 disabled:to-gray-500"
        >
          {aiCleaning ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              AI 정리 중...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              AI로 정리하기 ({unmappedCount})
            </>
          )}
        </Button>
      </div>

      {/* 매핑 테이블 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>표준 항목 목록 ({filteredItems.length}개)</CardTitle>
          <CardDescription>
            중복되거나 유사한 항목을 선택하여 다른 표준 항목과 병합할 수 있습니다 (예: BUN/CRE → BUN:CREATININE RATIO)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">항목명</TableHead>
                  <TableHead className="w-[150px]">한글명</TableHead>
                  <TableHead className="w-[100px]">카테고리</TableHead>
                  <TableHead className="w-[80px]">단위</TableHead>
                  <TableHead className="w-[100px]">매핑 개수</TableHead>
                  <TableHead className="w-[300px]">병합할 항목 선택</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const isUnmapped = item.is_unmapped
                  const hasRemapping = selectedRemappings[item.standard_item.id]

                  return (
                    <TableRow key={item.standard_item.id} className={isUnmapped ? 'bg-orange-50' : ''}>
                      <TableCell className="font-medium">
                        {item.standard_item.name}
                        {isUnmapped && <AlertTriangle className="inline w-4 h-4 ml-2 text-orange-500" />}
                      </TableCell>
                      <TableCell>{item.standard_item.display_name_ko}</TableCell>
                      <TableCell>
                        <Badge variant={isUnmapped ? 'destructive' : 'outline'}>
                          {item.standard_item.category || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.standard_item.default_unit || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{item.mapping_count}</Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={hasRemapping || ''}
                          onValueChange={(value) => handleRemapItem(item.standard_item.id, value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="다른 항목과 병합" />
                          </SelectTrigger>
                          <SelectContent>
                            {allStandardItems
                              .filter(si => si.id !== item.standard_item.id)
                              .map(stdItem => (
                                <SelectItem key={stdItem.id} value={stdItem.id}>
                                  {stdItem.name} ({stdItem.display_name_ko}) - {stdItem.category}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 저장 버튼 */}
      {remappingCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>재매핑 저장</CardTitle>
            <CardDescription>
              {remappingCount}개 항목의 매핑을 업데이트합니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleSaveRemappings}
              disabled={saving}
              className="w-full"
              size="lg"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  재매핑 저장 ({remappingCount}개)
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="font-medium mb-2">💡 팁</h3>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>&apos;Unmapped&apos; 카테고리는 OCR에서 자동 생성된 항목입니다</li>
          <li>중복 항목 예시: &quot;BUN/CRE&quot;와 &quot;BUN:CREATININE RATIO&quot; 병합</li>
          <li>병합 시 모든 검사 결과와 매핑 데이터가 선택한 항목으로 이동됩니다</li>
          <li>병합은 되돌릴 수 없으니 신중히 선택하세요</li>
          <li>정기적으로 이 페이지를 확인하여 데이터 품질을 유지하세요</li>
        </ul>
      </div>
      </div>

      {/* AI 사용량 제한 에러 모달 */}
      <Dialog open={rateLimitError} onOpenChange={setRateLimitError}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              AI 사용량 제한
            </DialogTitle>
            <DialogDescription className="pt-2">
              AI 사용량 제한에 도달하였습니다. 잠시 후 다시 시도해주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="pt-4">
            <Button className="w-full" onClick={() => setRateLimitError(false)}>
              확인
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
