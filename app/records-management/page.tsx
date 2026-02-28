'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { usePet } from '@/contexts/PetContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { AppHeader } from '@/components/layout/AppHeader'
import { Loader2, Trash2, Merge, CalendarIcon, Pencil } from 'lucide-react'
import { formatLocalDate } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { HospitalSelector } from '@/components/ui/hospital-selector'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from '@/hooks/use-toast'
import type { Hospital } from '@/types'

interface TestRecord {
  id: string
  test_date: string
  hospital_name: string | null
  created_at: string
  test_results: Array<{
    id: string
    standard_items_master: {
      name: string
    }
  }>
}

interface ConflictData {
  sourceRecord: {
    id: string
    testDate: string
    hospitalName: string | null
    itemCount: number
  }
  targetRecord: {
    id: string
    testDate: string
    hospitalName: string | null
    itemCount: number
  }
  dateConflict: boolean
  hospitalConflict: boolean
  itemConflicts: Array<{
    standardItemId: string
    itemName: string
    itemNameKo: string
    sourceValue: number
    sourceUnit: string
    targetValue: number
    targetUnit: string
  }>
}

function RecordsManagementContent() {
  const { currentPet } = usePet()
  const [records, setRecords] = useState<TestRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set())
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false)
  const [conflictData, setConflictData] = useState<ConflictData | null>(null)
  const [merging, setMerging] = useState(false)
  const [hospitals, setHospitals] = useState<Hospital[]>([])

  // 병합 설정
  const [targetDate, setTargetDate] = useState<string>('')
  const [targetHospital, setTargetHospital] = useState<string>('')
  const [conflictResolutions, setConflictResolutions] = useState<Map<string, boolean>>(new Map())

  const { toast } = useToast()

  useEffect(() => {
    fetchRecords()
    fetchHospitals()
  }, [currentPet?.id])

  const fetchRecords = async () => {
    try {
      setLoading(true)
      const petParam = currentPet ? `?petId=${currentPet.id}` : ''
      const response = await fetch(`/api/test-results${petParam}`)
      const result = await response.json()

      if (result.success && result.data) {
        setRecords(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch records:', error)
    } finally {
      setLoading(false)
    }
  }

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

  const handleDelete = async () => {
    if (!deleteId) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/test-results?id=${deleteId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (response.ok) {
        toast({
          title: '삭제 완료',
          description: '검사 기록이 삭제되었습니다.'
        })
        fetchRecords()
      } else {
        throw new Error(result.error || '삭제에 실패했습니다')
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast({
        title: '삭제 실패',
        description: error instanceof Error ? error.message : '삭제에 실패했습니다.',
        variant: 'destructive'
      })
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  const handleSelectRecord = (id: string, checked: boolean) => {
    setSelectedRecords(prev => {
      const updated = new Set(prev)
      if (checked) {
        // 최대 2개까지만 선택
        if (updated.size < 2) {
          updated.add(id)
        }
      } else {
        updated.delete(id)
      }
      return updated
    })
  }

  const handleMergeClick = async () => {
    if (selectedRecords.size !== 2) {
      toast({
        title: '선택 오류',
        description: '병합할 검사 기록 2개를 선택해주세요.',
        variant: 'destructive'
      })
      return
    }

    const [sourceId, targetId] = Array.from(selectedRecords)

    try {
      const response = await fetch(`/api/test-results/merge?sourceId=${sourceId}&targetId=${targetId}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '충돌 확인에 실패했습니다')
      }

      setConflictData(result.data)

      // 기본값 설정
      setTargetDate(result.data.targetRecord.testDate || result.data.sourceRecord.testDate)
      setTargetHospital(result.data.targetRecord.hospitalName || result.data.sourceRecord.hospitalName || '')

      // 충돌 해결 기본값: target 값 사용
      const defaultResolutions = new Map<string, boolean>()
      result.data.itemConflicts.forEach((c: { standardItemId: string }) => {
        defaultResolutions.set(c.standardItemId, false) // false = target 값 사용
      })
      setConflictResolutions(defaultResolutions)

      setMergeDialogOpen(true)
    } catch (error) {
      console.error('Conflict check error:', error)
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '충돌 확인 중 오류가 발생했습니다.',
        variant: 'destructive'
      })
    }
  }

  const handleMerge = async () => {
    if (!conflictData) return

    if (!targetDate) {
      toast({
        title: '날짜 필요',
        description: '검사일을 선택해주세요.',
        variant: 'destructive'
      })
      return
    }

    if (!targetHospital) {
      toast({
        title: '병원 필요',
        description: '병원을 선택해주세요.',
        variant: 'destructive'
      })
      return
    }

    setMerging(true)
    try {
      const response = await fetch('/api/test-results/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceRecordId: conflictData.sourceRecord.id,
          targetRecordId: conflictData.targetRecord.id,
          targetDate,
          targetHospital,
          conflictResolutions: Array.from(conflictResolutions.entries()).map(([standardItemId, useSourceValue]) => ({
            standardItemId,
            useSourceValue
          }))
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '병합에 실패했습니다')
      }

      toast({
        title: '병합 완료',
        description: '검사 기록이 병합되었습니다.'
      })

      setMergeDialogOpen(false)
      setSelectedRecords(new Set())
      setConflictData(null)
      fetchRecords()
    } catch (error) {
      console.error('Merge error:', error)
      toast({
        title: '병합 실패',
        description: error instanceof Error ? error.message : '병합에 실패했습니다.',
        variant: 'destructive'
      })
    } finally {
      setMerging(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-muted">
        <AppHeader title="검사 기록 관리" />
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader title="검사 기록 관리" />

      <div className="container max-w-4xl mx-auto py-10 px-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>저장된 검사 기록 ({records.length}개)</CardTitle>
                <CardDescription>
                  검사 기록을 삭제하거나 병합할 수 있습니다
                </CardDescription>
              </div>
              {selectedRecords.size === 2 && (
                <Button onClick={handleMergeClick} variant="outline">
                  <Merge className="w-4 h-4 mr-2" />
                  선택한 기록 병합
                </Button>
              )}
            </div>
            {selectedRecords.size > 0 && selectedRecords.size < 2 && (
              <p className="text-sm text-muted-foreground mt-2">
                병합하려면 2개의 기록을 선택하세요 ({selectedRecords.size}/2 선택됨)
              </p>
            )}
          </CardHeader>
          <CardContent>
            {records.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                저장된 검사 기록이 없습니다
              </div>
            ) : (
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <Table className="min-w-[500px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px] whitespace-nowrap">선택</TableHead>
                      <TableHead className="whitespace-nowrap">검사일</TableHead>
                      <TableHead className="whitespace-nowrap">병원</TableHead>
                      <TableHead className="text-center whitespace-nowrap">항목 수</TableHead>
                      <TableHead className="text-right whitespace-nowrap">작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedRecords.has(record.id)}
                            onCheckedChange={(checked) => handleSelectRecord(record.id, !!checked)}
                            disabled={!selectedRecords.has(record.id) && selectedRecords.size >= 2}
                          />
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">
                          {record.test_date === 'Unknown' ? (
                            <span className="text-amber-600">날짜 미입력</span>
                          ) : formatDate(record.test_date)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {record.hospital_name ? record.hospital_name : (
                            <span className="text-amber-600">병원 미입력</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap">
                          <Badge variant="secondary">
                            {record.test_results?.length || 0}개
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <Link href={`/records-management/${record.id}/edit`}>
                              <Pencil className="w-4 h-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteId(record.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-8 p-4 bg-muted rounded-lg">
          <h3 className="font-medium mb-2">💡 팁</h3>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>검사 기록을 삭제하면 해당 날짜의 모든 검사 항목과 결과가 함께 삭제됩니다</li>
            <li>삭제된 데이터는 복구할 수 없으니 신중하게 결정하세요</li>
            <li>같은 날 검사인데 분리된 경우, 2개를 선택하여 병합할 수 있습니다</li>
            <li>병합 시 충돌되는 값이 있으면 어떤 값을 사용할지 선택할 수 있습니다</li>
          </ul>
        </div>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={!!deleteId} onOpenChange={() => !deleting && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>검사 기록 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 검사 기록과 관련된 모든 검사 결과가 삭제됩니다. 삭제된 데이터는 복구할 수 없습니다.
              <br />
              정말로 삭제하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  삭제 중...
                </>
              ) : (
                '삭제'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 병합 다이얼로그 */}
      <Dialog open={mergeDialogOpen} onOpenChange={(open) => !merging && setMergeDialogOpen(open)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>검사 기록 병합</DialogTitle>
            <DialogDescription>
              두 검사 기록을 하나로 병합합니다. 충돌되는 항목이 있으면 어떤 값을 사용할지 선택해주세요.
            </DialogDescription>
          </DialogHeader>

          {conflictData && (
            <div className="space-y-6 py-4">
              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <h4 className="font-medium text-sm mb-2">기록 1</h4>
                  <p className="text-sm">{formatDate(conflictData.sourceRecord.testDate)}</p>
                  <p className="text-sm text-muted-foreground">{conflictData.sourceRecord.hospitalName || '-'}</p>
                  <p className="text-xs text-muted-foreground">{conflictData.sourceRecord.itemCount}개 항목</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-2">기록 2</h4>
                  <p className="text-sm">{formatDate(conflictData.targetRecord.testDate)}</p>
                  <p className="text-sm text-muted-foreground">{conflictData.targetRecord.hospitalName || '-'}</p>
                  <p className="text-xs text-muted-foreground">{conflictData.targetRecord.itemCount}개 항목</p>
                </div>
              </div>

              {/* 날짜/병원 선택 */}
              <div className="space-y-4">
                <h4 className="font-medium">병합 후 정보</h4>

                {/* 날짜 선택 */}
                <div className="space-y-2">
                  <Label>검사일</Label>
                  {conflictData.dateConflict ? (
                    <RadioGroup
                      value={targetDate}
                      onValueChange={setTargetDate}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value={conflictData.sourceRecord.testDate} id="date-source" />
                        <Label htmlFor="date-source" className="font-normal">
                          {formatDate(conflictData.sourceRecord.testDate)}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value={conflictData.targetRecord.testDate} id="date-target" />
                        <Label htmlFor="date-target" className="font-normal">
                          {formatDate(conflictData.targetRecord.testDate)}
                        </Label>
                      </div>
                    </RadioGroup>
                  ) : (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {targetDate ? formatDate(targetDate) : '날짜 선택'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          selected={targetDate ? new Date(targetDate) : undefined}
                          onSelect={(date) => setTargetDate(formatLocalDate(date))}
                          maxDate={new Date()}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                </div>

                {/* 병원 선택 */}
                <div className="space-y-2">
                  <Label>병원</Label>
                  {conflictData.hospitalConflict ? (
                    <RadioGroup
                      value={targetHospital}
                      onValueChange={setTargetHospital}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value={conflictData.sourceRecord.hospitalName || ''} id="hospital-source" />
                        <Label htmlFor="hospital-source" className="font-normal">
                          {conflictData.sourceRecord.hospitalName}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value={conflictData.targetRecord.hospitalName || ''} id="hospital-target" />
                        <Label htmlFor="hospital-target" className="font-normal">
                          {conflictData.targetRecord.hospitalName}
                        </Label>
                      </div>
                    </RadioGroup>
                  ) : (
                    <HospitalSelector
                      value={targetHospital}
                      onValueChange={setTargetHospital}
                      hospitals={hospitals}
                      onHospitalCreated={(h) => setHospitals(prev => [...prev, h])}
                    />
                  )}
                </div>
              </div>

              {/* 항목 충돌 해결 */}
              {conflictData.itemConflicts.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-medium">
                    충돌하는 검사 항목 ({conflictData.itemConflicts.length}개)
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    동일한 검사 항목에 서로 다른 값이 있습니다. 사용할 값을 선택해주세요.
                  </p>

                  <div className="space-y-3">
                    {conflictData.itemConflicts.map((conflict) => (
                      <div key={conflict.standardItemId} className="p-3 border rounded-lg">
                        <p className="font-medium text-sm mb-2">
                          {conflict.itemNameKo}
                          <span className="text-muted-foreground font-normal ml-1">({conflict.itemName})</span>
                        </p>
                        <RadioGroup
                          value={conflictResolutions.get(conflict.standardItemId) ? 'source' : 'target'}
                          onValueChange={(value) => {
                            setConflictResolutions(prev => {
                              const updated = new Map(prev)
                              updated.set(conflict.standardItemId, value === 'source')
                              return updated
                            })
                          }}
                          className="flex gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="source" id={`${conflict.standardItemId}-source`} />
                            <Label htmlFor={`${conflict.standardItemId}-source`} className="font-normal">
                              {conflict.sourceValue} {conflict.sourceUnit}
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="target" id={`${conflict.standardItemId}-target`} />
                            <Label htmlFor={`${conflict.standardItemId}-target`} className="font-normal">
                              {conflict.targetValue} {conflict.targetUnit}
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {conflictData.itemConflicts.length === 0 && !conflictData.dateConflict && !conflictData.hospitalConflict && (
                <div className="p-4 bg-green-50 text-green-700 rounded-lg text-sm">
                  충돌하는 항목이 없습니다. 바로 병합할 수 있습니다.
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialogOpen(false)} disabled={merging}>
              취소
            </Button>
            <Button onClick={handleMerge} disabled={merging}>
              {merging ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  병합 중...
                </>
              ) : (
                '병합'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}

export default function RecordsManagementPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-muted">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    }>
      <RecordsManagementContent />
    </Suspense>
  )
}
