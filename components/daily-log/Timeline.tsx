'use client'

import { useState, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Trash2, ImageIcon, Edit2, Loader2, X, Camera, Image as ImagePlus, ChevronLeft, ChevronRight } from 'lucide-react'
import type { DailyLog } from '@/types'
import { LOG_CATEGORY_CONFIG } from '@/types'
import { compressImage } from '@/lib/image-compressor'
import { formatNumber } from '@/lib/utils'
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

// 타임라인에 표시할 항목 (산책은 시작/종료 분리)
interface TimelineItem {
  log: DailyLog
  walkPhase?: 'start' | 'end' // walk 카테고리일 때만 설정
  walkGroupId?: string // 산책 그룹에 속한 항목 (시작/중간활동/종료)
  walkGroupPos?: 'start' | 'middle' | 'end' | 'only' // 그룹 내 위치
  displayTime: string // 정렬 및 표시에 사용할 시간
}

interface TimelineProps {
  logs: DailyLog[]
  onDelete?: (id: string) => void
  onUpdate?: (id: string, data: Partial<DailyLog>) => Promise<void>
  petId?: string
}

function buildTimelineItems(logs: DailyLog[]): TimelineItem[] {
  const items: TimelineItem[] = []
  for (const log of logs) {
    if (log.category === 'walk') {
      items.push({ log, walkPhase: 'start', displayTime: log.logged_at })
      if (log.walk_end_at) {
        items.push({ log, walkPhase: 'end', displayTime: log.walk_end_at })
      }
    } else {
      items.push({ log, displayTime: log.logged_at })
    }
  }
  // 시간순 정렬 (최신이 위)
  items.sort((a, b) => new Date(b.displayTime).getTime() - new Date(a.displayTime).getTime())

  // 산책 그룹 마킹: walk_id가 있는 활동과 해당 산책 시작/종료를 그룹화
  for (const item of items) {
    if (item.walkPhase) {
      // 산책 시작/종료 항목
      item.walkGroupId = item.log.id
    } else if (item.log.walk_id) {
      // 산책 중 기록된 활동
      item.walkGroupId = item.log.walk_id
    }
  }

  // 그룹 내 위치(start/middle/end) 결정 — 연속된 같은 walkGroupId 기준
  for (let i = 0; i < items.length; i++) {
    const gid = items[i].walkGroupId
    if (!gid) continue
    const prevSame = i > 0 && items[i - 1].walkGroupId === gid
    const nextSame = i < items.length - 1 && items[i + 1].walkGroupId === gid
    if (prevSame && nextSame) items[i].walkGroupPos = 'middle'
    else if (prevSame) items[i].walkGroupPos = 'end'
    else if (nextSame) items[i].walkGroupPos = 'start'
    else items[i].walkGroupPos = 'only'
  }

  return items
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
  const [editSnackName, setEditSnackName] = useState<string>('')
  const [editDate, setEditDate] = useState<string>('')
  const [editTime, setEditTime] = useState<string>('')
  const [editPhotos, setEditPhotos] = useState<string[]>([])
  const [newPhotoFiles, setNewPhotoFiles] = useState<File[]>([])
  const [newPhotoPreviews, setNewPhotoPreviews] = useState<string[]>([])
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false)
  const editCameraInputRef = useRef<HTMLInputElement>(null)
  const editGalleryInputRef = useRef<HTMLInputElement>(null)
  const [editMedicineInputMode, setEditMedicineInputMode] = useState<'preset' | 'manual'>('manual')
  const [editSnackInputMode, setEditSnackInputMode] = useState<'preset' | 'manual'>('manual')
  // Lightbox carousel state
  const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    const time = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    const [period, clock] = time.split(' ')
    return { period, clock }
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

  const formatValue = (log: DailyLog, walkPhase?: 'start' | 'end') => {
    const config = LOG_CATEGORY_CONFIG[log.category]

    if (log.category === 'poop' || log.category === 'pee') {
      return '' // 배변/배뇨는 양 표시 안함
    }

    if (log.category === 'weight' && log.amount !== null && log.amount !== undefined) {
      return `${Number(log.amount).toFixed(1)}kg`
    }

    if (log.category === 'walk') {
      if (walkPhase === 'end' && log.amount !== null && log.amount !== undefined) {
        return `${formatNumber(log.amount)}분`
      }
      if (walkPhase === 'start' && !log.walk_end_at) return '산책 중'
      return ''
    }

    // 식사의 경우 급여량과 식사량 표시
    if (log.category === 'meal' && log.amount !== null && log.amount !== undefined) {
      const leftover = log.leftover_amount || 0
      const eaten = log.amount - leftover
      if (leftover > 0) {
        return `${formatNumber(eaten)}g (급여 ${formatNumber(log.amount)}g, 남김 ${formatNumber(leftover)}g)`
      }
      return `${formatNumber(log.amount)}${log.unit || config.unit}`
    }

    if (log.amount !== null && log.amount !== undefined) {
      return `${formatNumber(log.amount)}${log.unit || config.unit}`
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
    setEditSnackName(log.snack_name || '')
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
    setEditSnackName(selectedLog.snack_name || '')
    setEditDate(extractDateFromISO(selectedLog.logged_at))
    setEditTime(extractTimeFromISO(selectedLog.logged_at))
    setEditPhotos(selectedLog.photo_urls || [])
    setNewPhotoFiles([])
    setNewPhotoPreviews([])
    // 프리셋/직접입력 판별 (input_source 필드 사용)
    const isPreset = selectedLog.input_source === 'preset'
    setEditSnackInputMode(isPreset ? 'preset' : 'manual')
    setEditMedicineInputMode(isPreset ? 'preset' : 'manual')
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditMedicineInputMode('manual')
    setEditSnackInputMode('manual')
    if (selectedLog) {
      setEditAmount(selectedLog.amount?.toString() || '')
      setEditLeftoverAmount(selectedLog.leftover_amount?.toString() || '')
      setEditMemo(selectedLog.memo || '')
      setEditMedicineName(selectedLog.medicine_name || '')
      setEditSnackName(selectedLog.snack_name || '')
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
      // 새 사진 업로드 (압축 후)
      let uploadedPhotoUrls: string[] = []
      if (newPhotoFiles.length > 0) {
        setIsUploadingPhotos(true)

        // 이미지 압축 (Vercel 4.5MB 페이로드 제한 방지)
        const compressedFiles = await Promise.all(
          newPhotoFiles.map(file => compressImage(file))
        )

        const formData = new FormData()
        compressedFiles.forEach(file => {
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

      // 간식인 경우 간식 이름 업데이트
      if (selectedLog.category === 'snack') {
        updateData.snack_name = editSnackName || null
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

  // 사진을 기기에 저장하는 함수
  const savePhotoToDevice = (file: File) => {
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = `mimo_${new Date().toISOString().slice(0, 10)}_${Date.now()}.jpg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>, isFromCamera = false) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    // 파일 추가
    setNewPhotoFiles(prev => [...prev, ...files])

    // 미리보기 생성 및 카메라 촬영 시 기기에 저장
    files.forEach(file => {
      if (isFromCamera) {
        savePhotoToDevice(file)
      }
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

  const timelineItems = buildTimelineItems(logs)

  return (
    <>
      <div>
        {timelineItems.map((item, idx) => {
          const { log, walkPhase, walkGroupId, walkGroupPos, displayTime } = item
          const config = LOG_CATEGORY_CONFIG[log.category]
          const itemKey = walkPhase ? `${log.id}-${walkPhase}` : log.id
          const walkLabel = walkPhase === 'start' ? '산책 시작' : walkPhase === 'end' ? '산책 종료' : null
          const isInWalkGroup = !!walkGroupId

          // 산책 그룹 왼쪽 라인 스타일
          const groupBorderClass = isInWalkGroup
            ? `border-l-[3px] border-l-green-400 ${
                walkGroupPos === 'start' ? 'rounded-tl-lg' :
                walkGroupPos === 'end' ? 'rounded-bl-lg' : ''
              }`
            : ''

          // 산책 중 활동(walk_id 연결)은 살짝 들여쓰기
          const isWalkChild = !walkPhase && !!log.walk_id

          // 그룹 내 연속 항목은 간격 좁게, 그 외는 기본 간격
          const isGroupContinuation = isInWalkGroup && (walkGroupPos === 'middle' || walkGroupPos === 'end')
          const marginClass = idx === 0 ? '' : isGroupContinuation ? 'mt-px' : 'mt-3'

          return (
            <div key={itemKey} className={`${marginClass} ${isWalkChild ? 'ml-3' : ''}`}>
              <Card
                className={`overflow-hidden cursor-pointer hover:bg-muted/50 transition-colors ${groupBorderClass}`}
                onClick={() => handleOpenDetail(log)}
              >
                <CardContent className="p-0">
                  <div className="flex items-center">
                    {/* 시간 */}
                    <div className="w-16 py-3 text-center text-muted-foreground border-r">
                      <div className="text-[11px] leading-tight">{formatTime(displayTime).period}</div>
                      <div className="text-sm leading-tight">{formatTime(displayTime).clock}</div>
                    </div>

                    {/* 아이콘 */}
                    <div className="w-14 py-3 text-center text-2xl">
                      {config.icon}
                    </div>

                    {/* 내용 */}
                    <div className="flex-1 py-3 px-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{walkLabel || config.label}</span>
                        {log.category === 'snack' && log.snack_name && (
                          <span className="text-sm text-pink-600">
                            {log.snack_name}
                          </span>
                        )}
                        {formatValue(log, walkPhase) && (
                          <span className="text-sm text-muted-foreground">
                            {formatValue(log, walkPhase)}
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
            </div>
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
      <Dialog
        open={!!selectedLog}
        onOpenChange={(open) => {
          if (!open) handleCloseDialog()
        }}
      >
        <DialogContent
          className="sm:max-w-md"
          onPointerDownOutside={(e) => { if (isEditing) e.preventDefault() }}
          onFocusOutside={(e) => { if (isEditing) e.preventDefault() }}
          onEscapeKeyDown={(e) => { if (isEditing) e.preventDefault() }}
        >
          {selectedLog && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="text-2xl">{LOG_CATEGORY_CONFIG[selectedLog.category].icon}</span>
                  {LOG_CATEGORY_CONFIG[selectedLog.category].label}
                </DialogTitle>
                <DialogDescription className="sr-only">기록 상세 보기</DialogDescription>
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
                              {formatNumber(parseFloat(editAmount) - (editLeftoverAmount ? parseFloat(editLeftoverAmount) : 0))}g
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 양 입력 (음수, 호흡수 - 배변/배뇨/식사/약/간식 제외) */}
                  {selectedLog.category !== 'poop' && selectedLog.category !== 'pee' && selectedLog.category !== 'meal' && selectedLog.category !== 'medicine' && selectedLog.category !== 'snack' && selectedLog.category !== 'walk' && (
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
                    <div className="space-y-3">
                      {editMedicineInputMode === 'preset' ? (
                        <div className="space-y-2">
                          <Label>약 이름</Label>
                          <div className="p-3 bg-muted/50 rounded-md text-sm font-medium">
                            {editMedicineName}
                          </div>
                        </div>
                      ) : (
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
                    </div>
                  )}

                  {/* 간식 (간식인 경우만) */}
                  {selectedLog.category === 'snack' && (
                    <div className="space-y-3">
                      {editSnackInputMode === 'preset' ? (
                        <div className="space-y-2">
                          <Label>간식 이름</Label>
                          <div className="p-3 bg-muted/50 rounded-md text-sm font-medium">
                            {editSnackName}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label htmlFor="edit-snack">간식 이름</Label>
                          <Input
                            id="edit-snack"
                            value={editSnackName}
                            onChange={(e) => setEditSnackName(e.target.value)}
                            placeholder="간식 이름 입력"
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="edit-snack-amount">양 ({LOG_CATEGORY_CONFIG['snack'].unit})</Label>
                        <Input
                          id="edit-snack-amount"
                          type="number"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          placeholder={LOG_CATEGORY_CONFIG['snack'].placeholder}
                        />
                      </div>
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

                    {/* 사진 추가 버튼 (file input은 Dialog 바깥에 위치 — focus trap 충돌 방지) */}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => editCameraInputRef.current?.click()}
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        촬영
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => editGalleryInputRef.current?.click()}
                      >
                        <ImagePlus className="w-4 h-4 mr-2" />
                        갤러리
                      </Button>
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
                        <span className="font-medium">{formatNumber(selectedLog.amount)}g</span>
                      </div>
                      {(selectedLog.leftover_amount ?? 0) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">남긴 양</span>
                          <span className="font-medium">{formatNumber(selectedLog.leftover_amount!)}g</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-sm font-medium">실제 식사량</span>
                        <span className="font-medium text-primary">
                          {formatNumber(selectedLog.amount - (selectedLog.leftover_amount || 0))}g
                        </span>
                      </div>
                    </div>
                  )}

                  {/* 산책 정보 */}
                  {selectedLog.category === 'walk' && (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">시작 시각</span>
                        <span className="font-medium">
                          {new Date(selectedLog.logged_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {selectedLog.walk_end_at ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">종료 시각</span>
                            <span className="font-medium">
                              {new Date(selectedLog.walk_end_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {selectedLog.amount && (
                            <div className="flex justify-between border-t pt-2">
                              <span className="text-sm font-medium">산책 시간</span>
                              <span className="font-medium text-green-700">{formatNumber(selectedLog.amount)}분</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">상태</span>
                          <span className="text-sm font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded">진행 중</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 양 (음수, 호흡수 - 배변/배뇨/식사/산책 제외) */}
                  {selectedLog.category !== 'poop' && selectedLog.category !== 'pee' && selectedLog.category !== 'meal' && selectedLog.category !== 'walk' && selectedLog.amount !== null && (
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {selectedLog.category === 'breathing' ? '호흡수' : '양'}
                      </p>
                      <p className="font-medium">
                        {formatNumber(selectedLog.amount)} {selectedLog.unit || LOG_CATEGORY_CONFIG[selectedLog.category].unit}
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

                  {/* 간식 이름 */}
                  {selectedLog.category === 'snack' && selectedLog.snack_name && (
                    <div>
                      <p className="text-sm text-muted-foreground">간식 이름</p>
                      <p className="font-medium">{selectedLog.snack_name}</p>
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
                          <div
                            key={idx}
                            className="relative aspect-square bg-muted rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => {
                              setLightboxPhotos(selectedLog.photo_urls || [])
                              setLightboxIndex(idx)
                            }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={`사진 ${idx + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                console.error('Image load error:', url)
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                                target.parentElement!.innerHTML = `<div class="w-full h-full flex items-center justify-center text-xs text-muted-foreground p-2 text-center">이미지 로드 실패</div>`
                              }}
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

      {/* 사진 첨부용 file input — Dialog 바깥에 위치하여 focus trap 충돌 방지 */}
      <input
        ref={editCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handlePhotoSelect(e, true)}
        className="hidden"
      />
      <input
        ref={editGalleryInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handlePhotoSelect(e, false)}
        className="hidden"
      />

      {/* 이미지 확대 보기 (Lightbox Carousel) */}
      <Dialog open={lightboxPhotos.length > 0} onOpenChange={() => setLightboxPhotos([])}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none [&>button]:hidden" aria-describedby={undefined}>
          <DialogTitle className="sr-only">사진 확대 보기</DialogTitle>
          {/* 커스텀 컨트롤 wrapper (기본 X 버튼 숨김 규칙 우회) */}
          <div className="relative w-full h-full">
            {/* 닫기 버튼 */}
            <button
              onClick={() => setLightboxPhotos([])}
              className="absolute top-4 right-4 z-50 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {/* 이전 버튼 */}
            {lightboxPhotos.length > 1 && (
              <button
                onClick={() => setLightboxIndex((prev) => (prev - 1 + lightboxPhotos.length) % lightboxPhotos.length)}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
            )}

            {/* 다음 버튼 */}
            {lightboxPhotos.length > 1 && (
              <button
                onClick={() => setLightboxIndex((prev) => (prev + 1) % lightboxPhotos.length)}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            )}

            {/* 페이지 인디케이터 */}
            {lightboxPhotos.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-2">
                {lightboxPhotos.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setLightboxIndex(idx)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      idx === lightboxIndex ? 'bg-white' : 'bg-white/40 hover:bg-white/60'
                    }`}
                  />
                ))}
              </div>
            )}

            {lightboxPhotos[lightboxIndex] && (
              <div className="w-full h-full flex items-center justify-center p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={lightboxPhotos[lightboxIndex]}
                  alt={`사진 ${lightboxIndex + 1}/${lightboxPhotos.length}`}
                  className="max-w-full max-h-[85vh] object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
