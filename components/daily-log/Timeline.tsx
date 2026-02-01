'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Trash2, ImageIcon, Edit2, Loader2, X, Camera, Image as ImagePlus } from 'lucide-react'
import type { DailyLog } from '@/types'
import { LOG_CATEGORY_CONFIG } from '@/types'
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

interface TimelineProps {
  logs: DailyLog[]
  onDelete?: (id: string) => void
  onUpdate?: (id: string, data: Partial<DailyLog>) => Promise<void>
}

export function Timeline({ logs, onDelete, onUpdate }: TimelineProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [selectedLog, setSelectedLog] = useState<DailyLog | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // 수정 폼 상태
  const [editAmount, setEditAmount] = useState<string>('')
  const [editLeftoverAmount, setEditLeftoverAmount] = useState<string>('')  // 남긴 양 (식사용)
  const [editMemo, setEditMemo] = useState<string>('')
  const [editMedicineName, setEditMedicineName] = useState<string>('')
  const [editDate, setEditDate] = useState<string>('')
  const [editTime, setEditTime] = useState<string>('')
  const [editPhotos, setEditPhotos] = useState<string[]>([])
  const [newPhotoFiles, setNewPhotoFiles] = useState<File[]>([])
  const [newPhotoPreviews, setNewPhotoPreviews] = useState<string[]>([])
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false)

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // 날짜/시간 추출 헬퍼 (로컬 시간대 기준)
  const extractDateFromISO = (dateStr: string) => {
    const d = new Date(dateStr)
    // 로컬 시간대 기준으로 YYYY-MM-DD 형식 반환
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const extractTimeFromISO = (dateStr: string) => {
    const d = new Date(dateStr)
    // 로컬 시간대 기준으로 HH:mm 형식 반환
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }

  const formatValue = (log: DailyLog) => {
    const config = LOG_CATEGORY_CONFIG[log.category]

    if (log.category === 'poop' || log.category === 'pee') {
      return '' // 배변/배뇨는 양 표시 안함
    }

    // 식사의 경우 급여량과 식사량 표시
    if (log.category === 'meal' && log.amount !== null && log.amount !== undefined) {
      const leftover = log.leftover_amount || 0
      const eaten = log.amount - leftover
      if (leftover > 0) {
        return `${eaten}g (급여 ${log.amount}g, 남김 ${leftover}g)`
      }
      return `${log.amount}${log.unit || config.unit}`
    }

    if (log.amount !== null && log.amount !== undefined) {
      return `${log.amount}${log.unit || config.unit}`
    }

    return ''
  }

  const handleDelete = async () => {
    if (!deleteId) return
    onDelete?.(deleteId)
    setDeleteId(null)
  }

  const handleOpenDetail = (log: DailyLog) => {
    setSelectedLog(log)
    setIsEditing(false)
    // 수정 폼 초기화
    setEditAmount(log.amount?.toString() || '')
    setEditLeftoverAmount(log.leftover_amount?.toString() || '')
    setEditMemo(log.memo || '')
    setEditMedicineName(log.medicine_name || '')
    setEditDate(extractDateFromISO(log.logged_at))
    setEditTime(extractTimeFromISO(log.logged_at))
    setEditPhotos(log.photo_urls || [])
    setNewPhotoFiles([])
    setNewPhotoPreviews([])
  }

  const handleStartEdit = () => {
    if (!selectedLog) return
    setEditAmount(selectedLog.amount?.toString() || '')
    setEditLeftoverAmount(selectedLog.leftover_amount?.toString() || '')
    setEditMemo(selectedLog.memo || '')
    setEditMedicineName(selectedLog.medicine_name || '')
    setEditDate(extractDateFromISO(selectedLog.logged_at))
    setEditTime(extractTimeFromISO(selectedLog.logged_at))
    setEditPhotos(selectedLog.photo_urls || [])
    setNewPhotoFiles([])
    setNewPhotoPreviews([])
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    if (selectedLog) {
      setEditAmount(selectedLog.amount?.toString() || '')
      setEditLeftoverAmount(selectedLog.leftover_amount?.toString() || '')
      setEditMemo(selectedLog.memo || '')
      setEditMedicineName(selectedLog.medicine_name || '')
      setEditDate(extractDateFromISO(selectedLog.logged_at))
      setEditTime(extractTimeFromISO(selectedLog.logged_at))
      setEditPhotos(selectedLog.photo_urls || [])
      setNewPhotoFiles([])
      setNewPhotoPreviews([])
    }
  }

  const handleSaveEdit = async () => {
    if (!selectedLog || !onUpdate) return

    setIsSaving(true)
    try {
      // 새 사진 업로드
      let uploadedPhotoUrls: string[] = []
      if (newPhotoFiles.length > 0) {
        setIsUploadingPhotos(true)
        const formData = new FormData()
        newPhotoFiles.forEach(file => {
          formData.append('files', file)
        })

        const uploadRes = await fetch('/api/daily-logs/upload', {
          method: 'POST',
          body: formData
        })

        if (uploadRes.ok) {
          const uploadResult = await uploadRes.json()
          uploadedPhotoUrls = uploadResult.data?.urls || []
        }
        setIsUploadingPhotos(false)
      }

      // 날짜/시간 조합
      const newLoggedAt = new Date(`${editDate}T${editTime}:00`).toISOString()

      const updateData: Partial<DailyLog> = {
        memo: editMemo || null,
        logged_at: newLoggedAt,
        photo_urls: [...editPhotos, ...uploadedPhotoUrls],
      }

      // 배변/배뇨가 아닌 경우에만 양 업데이트
      if (selectedLog.category !== 'poop' && selectedLog.category !== 'pee') {
        updateData.amount = editAmount ? parseFloat(editAmount) : null
      }

      // 식사인 경우 남긴 양 업데이트
      if (selectedLog.category === 'meal') {
        updateData.leftover_amount = editLeftoverAmount ? parseFloat(editLeftoverAmount) : 0
      }

      // 약인 경우 약 이름 업데이트
      if (selectedLog.category === 'medicine') {
        updateData.medicine_name = editMedicineName || null
      }

      await onUpdate(selectedLog.id, updateData)

      // 성공 후 상태 업데이트
      setSelectedLog(prev => prev ? { ...prev, ...updateData } : null)
      setNewPhotoFiles([])
      setNewPhotoPreviews([])
      setIsEditing(false)
    } catch (error) {
      console.error('Update error:', error)
    } finally {
      setIsSaving(false)
      setIsUploadingPhotos(false)
    }
  }

  // 사진 관련 핸들러
  const handleRemoveExistingPhoto = (index: number) => {
    setEditPhotos(prev => prev.filter((_, i) => i !== index))
  }

  const handleRemoveNewPhoto = (index: number) => {
    setNewPhotoFiles(prev => prev.filter((_, i) => i !== index))
    setNewPhotoPreviews(prev => prev.filter((_, i) => i !== index))
  }

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    // 파일 추가
    setNewPhotoFiles(prev => [...prev, ...files])

    // 미리보기 생성
    files.forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setNewPhotoPreviews(prev => [...prev, reader.result as string])
      }
      reader.readAsDataURL(file)
    })

    // input 초기화
    e.target.value = ''
  }

  const handleCloseDialog = () => {
    setSelectedLog(null)
    setIsEditing(false)
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>아직 오늘의 기록이 없습니다</p>
        <p className="text-sm mt-1">+ 버튼을 눌러 기록을 추가하세요</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {logs.map((log) => {
          const config = LOG_CATEGORY_CONFIG[log.category]
          return (
            <Card
              key={log.id}
              className="overflow-hidden cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => handleOpenDetail(log)}
            >
              <CardContent className="p-0">
                <div className="flex items-center">
                  {/* 시간 */}
                  <div className="w-16 py-3 text-center text-sm text-muted-foreground border-r">
                    {formatTime(log.logged_at)}
                  </div>

                  {/* 아이콘 */}
                  <div className="w-14 py-3 text-center text-2xl">
                    {config.icon}
                  </div>

                  {/* 내용 */}
                  <div className="flex-1 py-3 px-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{config.label}</span>
                      {formatValue(log) && (
                        <span className="text-sm text-muted-foreground">
                          {formatValue(log)}
                        </span>
                      )}
                      {log.category === 'medicine' && log.medicine_name && (
                        <span className="text-sm text-purple-600">
                          {log.medicine_name}
                        </span>
                      )}
                      {/* 사진 아이콘 표시 */}
                      {log.photo_urls && log.photo_urls.length > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <ImageIcon className="w-3 h-3" />
                          {log.photo_urls.length}
                        </span>
                      )}
                    </div>
                    {log.memo && (
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                        {log.memo}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>기록 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 기록을 삭제하시겠습니까? 삭제된 기록은 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 상세 정보 모달 */}
      <Dialog open={!!selectedLog} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-md">
          {selectedLog && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="text-2xl">{LOG_CATEGORY_CONFIG[selectedLog.category].icon}</span>
                  {LOG_CATEGORY_CONFIG[selectedLog.category].label}
                </DialogTitle>
              </DialogHeader>

              {isEditing ? (
                /* 수정 모드 */
                <div className="space-y-4 py-4">
                  {/* 날짜/시간 편집 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="edit-date">날짜</Label>
                      <Input
                        id="edit-date"
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-time">시간</Label>
                      <Input
                        id="edit-time"
                        type="time"
                        value={editTime}
                        onChange={(e) => setEditTime(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* 식사 양 입력 (급여량, 남긴양) */}
                  {selectedLog.category === 'meal' && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="edit-amount">급여량 (g)</Label>
                        <Input
                          id="edit-amount"
                          type="number"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          placeholder="급여량 (g)"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-leftover">남긴 양 (g)</Label>
                        <Input
                          id="edit-leftover"
                          type="number"
                          value={editLeftoverAmount}
                          onChange={(e) => setEditLeftoverAmount(e.target.value)}
                          placeholder="남긴 양 (g)"
                        />
                      </div>
                      {editAmount && (
                        <div className="p-3 bg-muted/50 rounded-md">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">실제 식사량</span>
                            <span className="font-medium">
                              {(parseFloat(editAmount) - (editLeftoverAmount ? parseFloat(editLeftoverAmount) : 0)).toFixed(0)}g
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 양 입력 (음수, 호흡수 - 배변/배뇨/식사/약 제외) */}
                  {selectedLog.category !== 'poop' && selectedLog.category !== 'pee' && selectedLog.category !== 'meal' && selectedLog.category !== 'medicine' && (
                    <div className="space-y-2">
                      <Label htmlFor="edit-amount">
                        {selectedLog.category === 'breathing' ? '호흡수' : '양'} ({LOG_CATEGORY_CONFIG[selectedLog.category].unit})
                      </Label>
                      <Input
                        id="edit-amount"
                        type="number"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        placeholder={LOG_CATEGORY_CONFIG[selectedLog.category].placeholder}
                      />
                    </div>
                  )}

                  {/* 약 이름 (약인 경우만) */}
                  {selectedLog.category === 'medicine' && (
                    <div className="space-y-2">
                      <Label htmlFor="edit-medicine">약 이름</Label>
                      <Input
                        id="edit-medicine"
                        value={editMedicineName}
                        onChange={(e) => setEditMedicineName(e.target.value)}
                        placeholder="약 이름 입력"
                      />
                    </div>
                  )}

                  {/* 메모 */}
                  <div className="space-y-2">
                    <Label htmlFor="edit-memo">메모</Label>
                    <Textarea
                      id="edit-memo"
                      value={editMemo}
                      onChange={(e) => setEditMemo(e.target.value)}
                      placeholder="메모 입력 (선택)"
                      rows={3}
                    />
                  </div>

                  {/* 사진 편집 */}
                  <div>
                    <Label className="text-sm text-muted-foreground mb-2 block">
                      사진 ({editPhotos.length + newPhotoPreviews.length}장)
                    </Label>

                    {/* 기존 사진 */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {editPhotos.map((url, idx) => (
                        <div key={`existing-${idx}`} className="relative aspect-square">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`사진 ${idx + 1}`}
                            className="w-full h-full object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveExistingPhoto(idx)}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}

                      {/* 새 사진 미리보기 */}
                      {newPhotoPreviews.map((preview, idx) => (
                        <div key={`new-${idx}`} className="relative aspect-square">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={preview}
                            alt={`새 사진 ${idx + 1}`}
                            className="w-full h-full object-cover rounded-lg border-2 border-green-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveNewPhoto(idx)}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* 사진 추가 버튼 */}
                    <div className="flex gap-2">
                      <label className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handlePhotoSelect}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={(e) => {
                            const input = e.currentTarget.parentElement?.querySelector('input')
                            input?.click()
                          }}
                        >
                          <Camera className="w-4 h-4 mr-2" />
                          촬영
                        </Button>
                      </label>
                      <label className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handlePhotoSelect}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={(e) => {
                            const input = e.currentTarget.parentElement?.querySelector('input')
                            input?.click()
                          }}
                        >
                          <ImagePlus className="w-4 h-4 mr-2" />
                          갤러리
                        </Button>
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                /* 보기 모드 */
                <div className="space-y-4 py-4">
                  {/* 시간 */}
                  <div>
                    <p className="text-sm text-muted-foreground">기록 시간</p>
                    <p className="font-medium">{formatDateTime(selectedLog.logged_at)}</p>
                  </div>

                  {/* 식사 정보 (급여량, 남긴양, 식사량) */}
                  {selectedLog.category === 'meal' && selectedLog.amount !== null && (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">급여량</span>
                        <span className="font-medium">{selectedLog.amount}g</span>
                      </div>
                      {(selectedLog.leftover_amount ?? 0) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">남긴 양</span>
                          <span className="font-medium">{selectedLog.leftover_amount}g</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-sm font-medium">실제 식사량</span>
                        <span className="font-medium text-primary">
                          {selectedLog.amount - (selectedLog.leftover_amount || 0)}g
                        </span>
                      </div>
                    </div>
                  )}

                  {/* 양 (음수, 호흡수 - 배변/배뇨/식사 제외) */}
                  {selectedLog.category !== 'poop' && selectedLog.category !== 'pee' && selectedLog.category !== 'meal' && selectedLog.amount !== null && (
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {selectedLog.category === 'breathing' ? '호흡수' : '양'}
                      </p>
                      <p className="font-medium">
                        {selectedLog.amount} {selectedLog.unit || LOG_CATEGORY_CONFIG[selectedLog.category].unit}
                      </p>
                    </div>
                  )}

                  {/* 약 이름 */}
                  {selectedLog.category === 'medicine' && selectedLog.medicine_name && (
                    <div>
                      <p className="text-sm text-muted-foreground">약 이름</p>
                      <p className="font-medium">{selectedLog.medicine_name}</p>
                    </div>
                  )}

                  {/* 메모 */}
                  {selectedLog.memo && (
                    <div>
                      <p className="text-sm text-muted-foreground">메모</p>
                      <p className="font-medium whitespace-pre-wrap">{selectedLog.memo}</p>
                    </div>
                  )}

                  {/* 사진 */}
                  {selectedLog.photo_urls && selectedLog.photo_urls.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">
                        사진 ({selectedLog.photo_urls.length}장)
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {selectedLog.photo_urls.map((url, idx) => (
                          <div key={idx} className="relative aspect-square">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={`사진 ${idx + 1}`}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <DialogFooter className="flex-col sm:flex-row gap-2">
                {isEditing ? (
                  <>
                    <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
                      취소
                    </Button>
                    <Button onClick={handleSaveEdit} disabled={isSaving || isUploadingPhotos}>
                      {isSaving || isUploadingPhotos ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {isUploadingPhotos ? '사진 업로드 중...' : '저장 중...'}
                        </>
                      ) : (
                        '저장'
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    {onUpdate && (
                      <Button variant="outline" onClick={handleStartEdit}>
                        <Edit2 className="w-4 h-4 mr-2" />
                        수정
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="destructive"
                        onClick={() => {
                          setDeleteId(selectedLog.id)
                          setSelectedLog(null)
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        삭제
                      </Button>
                    )}
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
