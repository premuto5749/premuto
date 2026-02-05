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
import { AppHeader } from '@/components/layout/AppHeader'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ArrowRight, AlertCircle, Loader2, Edit2, Check, ArrowUp, ArrowDown, CalendarIcon, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
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

interface MappingInfo {
  standard_item_id: string
  standard_item_name: string
  display_name_ko: string
  confidence: number
  method: string
  source_hint?: string
}

interface EditableItem extends OcrResult {
  source_filename: string
  test_date: string
  hospital_name: string
  isEditing?: boolean
  mapping?: MappingInfo | null
  isGarbage?: boolean
  garbageReason?: string
}

interface DateGroup {
  date: string
  hospital: string
  originalDate: string // OCR에서 추출한 원래 날짜 (탭 ID용)
  originalHospital: string // OCR에서 추출한 원래 병원명 (탭 ID용)
  sequence: number // 같은 날짜의 순번 (1, 2, 3...)
  items: EditableItem[]
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
  const [rateLimitError, setRateLimitError] = useState(false)
  const [isMapped, setIsMapped] = useState(false)
  const [isMappingInProgress, setIsMappingInProgress] = useState(false)
  const [mappingStats, setMappingStats] = useState<{
    exactMatch: number
    aliasMatch: number
    aiMatch: number
    garbage: number
    unmapped: number
  } | null>(null)

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

        // 첫 번째 탭을 기본 선택
        if (flattenedItems.length > 0) {
          const firstDate = flattenedItems[0].test_date
          const firstHospital = flattenedItems[0].hospital_name
          setActiveTab(`${firstDate}-${firstHospital}-1`)
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
    dateMap.forEach((hospitalMap, originalDate) => {
      let sequence = 1
      hospitalMap.forEach((items, originalHospital) => {
        // 탭 ID에 사용할 안정적인 키 (원래 날짜와 병원명 기반)
        const groupKey = `${originalDate}-${originalHospital}-${sequence}`
        // 사용자가 날짜를 선택한 경우 override 사용
        const finalDate = groupDateOverrides.get(groupKey) || originalDate
        // 사용자가 병원을 선택한 경우 override 사용
        const finalHospital = groupHospitalOverrides.get(groupKey) || originalHospital

        groups.push({
          date: finalDate,
          hospital: finalHospital,
          originalDate, // 탭 ID용 원래 날짜 저장
          originalHospital, // 탭 ID용 원래 병원명 저장
          sequence,
          items
        })
        sequence++
      })
    })

    // 날짜순 정렬 (null 체크 추가)
    groups.sort((a, b) => {
      const dateA = a.date || ''
      const dateB = b.date || ''
      return dateA.localeCompare(dateB)
    })

    return groups
  }, [allItems, groupHospitalOverrides, groupDateOverrides])

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

  const handleDateChange = (groupKey: string, date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    setGroupDateOverrides(prev => {
      const updated = new Map(prev)
      updated.set(groupKey, dateStr)
      return updated
    })
  }

  const handleHospitalCreated = (hospital: Hospital) => {
    setHospitals(prev => [...prev, hospital])
  }

  // AI 정리 (매핑) 실행
  const handleAiMapping = async () => {
    if (!batchData || allItems.length === 0) return

    setIsMappingInProgress(true)

    try {
      // OCR 결과를 ai-mapping API 형식으로 변환
      const ocrResults = allItems.map(item => ({
        name: item.name,
        raw_name: item.raw_name || item.name,
        value: item.value,
        unit: item.unit,
        ref_min: item.ref_min,
        ref_max: item.ref_max,
        ref_text: item.ref_text,
        reference: item.reference,
        is_abnormal: item.is_abnormal,
        abnormal_direction: item.abnormal_direction
      }))

      const response = await fetch('/api/ai-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_id: batchData.batch_id,
          ocr_results: ocrResults
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        if (errorData.error === 'AI_RATE_LIMIT') {
          setRateLimitError(true)
          return
        }
        throw new Error(errorData.message || 'AI 매핑 실패')
      }

      const result = await response.json()

      if (result.success && result.data) {
        // 매핑 결과를 allItems에 적용
        // API 응답 형식: [{ocr_item, suggested_mapping, isGarbage, garbageReason}]
        setAllItems(prev => {
          const updated = [...prev]
          result.data.forEach((mappedResult: {
            ocr_item: { name: string; raw_name?: string }
            suggested_mapping: {
              standard_item_id: string
              standard_item_name: string
              display_name_ko: string
              confidence: number
              reasoning?: string
              source_hint?: string
            } | null
            isGarbage?: boolean
            garbageReason?: string | null
          }, index: number) => {
            if (index < updated.length) {
              let mapping = null
              if (mappedResult.suggested_mapping) {
                // reasoning에서 method 판별
                const reasoning = mappedResult.suggested_mapping.reasoning || ''
                let method = 'ai_match'
                if (reasoning.includes('정규항목')) {
                  method = 'exact'
                } else if (reasoning.includes('별칭')) {
                  method = 'alias'
                }

                mapping = {
                  standard_item_id: mappedResult.suggested_mapping.standard_item_id,
                  standard_item_name: mappedResult.suggested_mapping.standard_item_name,
                  display_name_ko: mappedResult.suggested_mapping.display_name_ko,
                  confidence: mappedResult.suggested_mapping.confidence,
                  method,
                  source_hint: mappedResult.suggested_mapping.source_hint,
                }
              }

              updated[index] = {
                ...updated[index],
                mapping,
                isGarbage: mappedResult.isGarbage || false,
                garbageReason: mappedResult.garbageReason || undefined
              }
            }
          })
          return updated
        })

        // 매핑 통계 저장
        if (result.stats) {
          setMappingStats({
            exactMatch: result.stats.exactMatch || 0,
            aliasMatch: result.stats.aliasMatch || 0,
            aiMatch: result.stats.aiMatch || 0,
            garbage: result.stats.garbage || 0,
            unmapped: result.stats.failed || 0
          })
        }

        setIsMapped(true)
      }
    } catch (error) {
      console.error('AI Mapping error:', error)
      alert(error instanceof Error ? error.message : 'AI 매핑 중 오류가 발생했습니다')
    } finally {
      setIsMappingInProgress(false)
    }
  }

  const handleSaveAll = async () => {
    if (!batchData) return

    // 날짜와 병원이 Unknown인 그룹이 있는지 확인 (경고만 표시, 저장은 허용)
    const invalidGroups = dateGroups.filter(g => g.date === 'Unknown' || g.hospital === 'Unknown')
    if (invalidGroups.length > 0) {
      const messages: string[] = []
      invalidGroups.forEach(g => {
        if (g.date === 'Unknown') messages.push('- 날짜가 선택되지 않은 검사가 있습니다')
        if (g.hospital === 'Unknown') messages.push('- 병원이 선택되지 않은 검사가 있습니다')
      })
      const confirmSave = confirm(
        '다음 항목이 입력되지 않았습니다:\n\n' +
        [...new Set(messages)].join('\n') +
        '\n\n그래도 저장하시겠습니까?\n(나중에 "검사 기록 관리" 메뉴에서 수정할 수 있습니다)'
      )
      if (!confirmSave) return
    }

    setIsProcessing(true)

    try {
      // OCR에서 이미 매핑이 완료되었으므로 바로 저장
      const savePromises = dateGroups.map(async (group) => {
        // 가비지 항목 제외, 매핑된 것과 매핑되지 않은 것 분리
        const mappedItems: EditableItem[] = []
        const unmappedItems: EditableItem[] = []

        group.items.forEach(item => {
          // 가비지는 건너뜀
          if (item.isGarbage) return

          if (item.mapping) {
            mappedItems.push(item)
          } else {
            unmappedItems.push(item)
          }
        })

        // 미매칭 항목을 Unmapped 카테고리로 standard_items에 추가
        const newStandardItemPromises = unmappedItems.map(async (item) => {
          const createResponse = await fetch('/api/standard-items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: item.name,
              display_name_ko: item.name,
              category: 'Unmapped',
              default_unit: item.unit,
              description: 'OCR에서 자동 생성됨'
            })
          })

          if (!createResponse.ok) {
            console.error(`Failed to create standard item for ${item.name}`)
            return null
          }

          const newItem = await createResponse.json()
          return {
            item,
            standard_item_id: newItem.data.id
          }
        })

        const newStandardItems = (await Promise.all(newStandardItemPromises)).filter(Boolean)

        // 모든 항목 통합 (매핑된 것 + 새로 생성된 것)
        const allResults = [
          ...mappedItems.map(item => ({
            standard_item_id: item.mapping!.standard_item_id,
            value: item.value,
            unit: item.unit,
            ref_min: item.ref_min,
            ref_max: item.ref_max,
            ref_text: item.ref_text,
            source_filename: item.source_filename,
            ocr_raw_name: item.raw_name || item.name,
            mapping_confidence: item.mapping!.confidence,
            user_verified: false
          })),
          ...newStandardItems.map(ns => ({
            standard_item_id: ns!.standard_item_id,
            value: ns!.item.value,
            unit: ns!.item.unit,
            ref_min: ns!.item.ref_min,
            ref_max: ns!.item.ref_max,
            ref_text: ns!.item.ref_text,
            source_filename: ns!.item.source_filename,
            ocr_raw_name: ns!.item.raw_name || ns!.item.name,
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

      // AI 사용량 제한 에러 모달 표시
      if (error instanceof Error && error.message === 'AI_RATE_LIMIT') {
        setRateLimitError(true)
        return
      }

      alert(error instanceof Error ? error.message : '저장 중 오류가 발생했습니다')
    } finally {
      setIsProcessing(false)
    }
  }

  if (!batchData || allItems.length === 0) {
    return (
      <div className="min-h-screen bg-muted">
        <AppHeader title="OCR 결과 확인" showBack backHref="/upload" />
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader title="OCR 결과 확인" showBack backHref="/upload" />

      <div className="container max-w-6xl mx-auto py-10 px-4">

      {/* 경고 메시지 - duplicate_item 제외 (날짜 불일치 등 중요 경고만 표시) */}
      {batchData.warnings && batchData.warnings.filter(w => w.type !== 'duplicate_item').length > 0 && (
        <Card className="mb-6 border-orange-500">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-orange-700">경고</p>
                <ul className="mt-2 space-y-1">
                  {batchData.warnings.filter(w => w.type !== 'duplicate_item').map((warning, index) => (
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

      {/* AI 정리 버튼 */}
      <Card className={`mb-6 ${isMapped ? 'border-green-500' : 'border-primary'}`}>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h3 className="font-medium flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                AI 정리
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {isMapped
                  ? '매핑 완료! 결과를 확인하고 저장하세요.'
                  : 'OCR 결과를 표준 검사항목으로 매핑합니다. (가비지 필터링 → 정규/별칭 매칭 → AI 판단)'}
              </p>
              {mappingStats && (
                <div className="flex flex-wrap gap-2 mt-3">
                  <Badge variant="default" className="bg-green-500">정규 {mappingStats.exactMatch}</Badge>
                  <Badge variant="default" className="bg-blue-500">별칭 {mappingStats.aliasMatch}</Badge>
                  <Badge variant="default" className="bg-purple-500">AI {mappingStats.aiMatch}</Badge>
                  <Badge variant="outline" className="text-gray-500">가비지 {mappingStats.garbage}</Badge>
                  <Badge variant="outline" className="text-orange-500 border-orange-300">미매핑 {mappingStats.unmapped}</Badge>
                </div>
              )}
            </div>
            <Button
              onClick={handleAiMapping}
              disabled={isMappingInProgress || isMapped}
              size="lg"
              className={isMapped ? 'bg-green-600 hover:bg-green-600' : ''}
            >
              {isMappingInProgress ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  AI 정리 중...
                </>
              ) : isMapped ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  정리 완료
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  AI 정리 시작
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 날짜별 탭 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mb-6">
        <TabsList className="w-full flex flex-wrap gap-1 h-auto mb-4">
          {dateGroups.map((group) => {
            // 탭 ID는 원래 날짜와 병원명 기반 (변경해도 안정적)
            const tabId = `${group.originalDate}-${group.originalHospital}-${group.sequence}`
            const displayDate = group.date === 'Unknown' ? '날짜 미인식' : group.date
            const displayName = group.sequence > 1
              ? `${displayDate} (${group.hospital}) (${group.sequence})`
              : `${displayDate} (${group.hospital})`

            return (
              <TabsTrigger key={tabId} value={tabId}>
                {displayName}
                {(group.date === 'Unknown' || group.hospital === 'Unknown') && (
                  <Badge variant="destructive" className="ml-1 text-[10px] px-1">!</Badge>
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {dateGroups.map((group) => {
          // 탭 ID는 원래 날짜와 병원명 기반 (변경해도 안정적)
          const tabId = `${group.originalDate}-${group.originalHospital}-${group.sequence}`
          const isDateUnknown = group.date === 'Unknown'
          const isHospitalUnknown = group.hospital === 'Unknown'

          return (
            <TabsContent key={tabId} value={tabId} className="w-full">
              <Card className="w-full">
                <CardHeader>
                  <CardTitle>추출된 검사 항목 ({group.items.length}개)</CardTitle>
                  <CardDescription>
                    {isDateUnknown ? '날짜 미인식' : group.date} - {isHospitalUnknown ? '병원 미인식' : group.hospital} {group.sequence > 1 && `(${group.sequence}번째)`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-visible">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 overflow-visible">
                    {/* 날짜 선택 */}
                    <div className="p-4 bg-muted/50 rounded-lg overflow-visible">
                      <Label className="text-sm font-medium mb-2 block">검사일</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`w-full justify-start text-left font-normal ${isDateUnknown ? 'border-destructive text-destructive' : ''}`}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {isDateUnknown ? '날짜를 선택하세요' : group.date}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-[100]" align="start">
                          <Calendar
                            selected={isDateUnknown ? undefined : new Date(group.date)}
                            onSelect={(date) => handleDateChange(tabId, date)}
                            maxDate={new Date()}
                          />
                        </PopoverContent>
                      </Popover>
                      {isDateUnknown && (
                        <p className="text-xs text-destructive mt-2">
                          날짜가 인식되지 않았습니다. 캘린더에서 선택해주세요.
                        </p>
                      )}
                    </div>

                    {/* 병원 선택 */}
                    <div className="p-4 bg-muted/50 rounded-lg overflow-visible">
                      <Label className="text-sm font-medium mb-2 block">병원</Label>
                      <HospitalSelector
                        value={group.hospital}
                        onValueChange={(value) => handleHospitalChange(tabId, value)}
                        hospitals={hospitals}
                        onHospitalCreated={handleHospitalCreated}
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]">항목명 (OCR)</TableHead>
                          <TableHead className="w-[180px]">매핑 결과</TableHead>
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
                                    <span className={`font-medium ${item.isGarbage ? 'line-through text-muted-foreground' : ''}`}>
                                      {item.raw_name || item.name}
                                    </span>
                                  </div>
                                )}
                              </TableCell>
                              {/* 매핑 결과 */}
                              <TableCell>
                                {!isMapped ? (
                                  <Badge variant="outline" className="text-xs text-gray-400">
                                    매핑 전
                                  </Badge>
                                ) : item.isGarbage ? (
                                  <Badge variant="outline" className="text-xs text-gray-400">
                                    🗑️ {item.garbageReason || '가비지'}
                                  </Badge>
                                ) : item.mapping ? (
                                  <div className="flex flex-col gap-1">
                                    <span className="text-sm font-medium">
                                      {item.mapping.display_name_ko || item.mapping.standard_item_name}
                                    </span>
                                    <div className="flex items-center gap-1">
                                      <Badge
                                        variant={item.mapping.confidence >= 90 ? 'default' : item.mapping.confidence >= 70 ? 'secondary' : 'outline'}
                                        className={`text-xs ${
                                          item.mapping.confidence >= 90 ? 'bg-green-500' :
                                          item.mapping.confidence >= 70 ? 'bg-yellow-500 text-black' : ''
                                        }`}
                                      >
                                        {item.mapping.confidence}%
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">
                                        {item.mapping.method === 'exact' ? '정규' :
                                         item.mapping.method === 'alias' ? '별칭' :
                                         item.mapping.method === 'ai_match' ? '🤖AI' : item.mapping.method}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <Badge variant="outline" className="text-xs text-orange-500 border-orange-300">
                                    ⚠️ 미매핑
                                  </Badge>
                                )}
                              </TableCell>
                              {/* 결과값 */}
                              <TableCell>
                                {isEditing ? (
                                  <Input
                                    value={String(item.value ?? '')}
                                    onChange={(e) => {
                                      const val = e.target.value
                                      const numVal = parseFloat(val)
                                      handleFieldChange(globalIndex, 'value', isNaN(numVal) ? val : numVal)
                                    }}
                                    className="h-8"
                                    placeholder="값 입력"
                                  />
                                ) : (
                                  item.value === null || item.value === undefined || item.value === '' ? (
                                    <span className="text-muted-foreground/50 text-lg">-</span>
                                  ) : (
                                    <span className={`${item.is_abnormal ? 'font-semibold' : ''} ${item.value === 0 ? 'text-foreground' : ''}`}>
                                      {item.value}
                                      {item.value === 0 && (
                                        <span className="text-xs text-muted-foreground ml-1">(측정값)</span>
                                      )}
                                    </span>
                                  )
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
      <Card className={!isMapped ? 'opacity-60' : ''}>
        <CardHeader>
          <CardTitle>검사 결과 저장</CardTitle>
          <CardDescription>
            {isMapped
              ? '매핑 결과를 확인했다면 저장하세요. 매핑된 결과가 DB에 저장됩니다.'
              : '먼저 위의 "AI 정리" 버튼을 눌러 매핑을 진행하세요.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleSaveAll}
            disabled={isProcessing || allItems.length === 0 || !isMapped}
            className="w-full"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                저장 중... ({dateGroups.length}개 날짜 그룹)
              </>
            ) : !isMapped ? (
              <>
                먼저 AI 정리를 실행하세요
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
                저장 중... ({dateGroups.length}개 날짜 그룹)
              </p>
              <p className="text-xs text-center text-muted-foreground mt-2">
                매칭되지 않은 항목은 자동으로 생성됩니다
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="font-medium mb-2">💡 진행 순서</h3>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li><strong>1단계:</strong> OCR 결과를 확인하고 잘못된 값은 수정하세요</li>
          <li><strong>2단계:</strong> [AI 정리] 버튼을 눌러 표준 검사항목으로 매핑하세요</li>
          <li><strong>3단계:</strong> 매핑 결과를 확인하고 [저장] 버튼을 누르세요</li>
          <li>날짜/병원이 인식되지 않았다면 직접 선택해주세요</li>
          <li>매핑되지 않은 항목은 &apos;Unmapped&apos; 카테고리로 자동 생성됩니다</li>
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

export default function PreviewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
      <PreviewContent />
    </Suspense>
  )
}
