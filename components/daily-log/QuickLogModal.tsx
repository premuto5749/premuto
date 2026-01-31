'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { Camera, X, Loader2 } from 'lucide-react'
import type { LogCategory, DailyLogInput } from '@/types'
import { LOG_CATEGORY_CONFIG } from '@/types'

const MAX_PHOTOS = 5

interface QuickLogModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  defaultDate?: string // YYYY-MM-DD 형식, 선택된 날짜가 있으면 해당 날짜로 초기화
}

// 현재 시간을 HH:MM 형식으로 반환
const getCurrentTime = () => {
  const now = new Date()
  return now.toTimeString().slice(0, 5)
}

// 오늘 날짜를 YYYY-MM-DD 형식으로 반환 (로컬 타임존)
const getCurrentDate = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function QuickLogModal({ open, onOpenChange, onSuccess, defaultDate }: QuickLogModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<LogCategory | null>(null)
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [medicineName, setMedicineName] = useState('')
  const [logTime, setLogTime] = useState(getCurrentTime())
  const [logDate, setLogDate] = useState(getCurrentDate())
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // 모달이 열릴 때마다 현재 시간으로 초기화 (defaultDate가 있으면 해당 날짜 사용)
  useEffect(() => {
    if (open) {
      setLogTime(getCurrentTime())
      setLogDate(defaultDate || getCurrentDate())
    }
  }, [open, defaultDate])

  // 사진 미리보기 URL cleanup
  useEffect(() => {
    return () => {
      photoPreviews.forEach(url => URL.revokeObjectURL(url))
    }
  }, [photoPreviews])

  const categories: LogCategory[] = ['meal', 'water', 'medicine', 'poop', 'pee', 'breathing']

  const resetForm = () => {
    setSelectedCategory(null)
    setAmount('')
    setMemo('')
    setMedicineName('')
    setLogTime(getCurrentTime())
    setLogDate(defaultDate || getCurrentDate())
    // 사진 미리보기 URL 정리
    photoPreviews.forEach(url => URL.revokeObjectURL(url))
    setPhotos([])
    setPhotoPreviews([])
  }

  // 사진 선택 핸들러
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const remainingSlots = MAX_PHOTOS - photos.length
    if (files.length > remainingSlots) {
      toast({
        title: '사진 개수 초과',
        description: `최대 ${MAX_PHOTOS}장까지만 첨부할 수 있습니다.`,
        variant: 'destructive',
      })
      return
    }

    // 파일 크기 및 타입 검증
    const validFiles: File[] = []
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: '파일 크기 초과',
          description: `${file.name}은(는) 5MB를 초과합니다.`,
          variant: 'destructive',
        })
        continue
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        toast({
          title: '지원하지 않는 형식',
          description: `${file.name}은(는) 지원하지 않는 이미지 형식입니다.`,
          variant: 'destructive',
        })
        continue
      }
      validFiles.push(file)
    }

    if (validFiles.length === 0) return

    // 미리보기 URL 생성
    const newPreviews = validFiles.map(file => URL.createObjectURL(file))

    setPhotos(prev => [...prev, ...validFiles])
    setPhotoPreviews(prev => [...prev, ...newPreviews])

    // input 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // 사진 제거 핸들러
  const handlePhotoRemove = (index: number) => {
    URL.revokeObjectURL(photoPreviews[index])
    setPhotos(prev => prev.filter((_, i) => i !== index))
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index))
  }

  // 사진 업로드 함수
  const uploadPhotos = async (): Promise<string[]> => {
    if (photos.length === 0) return []

    setIsUploading(true)
    try {
      const formData = new FormData()
      photos.forEach((photo, index) => {
        formData.append(`photo${index}`, photo)
      })

      const response = await fetch('/api/daily-logs/upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '사진 업로드 실패')
      }

      return result.data.urls
    } finally {
      setIsUploading(false)
    }
  }

  // 날짜와 시간을 ISO 문자열로 변환 (로컬 타임존 반영)
  const getLoggedAtISO = () => {
    // 로컬 시간으로 Date 객체 생성
    const localDate = new Date(`${logDate}T${logTime}:00`)
    return localDate.toISOString()
  }

  const handleSubmit = async () => {
    if (!selectedCategory) return

    setIsSubmitting(true)

    try {
      // 사진이 있으면 먼저 업로드
      let photoUrls: string[] = []
      if (photos.length > 0) {
        photoUrls = await uploadPhotos()
      }

      const config = LOG_CATEGORY_CONFIG[selectedCategory]
      const logData: DailyLogInput = {
        category: selectedCategory,
        logged_at: getLoggedAtISO(),
        amount: amount ? parseFloat(amount) : (selectedCategory === 'poop' || selectedCategory === 'pee' ? 1 : null),
        unit: config.unit,
        memo: memo || null,
        photo_urls: photoUrls,
        medicine_name: selectedCategory === 'medicine' ? medicineName : null,
      }

      const response = await fetch('/api/daily-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData),
      })

      if (!response.ok) {
        throw new Error('Failed to save log')
      }

      toast({
        title: '기록 완료',
        description: `${config.icon} ${config.label} 기록이 저장되었습니다.`,
      })

      resetForm()
      onOpenChange(false)
      onSuccess?.()

    } catch (error) {
      console.error('Failed to save log:', error)
      toast({
        title: '저장 실패',
        description: '기록 저장에 실패했습니다. 다시 시도해주세요.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCategoryClick = (category: LogCategory) => {
    // 모든 카테고리에서 입력 화면으로 이동 (배변/배뇨도 시간 선택 가능하도록)
    setSelectedCategory(category)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {selectedCategory ? LOG_CATEGORY_CONFIG[selectedCategory].icon + ' ' + LOG_CATEGORY_CONFIG[selectedCategory].label + ' 기록' : '빠른 기록'}
          </DialogTitle>
        </DialogHeader>

        {!selectedCategory ? (
          // 카테고리 선택 화면
          <div className="grid grid-cols-3 gap-3 py-4">
            {categories.map((cat) => {
              const config = LOG_CATEGORY_CONFIG[cat]
              return (
                <button
                  key={cat}
                  onClick={() => handleCategoryClick(cat)}
                  disabled={isSubmitting}
                  className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-muted hover:border-primary hover:bg-muted/50 transition-all"
                >
                  <span className="text-3xl mb-2">{config.icon}</span>
                  <span className="text-sm font-medium">{config.label}</span>
                </button>
              )
            })}
          </div>
        ) : (
          // 입력 화면
          <div className="space-y-4 py-4">
            {/* 시간 선택 */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">시간</label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="time"
                  value={logTime}
                  onChange={(e) => setLogTime(e.target.value)}
                  className="w-28"
                />
              </div>
            </div>

            {/* 양 입력 (배변/배뇨 제외) */}
            {selectedCategory !== 'poop' && selectedCategory !== 'pee' && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  {LOG_CATEGORY_CONFIG[selectedCategory].placeholder || '양'}
                </label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder={LOG_CATEGORY_CONFIG[selectedCategory].placeholder}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="flex-1"
                  />
                  <span className="flex items-center text-muted-foreground px-3 bg-muted rounded-md">
                    {LOG_CATEGORY_CONFIG[selectedCategory].unit}
                  </span>
                </div>
              </div>
            )}

            {/* 약 이름 (약일 때만) */}
            {selectedCategory === 'medicine' && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">약 이름</label>
                <Input
                  placeholder="예: 타이레놀, 소화제"
                  value={medicineName}
                  onChange={(e) => setMedicineName(e.target.value)}
                />
              </div>
            )}

            {/* 메모 */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">메모 (선택)</label>
              <Textarea
                placeholder="추가 메모..."
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={2}
              />
            </div>

            {/* 사진 첨부 */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                사진 (선택, 최대 {MAX_PHOTOS}장)
              </label>

              {/* 사진 미리보기 */}
              {photoPreviews.length > 0 && (
                <div className="grid grid-cols-5 gap-2 mb-2">
                  {photoPreviews.map((preview, index) => (
                    <div key={index} className="relative aspect-square">
                      <Image
                        src={preview}
                        alt={`사진 ${index + 1}`}
                        fill
                        className="object-cover rounded-md"
                      />
                      <button
                        type="button"
                        onClick={() => handlePhotoRemove(index)}
                        className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 사진 추가 버튼 */}
              {photos.length < MAX_PHOTOS && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSubmitting || isUploading}
                    className="w-full"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    사진 추가 ({photos.length}/{MAX_PHOTOS})
                  </Button>
                </>
              )}
            </div>

            {/* 버튼 */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setSelectedCategory(null)}
                disabled={isSubmitting || isUploading}
                className="flex-1"
              >
                뒤로
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || isUploading}
                className="flex-1"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    사진 업로드 중...
                  </>
                ) : isSubmitting ? (
                  '저장 중...'
                ) : (
                  '저장'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
