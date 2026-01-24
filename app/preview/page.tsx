'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowRight, AlertCircle, Loader2, Edit2, Check } from 'lucide-react'
import type { OcrBatchResponse, OcrResult } from '@/types'

interface EditableItem extends OcrResult {
  source_filename: string
  isEditing?: boolean
}

function PreviewContent() {
  const router = useRouter()
  const [batchData, setBatchData] = useState<OcrBatchResponse['data'] | null>(null)
  const [allItems, setAllItems] = useState<EditableItem[]>([])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    // 세션 스토리지에서 OCR 배치 결과 로드
    const stored = sessionStorage.getItem('ocrBatchResult')
    if (stored) {
      try {
        const data: OcrBatchResponse['data'] = JSON.parse(stored)
        setBatchData(data)

        // 모든 결과를 평탄화하여 하나의 배열로 만들기
        const flattenedItems: EditableItem[] = []
        data.results.forEach(result => {
          result.items.forEach(item => {
            flattenedItems.push({
              ...item,
              source_filename: result.filename
            })
          })
        })
        setAllItems(flattenedItems)
      } catch (error) {
        console.error('Failed to parse batch data:', error)
        router.push('/upload')
      }
    } else {
      // 데이터가 없으면 업로드 페이지로 리다이렉트
      router.push('/upload')
    }
  }, [router])

  const handleEdit = (index: number) => {
    setEditingIndex(index)
  }

  const handleSave = (index: number) => {
    setEditingIndex(null)
    // 수정사항은 상태에 자동 반영됨
  }

  const handleFieldChange = (index: number, field: keyof OcrResult, value: string | number | null) => {
    setAllItems(prev => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        [field]: value
      }
      return updated
    })
  }

  const handleProceedToMapping = async () => {
    if (!batchData) return

    setIsProcessing(true)

    try {
      // AI 매핑 API 호출
      const response = await fetch('/api/ai-mapping', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          batch_id: batchData.batch_id,
          ocr_results: allItems.map(({ source_filename, ...item }) => item) // source_filename 제외
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'AI 매핑 중 오류가 발생했습니다')
      }

      if (!result.success) {
        throw new Error('AI 매핑 결과를 가져오는데 실패했습니다')
      }

      // AI 매핑 결과와 원본 데이터를 함께 저장
      sessionStorage.setItem('aiMappingResult', JSON.stringify({
        batchData,
        allItems,
        mappingResults: result.data
      }))

      // Staging 페이지로 이동
      router.push('/staging')

    } catch (error) {
      console.error('AI Mapping error:', error)
      alert(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다')
    } finally {
      setIsProcessing(false)
    }
  }

  if (!batchData) {
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
          AI가 추출한 결과를 확인하고 필요시 수정하세요
        </p>
      </div>

      {/* 메타데이터 카드 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>검사 정보</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">검사 날짜</p>
            <p className="text-lg font-semibold">{batchData.test_date || '정보 없음'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">병원명</p>
            <p className="text-lg font-semibold">{batchData.hospital_name || '정보 없음'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">파일 개수</p>
            <p className="text-lg font-semibold">{batchData.results.length}개</p>
          </div>
        </CardContent>
      </Card>

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

      {/* OCR 결과 테이블 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>추출된 검사 항목 ({allItems.length}개)</CardTitle>
          <CardDescription>
            각 셀을 클릭하여 수정할 수 있습니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">항목명 (OCR)</TableHead>
                  <TableHead className="w-[100px]">결과값</TableHead>
                  <TableHead className="w-[100px]">단위</TableHead>
                  <TableHead className="w-[100px]">참고치 Min</TableHead>
                  <TableHead className="w-[100px]">참고치 Max</TableHead>
                  <TableHead className="w-[150px]">참고치 원문</TableHead>
                  <TableHead className="w-[200px]">출처 파일</TableHead>
                  <TableHead className="w-[80px]">수정</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allItems.map((item, index) => {
                  const isEditing = editingIndex === index

                  return (
                    <TableRow key={index}>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={item.name}
                            onChange={(e) => handleFieldChange(index, 'name', e.target.value)}
                            className="h-8"
                          />
                        ) : (
                          <span className="font-medium">{item.name}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={item.value}
                            onChange={(e) => handleFieldChange(index, 'value', parseFloat(e.target.value))}
                            className="h-8"
                          />
                        ) : (
                          item.value
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={item.unit}
                            onChange={(e) => handleFieldChange(index, 'unit', e.target.value)}
                            className="h-8"
                          />
                        ) : (
                          item.unit
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={item.ref_min ?? ''}
                            onChange={(e) =>
                              handleFieldChange(index, 'ref_min', e.target.value ? parseFloat(e.target.value) : null)
                            }
                            placeholder="없음"
                            className="h-8"
                          />
                        ) : (
                          item.ref_min ?? '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={item.ref_max ?? ''}
                            onChange={(e) =>
                              handleFieldChange(index, 'ref_max', e.target.value ? parseFloat(e.target.value) : null)
                            }
                            placeholder="없음"
                            className="h-8"
                          />
                        ) : (
                          item.ref_max ?? '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={item.ref_text ?? ''}
                            onChange={(e) => handleFieldChange(index, 'ref_text', e.target.value || null)}
                            placeholder="없음"
                            className="h-8"
                          />
                        ) : (
                          item.ref_text ?? '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{item.source_filename}</span>
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSave(index)}
                            className="h-8 w-8 p-0"
                          >
                            <Check className="w-4 h-4 text-green-600" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(index)}
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

      {/* 다음 단계 버튼 */}
      <Card>
        <CardHeader>
          <CardTitle>다음 단계: AI 매칭</CardTitle>
          <CardDescription>
            추출된 항목을 표준 검사 항목과 자동으로 매칭합니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleProceedToMapping}
            disabled={isProcessing || allItems.length === 0}
            className="w-full"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                AI 매칭 중...
              </>
            ) : (
              <>
                AI 매칭 시작
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>

          {isProcessing && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-sm text-center text-muted-foreground">
                {allItems.length}개 항목을 분석하고 있습니다. 약 10-20초 소요됩니다...
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="font-medium mb-2">💡 팁</h3>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>숫자가 잘못 인식된 경우 지금 수정하면 정확한 매칭이 가능합니다</li>
          <li>항목명의 오타는 AI가 자동으로 보정하므로 큰 문제가 없습니다</li>
          <li>참고치가 누락된 항목은 다음 단계에서 수동으로 입력할 수 있습니다</li>
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
