'use client'

import { useState, useEffect, Suspense, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { HospitalSelector } from '@/components/ui/hospital-selector'
import { ArrowRight, AlertCircle, Loader2, Edit2, Check, ArrowUp, ArrowDown, Merge } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import type { OcrBatchResponse, OcrResult, Hospital } from '@/types'

// 이상여부 배지 컴포넌트
function AbnormalBadge({ isAbnormal, direction }: {
  isAbnormal?: boolean
  direction?: 'high' | 'low' | null
}) {
  if (!isAbnormal || !direction) return null

  if (direction === 'high') {
    return (
      <Badge variant="destructive" className="ml-2 text-xs">
        <ArrowUp className="w-3 h-3 mr-1" />
        H
      </Badge>
    )
  }

  return (
    <Badge variant="default" className="ml-2 text-xs bg-blue-500">
      <ArrowDown className="w-3 h-3 mr-1" />
      L
    </Badge>
  )
}

interface EditableItem extends OcrResult {
  source_filename: string
  test_date: string
  hospital_name: string
  isEditing?: boolean
}

interface DateGroup {
  date: string
  hospital: string
  sequence: number // 같은 날짜의 순번 (1, 2, 3...)
  items: EditableItem[]
  _stableKey?: string // 안정적인 키 (병원 변경해도 유지)
  _originalHospital?: string // 원본 병원명
}

function PreviewContent() {
  const router = useRouter()
  const [batchData, setBatchData] = useState<OcrBatchResponse['data'] | null>(null)
  const [allItems, setAllItems] = useState<EditableItem[]>([])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('')
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [groupHospitalOverrides, setGroupHospitalOverrides] = useState<Map<string, string>>(new Map())
  const [groupDateOverrides, setGroupDateOverrides] = useState<Map<string, string>>(new Map())
  const [editingDateKey, setEditingDateKey] = useState<string | null>(null)
  // 그룹 병합 관련 상태
  const [mergedGroups, setMergedGroups] = useState<Map<string, string>>(new Map()) // sourceKey -> targetKey
  const [showMergeSelect, setShowMergeSelect] = useState<string | null>(null)

  useEffect(() => {
    // 세션 스토리지에서 OCR 배치 결과 로드
    const stored = sessionStorage.getItem('ocrBatchResult')
    if (stored) {
      try {
        const data: OcrBatchResponse['data'] = JSON.parse(stored)
        setBatchData(data)

        // 모든 결과를 평탄화하면서 test_date, hospital_name 보존
        const flattenedItems: EditableItem[] = []
        data.results.forEach(result => {
          const testDate = result.metadata?.test_date ?? 'Unknown'
          const hospitalName = result.metadata?.hospital_name ?? 'Unknown'

          result.items.forEach(item => {
            flattenedItems.push({
              ...item,
              source_filename: result.filename,
              test_date: testDate,
              hospital_name: hospitalName
            })
          })
        })
        setAllItems(flattenedItems)

        // 첫 번째 탭을 기본 선택 (안정적인 키 형식 사용)
        if (flattenedItems.length > 0) {
          const firstDate = flattenedItems[0].test_date
          setActiveTab(`${firstDate}-1`)
        }
      } catch (error) {
        console.error('Failed to parse batch data:', error)
        router.push('/upload')
      }
    } else {
      router.push('/upload')
    }
  }, [router])

  // 병원 목록 로드
  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        const response = await fetch('/api/hospitals')
        const result = await response.json()
        if (result.success && result.data) {
          setHospitals(result.data)
        }
      } catch (error) {
        console.error('Failed to fetch hospitals:', error)
      }
    }
    fetchHospitals()
  }, [])

  // 날짜별로 그룹화
  const dateGroups = useMemo(() => {
    const groups: DateGroup[] = []
    const dateMap = new Map<string, Map<string, EditableItem[]>>()

    // 날짜 → 병원 → 항목 리스트로 그룹화
    allItems.forEach(item => {
      if (!dateMap.has(item.test_date)) {
        dateMap.set(item.test_date, new Map())
      }
      const hospitalMap = dateMap.get(item.test_date)!
      if (!hospitalMap.has(item.hospital_name)) {
        hospitalMap.set(item.hospital_name, [])
      }
      hospitalMap.get(item.hospital_name)!.push(item)
    })

    // DateGroup 배열로 변환 (같은 날짜는 순번 부여)
    const tempGroups: DateGroup[] = []
    dateMap.forEach((hospitalMap, originalDate) => {
      let sequence = 1
      hospitalMap.forEach((items, originalHospital) => {
        // 안정적인 키 생성 (원본 날짜+순번 기반, 변경되지 않음)
        const stableKey = `${originalDate}-${sequence}`
        // 사용자가 병원을 선택한 경우 override 사용
        const finalHospital = groupHospitalOverrides.get(stableKey) || originalHospital
        // 사용자가 날짜를 변경한 경우 override 사용
        const finalDate = groupDateOverrides.get(stableKey) || originalDate

        tempGroups.push({
          date: finalDate,
          hospital: finalHospital,
          sequence,
          items: [...items], // 복사본 생성
          _stableKey: stableKey,
          _originalHospital: originalHospital
        })
        sequence++
      })
    })

    // 병합 처리: source의 아이템을 target으로 이동
    mergedGroups.forEach((targetKey, sourceKey) => {
      const sourceGroup = tempGroups.find(g => g._stableKey === sourceKey)
      const targetGroup = tempGroups.find(g => g._stableKey === targetKey)

      if (sourceGroup && targetGroup) {
        // source의 아이템을 target에 추가
        targetGroup.items.push(...sourceGroup.items)
        // source 그룹 비우기 (나중에 필터링됨)
        sourceGroup.items = []
      }
    })

    // 빈 그룹 제거 (병합된 source 그룹)
    tempGroups.forEach(g => {
      if (g.items.length > 0) {
        groups.push(g)
      }
    })

    // 날짜순 정렬 (null 체크 추가)
    groups.sort((a, b) => {
      const dateA = a.date || ''
      const dateB = b.date || ''
      return dateA.localeCompare(dateB)
    })

    return groups
  }, [allItems, groupHospitalOverrides, groupDateOverrides, mergedGroups])

  const handleEdit = (index: number) => {
    setEditingIndex(index)
  }

  const handleSave = () => {
    setEditingIndex(null)
  }

  const handleFieldChange = (itemIndex: number, field: keyof OcrResult, value: string | number | null) => {
    setAllItems(prev => {
      const updated = [...prev]
      updated[itemIndex] = {
        ...updated[itemIndex],
        [field]: value
      }
      return updated
    })
  }

  const handleHospitalChange = (groupKey: string, hospitalName: string) => {
    setGroupHospitalOverrides(prev => {
      const updated = new Map(prev)
      updated.set(groupKey, hospitalName)
      return updated
    })
  }

  const handleHospitalCreated = (hospital: Hospital) => {
    setHospitals(prev => [...prev, hospital])
  }

  const handleDateChange = (stableKey: string, newDate: string) => {
    setGroupDateOverrides(prev => {
      const updated = new Map(prev)
      updated.set(stableKey, newDate)
      return updated
    })
    setEditingDateKey(null)
  }

  // 그룹 병합 핸들러
  const handleMergeGroups = (sourceKey: string, targetKey: string) => {
    if (sourceKey === targetKey) return

    setMergedGroups(prev => {
      const updated = new Map(prev)
      updated.set(sourceKey, targetKey)
      return updated
    })
    setShowMergeSelect(null)
  }

  const handleSaveAll = async () => {
    if (!batchData) return

    setIsProcessing(true)

    try {
      // 1단계: 날짜별로 AI 매핑 실행
      const mappingPromises = dateGroups.map(async (group) => {
        const response = await fetch('/api/ai-mapping', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            batch_id: `${batchData.batch_id}_${group.date}_${group.sequence}`,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            ocr_results: group.items.map(({ source_filename, test_date, hospital_name, ...item }) => item)
          }),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'AI 매핑 중 오류가 발생했습니다')
        }

        return {
          group,
          mappingResult: result.data
        }
      })

      const mappingResults = await Promise.all(mappingPromises)

      // 2단계: 각 날짜 그룹별로 자동 저장
      const savePromises = mappingResults.map(async ({ group, mappingResult }) => {
        // 매칭된 항목과 미매칭 항목 분리
        const mappedItems: Array<{
          ocr_item: OcrResult
          suggested_mapping: { standard_item_id: string; confidence: number }
          source_filename: string
        }> = []

        const unmappedItems: Array<{
          ocr_item: OcrResult
          source_filename: string
        }> = []

        mappingResult.forEach((result: {
          ocr_item: OcrResult
          suggested_mapping: { standard_item_id: string; confidence: number } | null
        }) => {
          const originalItem = group.items.find(
            item => item.name === result.ocr_item.name && item.value === result.ocr_item.value
          )

          if (result.suggested_mapping) {
            mappedItems.push({
              ocr_item: result.ocr_item,
              suggested_mapping: result.suggested_mapping,
              source_filename: originalItem?.source_filename || 'unknown'
            })
          } else {
            unmappedItems.push({
              ocr_item: result.ocr_item,
              source_filename: originalItem?.source_filename || 'unknown'
            })
          }
        })

        // 미매칭 항목을 Unmapped 카테고리로 standard_items에 추가
        const newStandardItemPromises = unmappedItems.map(async (item) => {
          const createResponse = await fetch('/api/standard-items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: item.ocr_item.name,
              display_name_ko: item.ocr_item.name,
              category: 'Unmapped',
              default_unit: item.ocr_item.unit,
              description: 'OCR에서 자동 생성됨'
            })
          })

          if (!createResponse.ok) {
            console.error(`Failed to create standard item for ${item.ocr_item.name}`)
            return null
          }

          const newItem = await createResponse.json()
          return {
            ...item,
            standard_item_id: newItem.data.id
          }
        })

        const newStandardItems = (await Promise.all(newStandardItemPromises)).filter(Boolean)

        // 모든 항목 통합 (매핑된 것 + 새로 생성된 것)
        const allResults = [
          ...mappedItems.map(item => ({
            standard_item_id: item.suggested_mapping.standard_item_id,
            value: item.ocr_item.value,
            unit: item.ocr_item.unit,
            ref_min: item.ocr_item.ref_min,
            ref_max: item.ocr_item.ref_max,
            ref_text: item.ocr_item.ref_text,
            source_filename: item.source_filename,
            ocr_raw_name: item.ocr_item.name,
            mapping_confidence: item.suggested_mapping.confidence,
            user_verified: false
          })),
          ...newStandardItems.map(item => ({
            standard_item_id: item!.standard_item_id,
            value: item!.ocr_item.value,
            unit: item!.ocr_item.unit,
            ref_min: item!.ocr_item.ref_min,
            ref_max: item!.ocr_item.ref_max,
            ref_text: item!.ocr_item.ref_text,
            source_filename: item!.source_filename,
            ocr_raw_name: item!.ocr_item.name,
            mapping_confidence: 0,
            user_verified: false
          }))
        ]

        // 그룹의 파일들만 추출
        const groupFiles = [...new Set(group.items.map(item => item.source_filename))]
        const uploadedFiles = batchData.results
          .filter(r => groupFiles.includes(r.filename))
          .map(r => ({
            filename: r.filename,
            size: 0,
            type: r.filename.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'
          }))

        // test_results 저장
        const saveResponse = await fetch('/api/test-results-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            batch_id: `${batchData.batch_id}_${group.date}_${group.sequence}`,
            test_date: group.date,
            hospital_name: group.hospital,
            uploaded_files: uploadedFiles,
            results: allResults
          })
        })

        const saveResult = await saveResponse.json()

        if (!saveResponse.ok) {
          throw new Error(saveResult.error || `${group.date} 저장 실패`)
        }

        return saveResult
      })

      await Promise.all(savePromises)

      // 세션 스토리지 정리
      sessionStorage.removeItem('ocrBatchResult')

      // 대시보드로 이동
      router.push('/dashboard?saved=true')

    } catch (error) {
      console.error('Save error:', error)
      alert(error instanceof Error ? error.message : '저장 중 오류가 발생했습니다')
    } finally {
      setIsProcessing(false)
    }
  }

  if (!batchData || allItems.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container max-w-6xl mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">OCR 결과 확인</h1>
        <p className="text-muted-foreground">
          AI가 추출한 결과를 날짜별로 확인하고 필요시 수정하세요
        </p>
      </div>

      {/* 경고 메시지 */}
      {batchData.warnings && batchData.warnings.length > 0 && (
        <Card className="mb-6 border-orange-500">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-orange-700">경고</p>
                <ul className="mt-2 space-y-1">
                  {batchData.warnings.map((warning, index) => (
                    <li key={index} className="text-sm text-muted-foreground">
                      • {warning.message}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 날짜별 탭 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="mb-4">
          {dateGroups.map((group) => {
            const stableKey = group._stableKey || `${group.date}-${group.sequence}`
            const displayName = group.sequence > 1
              ? `${group.date} (${group.hospital}) (${group.sequence})`
              : `${group.date} (${group.hospital})`

            return (
              <TabsTrigger key={stableKey} value={stableKey}>
                {displayName}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {dateGroups.map((group) => {
          // 안정적인 키 사용 (병원 변경 시에도 유지)
          const stableKey = group._stableKey || `${group.date}-${group.sequence}`
          const tabId = stableKey

          return (
            <TabsContent key={tabId} value={tabId}>
              <Card>
                <CardHeader>
                  <CardTitle>추출된 검사 항목 ({group.items.length}개)</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    {/* 날짜 편집 */}
                    {editingDateKey === stableKey ? (
                      <Input
                        type="date"
                        defaultValue={group.date}
                        className="w-40 h-7 text-sm"
                        onBlur={(e) => handleDateChange(stableKey, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleDateChange(stableKey, e.currentTarget.value)
                          } else if (e.key === 'Escape') {
                            setEditingDateKey(null)
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <span
                        className="cursor-pointer hover:underline hover:text-primary"
                        onClick={() => setEditingDateKey(stableKey)}
                        title="클릭하여 날짜 변경"
                      >
                        {group.date}
                      </span>
                    )}
                    <span>-</span>
                    <span>{group.hospital}</span>
                    {group.sequence > 1 && <span>({group.sequence}번째)</span>}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* 병원 선택 & 그룹 병합 */}
                  <div className="mb-6 p-4 bg-muted/50 rounded-lg space-y-4">
                    <div>
                      <Label className="text-sm font-medium mb-2 block">병원</Label>
                      <HospitalSelector
                        value={group.hospital}
                        onValueChange={(value) => handleHospitalChange(stableKey, value)}
                        hospitals={hospitals}
                        onHospitalCreated={handleHospitalCreated}
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        병원명을 검색하거나 새로 추가할 수 있습니다
                      </p>
                    </div>

                    {/* 그룹 병합 */}
                    {dateGroups.length > 1 && (
                      <div className="pt-3 border-t">
                        <Label className="text-sm font-medium mb-2 block">그룹 병합</Label>
                        {showMergeSelect === stableKey ? (
                          <div className="flex items-center gap-2">
                            <Select onValueChange={(targetKey) => handleMergeGroups(stableKey, targetKey)}>
                              <SelectTrigger className="w-[280px]">
                                <SelectValue placeholder="병합할 대상 그룹 선택..." />
                              </SelectTrigger>
                              <SelectContent>
                                {dateGroups
                                  .filter(g => g._stableKey !== stableKey)
                                  .map(g => (
                                    <SelectItem key={g._stableKey} value={g._stableKey || ''}>
                                      {g.date} ({g.hospital}) - {g.items.length}개 항목
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowMergeSelect(null)}
                            >
                              취소
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowMergeSelect(stableKey)}
                          >
                            <Merge className="w-4 h-4 mr-2" />
                            다른 그룹과 병합
                          </Button>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          같은 검사의 여러 페이지가 분리된 경우 하나로 병합할 수 있습니다
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]">항목명 (OCR)</TableHead>
                          <TableHead className="w-[120px]">결과값</TableHead>
                          <TableHead className="w-[80px]">상태</TableHead>
                          <TableHead className="w-[80px]">단위</TableHead>
                          <TableHead className="w-[150px]">참고치</TableHead>
                          <TableHead className="w-[150px]">출처 파일</TableHead>
                          <TableHead className="w-[80px]">수정</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.items.map((item) => {
                          // 전체 배열에서의 인덱스 찾기
                          const globalIndex = allItems.indexOf(item)
                          const isEditing = editingIndex === globalIndex

                          return (
                            <TableRow key={globalIndex}>
                              {/* 항목명 */}
                              <TableCell>
                                {isEditing ? (
                                  <Input
                                    value={item.raw_name || item.name}
                                    onChange={(e) => handleFieldChange(globalIndex, 'name', e.target.value)}
                                    className="h-8"
                                  />
                                ) : (
                                  <div>
                                    <span className="font-medium">{item.raw_name || item.name}</span>
                                    {item.raw_name && item.raw_name !== item.name && (
                                      <span className="text-xs text-muted-foreground ml-1">
                                        → {item.name}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </TableCell>
                              {/* 결과값 */}
                              <TableCell>
                                {isEditing ? (
                                  <Input
                                    value={String(item.value)}
                                    onChange={(e) => {
                                      const val = e.target.value
                                      const numVal = parseFloat(val)
                                      handleFieldChange(globalIndex, 'value', isNaN(numVal) ? val : numVal)
                                    }}
                                    className="h-8"
                                  />
                                ) : (
                                  <span className={item.is_abnormal ? 'font-semibold' : ''}>
                                    {item.value}
                                  </span>
                                )}
                              </TableCell>
                              {/* 상태 (H/L) */}
                              <TableCell>
                                <AbnormalBadge
                                  isAbnormal={item.is_abnormal}
                                  direction={item.abnormal_direction}
                                />
                                {!item.is_abnormal && item.ref_min != null && item.ref_max != null && (
                                  <Badge variant="outline" className="text-xs text-green-600">
                                    정상
                                  </Badge>
                                )}
                              </TableCell>
                              {/* 단위 */}
                              <TableCell>
                                {isEditing ? (
                                  <Input
                                    value={item.unit}
                                    onChange={(e) => handleFieldChange(globalIndex, 'unit', e.target.value)}
                                    className="h-8"
                                  />
                                ) : (
                                  item.unit
                                )}
                              </TableCell>
                              {/* 참고치 (통합) */}
                              <TableCell>
                                {isEditing ? (
                                  <Input
                                    value={item.reference || item.ref_text || ''}
                                    onChange={(e) => handleFieldChange(globalIndex, 'ref_text', e.target.value || null)}
                                    placeholder="예: 0.5-1.8"
                                    className="h-8"
                                  />
                                ) : (
                                  <span className="text-sm">
                                    {item.reference || item.ref_text || '-'}
                                  </span>
                                )}
                              </TableCell>
                              {/* 출처 파일 */}
                              <TableCell>
                                <span className="text-xs text-muted-foreground">{item.source_filename}</span>
                              </TableCell>
                              {/* 수정 버튼 */}
                              <TableCell>
                                {isEditing ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleSave}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Check className="w-4 h-4 text-green-600" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(globalIndex)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
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
            </TabsContent>
          )
        })}
      </Tabs>

      {/* 저장 버튼 */}
      <Card>
        <CardHeader>
          <CardTitle>검사 결과 저장</CardTitle>
          <CardDescription>
            OCR 결과를 확인했다면 저장하세요. AI가 자동으로 매칭하고 DB에 저장합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleSaveAll}
            disabled={isProcessing || allItems.length === 0}
            className="w-full"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                저장 중... ({dateGroups.length}개 날짜 그룹)
              </>
            ) : (
              <>
                모두 저장 ({dateGroups.length}개 날짜 그룹)
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>

          {isProcessing && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-sm text-center text-muted-foreground">
                AI 매칭 및 저장 중... ({dateGroups.length}개 날짜 그룹)
              </p>
              <p className="text-xs text-center text-muted-foreground mt-2">
                매칭되지 않은 항목은 자동으로 생성됩니다
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="font-medium mb-2">💡 팁</h3>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>날짜별 탭을 클릭하여 각 검사의 OCR 결과를 확인하세요</li>
          <li>같은 날짜에 여러 병원에서 검사한 경우 순번(1, 2, ...)이 표시됩니다</li>
          <li>숫자가 잘못 인식된 경우 지금 수정하세요 (수정 버튼 클릭)</li>
          <li>[저장] 버튼을 누르면 AI가 자동으로 매칭하고 DB에 저장합니다</li>
          <li>매칭되지 않은 항목은 &apos;Unmapped&apos; 카테고리로 자동 생성됩니다</li>
          <li>각 날짜 그룹은 독립적으로 저장됩니다</li>
        </ul>
      </div>
    </div>
  )
}

export default function PreviewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
      <PreviewContent />
    </Suspense>
  )
}
