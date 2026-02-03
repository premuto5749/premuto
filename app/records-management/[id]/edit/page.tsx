'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AppHeader } from '@/components/layout/AppHeader'
import { HospitalSelector } from '@/components/ui/hospital-selector'
import { Loader2, Trash2, Plus, Save, CalendarIcon, ArrowUp, ArrowDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { useToast } from '@/hooks/use-toast'
import type { Hospital, StandardItem } from '@/types'

interface TestResultItem {
  id: string
  standard_item_id: string
  value: number | string | null
  unit: string | null
  ref_min: number | null
  ref_max: number | null
  ref_text: string | null
  status: 'Low' | 'Normal' | 'High' | 'Unknown'
  standard_items: {
    id: string
    name: string
    display_name_ko: string | null
    default_unit: string | null
  } | null
}

export default function EditRecordPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [standardItems, setStandardItems] = useState<StandardItem[]>([])

  // 편집 상태
  const [testDate, setTestDate] = useState('')
  const [hospitalName, setHospitalName] = useState('')
  const [results, setResults] = useState<TestResultItem[]>([])

  // 삭제 다이얼로그
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // 추가 다이얼로그
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newItem, setNewItem] = useState({
    standard_item_id: '',
    value: '',
    unit: '',
    ref_min: '',
    ref_max: '',
    ref_text: ''
  })
  const [adding, setAdding] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchRecord = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/test-results?recordId=${id}`)
      const result = await response.json()

      if (result.success && result.data) {
        const recordData = result.data
        setTestDate(recordData.test_date)
        setHospitalName(recordData.hospital_name || '')
        setResults(recordData.test_results || [])
      } else {
        throw new Error('검사 기록을 찾을 수 없습니다')
      }
    } catch (error) {
      console.error('Failed to fetch record:', error)
      toast({
        title: '오류',
        description: '검사 기록을 불러오는데 실패했습니다.',
        variant: 'destructive'
      })
      router.push('/records-management')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    fetchRecord()
    fetchHospitals()
    fetchStandardItems()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

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

  const fetchStandardItems = async () => {
    try {
      const response = await fetch('/api/standard-items')
      const result = await response.json()
      if (result.success && result.data) {
        setStandardItems(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch standard items:', error)
    }
  }

  const handleSaveRecord = async () => {
    if (!testDate) {
      toast({
        title: '입력 오류',
        description: '검사일을 선택해주세요.',
        variant: 'destructive'
      })
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/test-results', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: id,
          test_date: testDate,
          hospital_name: hospitalName || null
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '저장에 실패했습니다')
      }

      toast({
        title: '저장 완료',
        description: '검사 기록이 저장되었습니다.'
      })
    } catch (error) {
      console.error('Save error:', error)
      toast({
        title: '저장 실패',
        description: error instanceof Error ? error.message : '저장에 실패했습니다.',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateItem = async (itemId: string, field: string, value: string | number | null) => {
    // 로컬 상태 먼저 업데이트
    setResults(prev => prev.map(item => {
      if (item.id === itemId) {
        const updated = { ...item, [field]: value }
        // status 재계산
        if (field === 'value' || field === 'ref_min' || field === 'ref_max') {
          const newValue = field === 'value' ? value : item.value
          const newRefMin = field === 'ref_min' ? (typeof value === 'number' ? value : null) : item.ref_min
          const newRefMax = field === 'ref_max' ? (typeof value === 'number' ? value : null) : item.ref_max
          updated.status = calculateStatus(newValue, newRefMin, newRefMax)
        }
        return updated
      }
      return item
    }))

    // API 호출
    try {
      const response = await fetch(`/api/test-results/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      })

      if (!response.ok) {
        throw new Error('업데이트에 실패했습니다')
      }
    } catch (error) {
      console.error('Update item error:', error)
      toast({
        title: '업데이트 실패',
        description: '항목 업데이트에 실패했습니다.',
        variant: 'destructive'
      })
      // 실패 시 원래 값으로 복원
      fetchRecord()
    }
  }

  const handleDeleteItem = async () => {
    if (!deleteItemId) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/test-results/${deleteItemId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('삭제에 실패했습니다')
      }

      setResults(prev => prev.filter(item => item.id !== deleteItemId))
      toast({
        title: '삭제 완료',
        description: '검사 항목이 삭제되었습니다.'
      })
    } catch (error) {
      console.error('Delete item error:', error)
      toast({
        title: '삭제 실패',
        description: '항목 삭제에 실패했습니다.',
        variant: 'destructive'
      })
    } finally {
      setDeleting(false)
      setDeleteItemId(null)
    }
  }

  const handleAddItem = async () => {
    if (!newItem.standard_item_id) {
      toast({
        title: '입력 오류',
        description: '검사 항목을 선택해주세요.',
        variant: 'destructive'
      })
      return
    }

    if (!newItem.value) {
      toast({
        title: '입력 오류',
        description: '검사 값을 입력해주세요.',
        variant: 'destructive'
      })
      return
    }

    setAdding(true)
    try {
      const value = parseFloat(newItem.value) || newItem.value
      const refMin = newItem.ref_min ? parseFloat(newItem.ref_min) : null
      const refMax = newItem.ref_max ? parseFloat(newItem.ref_max) : null

      const response = await fetch(`/api/test-results/${id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          standard_item_id: newItem.standard_item_id,
          value: value,
          unit: newItem.unit || null,
          ref_min: refMin,
          ref_max: refMax,
          ref_text: newItem.ref_text || null,
          status: calculateStatus(value, refMin, refMax)
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '추가에 실패했습니다')
      }

      toast({
        title: '추가 완료',
        description: '검사 항목이 추가되었습니다.'
      })

      setAddDialogOpen(false)
      setNewItem({
        standard_item_id: '',
        value: '',
        unit: '',
        ref_min: '',
        ref_max: '',
        ref_text: ''
      })
      setSearchQuery('')
      fetchRecord()
    } catch (error) {
      console.error('Add item error:', error)
      toast({
        title: '추가 실패',
        description: error instanceof Error ? error.message : '항목 추가에 실패했습니다.',
        variant: 'destructive'
      })
    } finally {
      setAdding(false)
    }
  }

  const calculateStatus = (
    value: number | string | null,
    refMin: number | null,
    refMax: number | null
  ): 'Low' | 'Normal' | 'High' | 'Unknown' => {
    if (value === null || value === '') return 'Unknown'
    const numValue = typeof value === 'string' ? parseFloat(value) : value
    if (isNaN(numValue)) return 'Unknown'
    if (refMin !== null && numValue < refMin) return 'Low'
    if (refMax !== null && numValue > refMax) return 'High'
    if (refMin !== null || refMax !== null) return 'Normal'
    return 'Unknown'
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === 'Unknown') return '날짜 미지정'
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'High':
        return <span className="inline-flex items-center text-red-600"><ArrowUp className="w-3 h-3 mr-1" />High</span>
      case 'Low':
        return <span className="inline-flex items-center text-blue-600"><ArrowDown className="w-3 h-3 mr-1" />Low</span>
      case 'Normal':
        return <span className="text-green-600">Normal</span>
      default:
        return <span className="text-gray-400">-</span>
    }
  }

  const selectedStandardItem = standardItems.find(si => si.id === newItem.standard_item_id)
  const filteredStandardItems = standardItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.display_name_ko && item.display_name_ko.includes(searchQuery))
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-muted">
        <AppHeader title="검사 기록 수정" showBack backHref="/records-management" />
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader title="검사 기록 수정" showBack backHref="/records-management" />

      <div className="container max-w-4xl mx-auto py-6 px-4 space-y-6">
        {/* 기본 정보 카드 */}
        <Card>
          <CardHeader>
            <CardTitle>기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 검사일 */}
              <div className="space-y-2">
                <Label>검사일</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {testDate && testDate !== 'Unknown' ? formatDate(testDate) : '날짜 선택'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      selected={testDate && testDate !== 'Unknown' ? new Date(testDate) : undefined}
                      onSelect={(date) => setTestDate(date.toISOString().split('T')[0])}
                      maxDate={new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* 병원 */}
              <div className="space-y-2">
                <Label>병원</Label>
                <HospitalSelector
                  value={hospitalName}
                  onValueChange={setHospitalName}
                  hospitals={hospitals}
                  onHospitalCreated={(h) => setHospitals(prev => [...prev, h])}
                />
              </div>
            </div>

            <Button onClick={handleSaveRecord} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  기본 정보 저장
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 검사 항목 카드 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>검사 항목 ({results.length}개)</CardTitle>
              <Button onClick={() => setAddDialogOpen(true)} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                항목 추가
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                검사 항목이 없습니다. 항목을 추가해주세요.
              </div>
            ) : (
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">항목</TableHead>
                      <TableHead className="w-[100px]">값</TableHead>
                      <TableHead className="w-[80px]">단위</TableHead>
                      <TableHead className="w-[150px]">참고범위</TableHead>
                      <TableHead className="w-[80px]">판정</TableHead>
                      <TableHead className="w-[60px] text-right">삭제</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {item.standard_items?.display_name_ko || item.standard_items?.name || '알 수 없음'}
                            </div>
                            {item.standard_items?.display_name_ko && (
                              <div className="text-xs text-muted-foreground">
                                {item.standard_items.name}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            value={item.value ?? ''}
                            onChange={(e) => {
                              const val = e.target.value
                              const numVal = parseFloat(val)
                              handleUpdateItem(item.id, 'value', isNaN(numVal) ? val : numVal)
                            }}
                            className="w-20 h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            value={item.unit || ''}
                            onChange={(e) => handleUpdateItem(item.id, 'unit', e.target.value || null)}
                            className="w-16 h-8"
                            placeholder="-"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              value={item.ref_min ?? ''}
                              onChange={(e) => handleUpdateItem(item.id, 'ref_min', e.target.value ? parseFloat(e.target.value) : null)}
                              className="w-16 h-8"
                              placeholder="min"
                            />
                            <span className="text-muted-foreground">-</span>
                            <Input
                              type="number"
                              value={item.ref_max ?? ''}
                              onChange={(e) => handleUpdateItem(item.id, 'ref_max', e.target.value ? parseFloat(e.target.value) : null)}
                              className="w-16 h-8"
                              placeholder="max"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(item.status)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteItemId(item.id)}
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
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={!!deleteItemId} onOpenChange={() => !deleting && setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>검사 항목 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 검사 항목을 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteItem}
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

      {/* 항목 추가 다이얼로그 */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => !adding && setAddDialogOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>검사 항목 추가</DialogTitle>
            <DialogDescription>
              새로운 검사 항목을 추가합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 표준 항목 선택 */}
            <div className="space-y-2">
              <Label>검사 항목 *</Label>
              <Command className="border rounded-md">
                <CommandInput
                  placeholder="항목 검색..."
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                />
                <CommandList className="max-h-[200px]">
                  <CommandEmpty>항목을 찾을 수 없습니다.</CommandEmpty>
                  <CommandGroup>
                    {filteredStandardItems.slice(0, 50).map((item) => (
                      <CommandItem
                        key={item.id}
                        value={item.id}
                        onSelect={() => {
                          setNewItem(prev => ({
                            ...prev,
                            standard_item_id: item.id,
                            unit: item.default_unit || ''
                          }))
                          setSearchQuery(item.display_name_ko || item.name)
                        }}
                      >
                        <span>{item.display_name_ko || item.name}</span>
                        {item.display_name_ko && (
                          <span className="ml-2 text-xs text-muted-foreground">{item.name}</span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
              {selectedStandardItem && (
                <p className="text-sm text-muted-foreground">
                  선택됨: {selectedStandardItem.display_name_ko || selectedStandardItem.name}
                </p>
              )}
            </div>

            {/* 값 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>값 *</Label>
                <Input
                  type="text"
                  value={newItem.value}
                  onChange={(e) => setNewItem(prev => ({ ...prev, value: e.target.value }))}
                  placeholder="검사 값"
                />
              </div>
              <div className="space-y-2">
                <Label>단위</Label>
                <Input
                  type="text"
                  value={newItem.unit}
                  onChange={(e) => setNewItem(prev => ({ ...prev, unit: e.target.value }))}
                  placeholder="mg/dL"
                />
              </div>
            </div>

            {/* 참고범위 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>참고범위 최소</Label>
                <Input
                  type="number"
                  value={newItem.ref_min}
                  onChange={(e) => setNewItem(prev => ({ ...prev, ref_min: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>참고범위 최대</Label>
                <Input
                  type="number"
                  value={newItem.ref_max}
                  onChange={(e) => setNewItem(prev => ({ ...prev, ref_max: e.target.value }))}
                  placeholder="10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>참고범위 텍스트</Label>
              <Input
                type="text"
                value={newItem.ref_text}
                onChange={(e) => setNewItem(prev => ({ ...prev, ref_text: e.target.value }))}
                placeholder="0-10"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)} disabled={adding}>
              취소
            </Button>
            <Button onClick={handleAddItem} disabled={adding}>
              {adding ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  추가 중...
                </>
              ) : (
                '추가'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
