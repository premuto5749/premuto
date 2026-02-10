'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Loader2, Save, AlertCircle, Check, X } from 'lucide-react'
import type { AiMappingSuggestion, StandardItem, OcrBatchResponse, OcrResult } from '@/types'

interface MappingItem {
  ocr_item: OcrResult & { source_filename: string }
  suggested_mapping: AiMappingSuggestion | null
  user_action: 'approved' | 'modified' | 'pending'
  selected_standard_item_id: string | null
  user_verified: boolean
}

function StagingV2Content() {
  const router = useRouter()
  const [batchData, setBatchData] = useState<OcrBatchResponse['data'] | null>(null)
  const [mappingItems, setMappingItems] = useState<MappingItem[]>([])
  const [standardItems, setStandardItems] = useState<StandardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | 'low' | 'unmatched'>('all')

  useEffect(() => {
    // 세션 스토리지에서 AI 매핑 결과 로드 (날짜별 그룹)
    const stored = sessionStorage.getItem('aiMappingResultByDate')
    if (stored) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { batchData, dateGroups, mappingResults } = JSON.parse(stored)
        setBatchData(batchData)

        // 모든 날짜 그룹의 매핑 결과를 평탄화
        const allMappingItems: MappingItem[] = []

        mappingResults.forEach((groupResult: {
          group: { date: string; hospital: string; sequence: number; items: Array<OcrResult & { source_filename: string; test_date: string; hospital_name: string }> }
          mappingResult: Array<{ ocr_item: OcrResult; suggested_mapping: AiMappingSuggestion | null }>
        }) => {
          groupResult.mappingResult.forEach((result) => {
            // 원본 아이템에서 source_filename 찾기
            const originalItem = groupResult.group.items.find(item =>
              item.name === result.ocr_item.name &&
              item.value === result.ocr_item.value
            )

            allMappingItems.push({
              ocr_item: {
                ...result.ocr_item,
                source_filename: originalItem?.source_filename || 'unknown'
              },
              suggested_mapping: result.suggested_mapping,
              user_action: result.suggested_mapping ? 'pending' : 'pending',
              selected_standard_item_id: result.suggested_mapping?.standard_item_id || null,
              user_verified: false
            })
          })
        })

        // 신뢰도 순으로 정렬 (낮은 것 먼저)
        allMappingItems.sort((a, b) => {
          const confA = a.suggested_mapping?.confidence ?? -1
          const confB = b.suggested_mapping?.confidence ?? -1
          return confA - confB
        })

        setMappingItems(allMappingItems)
      } catch (error) {
        console.error('Failed to parse mapping data:', error)
        router.push('/upload')
        return
      }
    } else {
      router.push('/upload')
      return
    }

    // 표준 항목 목록 로드
    fetchStandardItems()
  }, [router])

  const fetchStandardItems = async () => {
    try {
      const response = await fetch('/api/standard-items')
      if (response.ok) {
        const data = await response.json()
        setStandardItems(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch standard items:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = (index: number) => {
    setMappingItems(prev => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        user_action: 'approved',
        user_verified: true
      }
      return updated
    })
  }

  const handleReject = (index: number) => {
    setMappingItems(prev => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        user_action: 'modified',
        selected_standard_item_id: null,
        user_verified: false
      }
      return updated
    })
  }

  const handleSelectStandardItem = (index: number, standardItemId: string) => {
    setMappingItems(prev => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        user_action: 'modified',
        selected_standard_item_id: standardItemId,
        user_verified: true
      }
      return updated
    })
  }

  const handleSaveAll = async () => {
    // 모든 항목이 매핑되었는지 확인
    const unmappedItems = mappingItems.filter(item => !item.selected_standard_item_id)
    if (unmappedItems.length > 0) {
      alert(`매핑되지 않은 항목이 ${unmappedItems.length}개 있습니다. 모든 항목을 매핑해주세요.`)
      return
    }

    if (!batchData) {
      alert('배치 데이터가 없습니다.')
      return
    }

    setSaving(true)

    try {
      // 날짜별로 그룹화된 데이터 로드
      const stored = sessionStorage.getItem('aiMappingResultByDate')
      if (!stored) {
        throw new Error('매핑 데이터를 찾을 수 없습니다.')
      }

      const { dateGroups } = JSON.parse(stored)

      // 각 날짜 그룹별로 별도의 test_record 저장
      const savePromises = dateGroups.map(async (group: {
        date: string
        hospital: string
        sequence: number
        items: Array<OcrResult & { source_filename: string }>
      }) => {
        // 이 그룹에 해당하는 매핑 항목들만 필터링
        const groupMappingItems = mappingItems.filter(item => {
          const matchingItem = group.items.find(
            groupItem => groupItem.name === item.ocr_item.name &&
                        groupItem.value === item.ocr_item.value &&
                        groupItem.source_filename === item.ocr_item.source_filename
          )
          return !!matchingItem
        })

        // 이 그룹의 파일들만 추출
        const groupFiles = [...new Set(group.items.map(item => item.source_filename))]
        const uploadedFiles = batchData.results
          .filter(r => groupFiles.includes(r.filename))
          .map(r => ({
            filename: r.filename,
            size: 0,
            type: r.filename.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'
          }))

        const response = await fetch('/api/test-results-batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            batch_id: `${batchData.batch_id}_${group.date}_${group.sequence}`,
            test_date: group.date,
            hospital_name: group.hospital,
            ocr_batch_id: batchData.batch_id,
            uploaded_files: uploadedFiles,
            results: groupMappingItems.map(item => ({
              standard_item_id: item.selected_standard_item_id!,
              value: item.ocr_item.value,
              unit: item.ocr_item.unit,
              ref_min: item.ocr_item.ref_min,
              ref_max: item.ocr_item.ref_max,
              ref_text: item.ocr_item.ref_text,
              source_filename: item.ocr_item.source_filename,
              ocr_raw_name: item.ocr_item.name,
              mapping_confidence: item.suggested_mapping?.confidence ?? 0,
              user_verified: item.user_verified
            }))
          })
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || `${group.date} 저장 실패`)
        }

        return result
      })

      await Promise.all(savePromises)

      // 세션 스토리지 정리
      sessionStorage.removeItem('ocrBatchResult')
      sessionStorage.removeItem('aiMappingResultByDate')

      // 대시보드로 이동
      router.push('/dashboard?saved=true')

    } catch (error) {
      console.error('Save error:', error)
      alert(error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const getConfidenceBadge = (confidence: number | undefined) => {
    if (confidence === undefined || confidence === null) {
      return <Badge variant="destructive">매칭 실패</Badge>
    }

    if (confidence >= 90) {
      return <Badge className="bg-green-500">🟢 높음 ({confidence}%)</Badge>
    } else if (confidence >= 70) {
      return <Badge className="bg-yellow-500">🟡 보통 ({confidence}%)</Badge>
    } else {
      return <Badge variant="destructive">🔴 낮음 ({confidence}%)</Badge>
    }
  }

  const filteredItems = mappingItems.filter(item => {
    if (filter === 'low') {
      return (item.suggested_mapping?.confidence ?? 0) < 70
    } else if (filter === 'unmatched') {
      return !item.suggested_mapping
    }
    return true
  })

  const unmappedCount = mappingItems.filter(item => !item.selected_standard_item_id).length

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container max-w-7xl mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">AI 매칭 검수</h1>
        <p className="text-muted-foreground">
          AI가 제안한 매칭 결과를 확인하고 승인 또는 수정하세요. 날짜별 그룹이 독립적으로 저장됩니다.
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-muted-foreground">전체 항목</div>
            <div className="text-2xl font-bold">{mappingItems.length}개</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-muted-foreground">미매핑</div>
            <div className="text-2xl font-bold text-red-600">{unmappedCount}개</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-muted-foreground">높은 신뢰도</div>
            <div className="text-2xl font-bold text-green-600">
              {mappingItems.filter(i => (i.suggested_mapping?.confidence ?? 0) >= 90).length}개
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-muted-foreground">낮은 신뢰도</div>
            <div className="text-2xl font-bold text-orange-600">
              {mappingItems.filter(i => (i.suggested_mapping?.confidence ?? 0) < 70).length}개
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 필터 */}
      <div className="mb-4 flex items-center gap-4">
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
            variant={filter === 'low' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('low')}
          >
            낮은 신뢰도
          </Button>
          <Button
            variant={filter === 'unmatched' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('unmatched')}
          >
            매칭 실패
          </Button>
        </div>
      </div>

      {/* 매칭 테이블 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>매칭 결과 ({filteredItems.length}개)</CardTitle>
          <CardDescription>
            신뢰도가 낮은 항목부터 표시됩니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">OCR 항목명</TableHead>
                  <TableHead className="w-[80px]">결과값</TableHead>
                  <TableHead className="w-[200px]">AI 제안</TableHead>
                  <TableHead className="w-[120px]">신뢰도</TableHead>
                  <TableHead className="w-[250px]">표준 항목 선택</TableHead>
                  <TableHead className="w-[150px]">출처</TableHead>
                  <TableHead className="w-[120px]">액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const globalIndex = mappingItems.indexOf(item)
                  const isApproved = item.user_action === 'approved'
                  const isModified = item.user_action === 'modified' && item.selected_standard_item_id

                  return (
                    <TableRow key={globalIndex} className={isApproved || isModified ? 'bg-green-50' : ''}>
                      <TableCell className="font-medium">{item.ocr_item.name}</TableCell>
                      <TableCell>
                        {item.ocr_item.value} {item.ocr_item.unit}
                      </TableCell>
                      <TableCell>
                        {item.suggested_mapping ? (
                          <div>
                            <div className="font-medium text-sm">
                              {item.suggested_mapping.standard_item_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.suggested_mapping.display_name_ko}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {item.suggested_mapping.reasoning}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-red-600">매칭 실패</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getConfidenceBadge(item.suggested_mapping?.confidence)}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.selected_standard_item_id || ''}
                          onValueChange={(value) => handleSelectStandardItem(globalIndex, value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="선택하세요" />
                          </SelectTrigger>
                          <SelectContent>
                            {standardItems.map(stdItem => (
                              <SelectItem key={stdItem.id} value={stdItem.id}>
                                {stdItem.name} ({stdItem.display_name_ko})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.ocr_item.source_filename}
                      </TableCell>
                      <TableCell>
                        {item.suggested_mapping && !isApproved && !isModified && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleApprove(globalIndex)}
                              title="AI 제안 승인"
                            >
                              <Check className="w-4 h-4 text-green-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleReject(globalIndex)}
                              title="AI 제안 거부"
                            >
                              <X className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        )}
                        {(isApproved || isModified) && (
                          <Badge variant="outline" className="text-xs">
                            {isApproved ? '✓ 승인됨' : '✓ 수정됨'}
                          </Badge>
                        )}
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
      <Card>
        <CardHeader>
          <CardTitle>최종 저장</CardTitle>
          <CardDescription>
            모든 항목의 매칭을 확인한 후 저장하세요. 각 날짜 그룹은 별도의 검사 기록으로 저장됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {unmappedCount > 0 && (
            <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-md flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-orange-700">
                아직 매핑되지 않은 항목이 {unmappedCount}개 있습니다. 모든 항목을 매핑해주세요.
              </p>
            </div>
          )}

          <Button
            onClick={handleSaveAll}
            disabled={saving || unmappedCount > 0}
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
                모두 저장
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="font-medium mb-2">💡 팁</h3>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>신뢰도가 높은 항목은 대부분 정확하게 매칭되어 있습니다</li>
          <li>신뢰도가 낮거나 매칭 실패한 항목은 수동으로 선택해주세요</li>
          <li>AI가 제안한 매칭이 올바르면 ✓ 버튼으로 승인하세요</li>
          <li>승인한 매칭은 다음번 업로드 시 자동으로 적용됩니다</li>
          <li>여러 날짜의 검사를 함께 업로드한 경우, 각 날짜별로 독립적인 검사 기록이 생성됩니다</li>
        </ul>
      </div>
    </div>
  )
}

export default function StagingV2Page() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
      <StagingV2Content />
    </Suspense>
  )
}
