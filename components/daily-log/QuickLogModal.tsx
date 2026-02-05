'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { Camera, X, Loader2, Image as ImageIcon } from 'lucide-react'
import type { LogCategory, DailyLogInput, MedicinePreset } from '@/types'
import { LOG_CATEGORY_CONFIG } from '@/types'
import { compressImage } from '@/lib/image-compressor'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const MAX_PHOTOS = 5

interface QuickLogModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  defaultDate?: string // YYYY-MM-DD 형식, 선택된 날짜가 있으면 해당 날짜로 초기화
  petId?: string // 반려동물 ID
  onBreathingSelect?: () => void // 호흡수 선택 시 타이머 모달 열기
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

export function QuickLogModal({ open, onOpenChange, onSuccess, defaultDate, petId, onBreathingSelect }: QuickLogModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<LogCategory | null>(null)
  const [amount, setAmount] = useState('')
  const [leftoverAmount, setLeftoverAmount] = useState('')  // 남긴 양 (식사용)
  const [memo, setMemo] = useState('')
  const [medicineName, setMedicineName] = useState('')
  const [medicineDosage, setMedicineDosage] = useState('')
  const [medicineDosageUnit, setMedicineDosageUnit] = useState('정')
  const [medicineInputMode, setMedicineInputMode] = useState<'preset' | 'manual'>('preset')
  const [medicinePresets, setMedicinePresets] = useState<MedicinePreset[]>([])
  const [selectedPreset, setSelectedPreset] = useState<MedicinePreset | null>(null)
  const [logTime, setLogTime] = useState(getCurrentTime())
  const [logDate, setLogDate] = useState(getCurrentDate())
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
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

  // 약 프리셋 로드
  useEffect(() => {
    const fetchPresets = async () => {
      try {
        const res = await fetch('/api/medicine-presets')
        if (res.ok) {
          const data = await res.json()
          setMedicinePresets(data.data || [])
        }
      } catch (err) {
        console.error('Failed to fetch medicine presets:', err)
      }
    }
    fetchPresets()
  }, [])

  const categories: LogCategory[] = ['meal', 'water', 'medicine', 'poop', 'pee', 'breathing']

  const resetForm = () => {
    setSelectedCategory(null)
    setAmount('')
    setLeftoverAmount('')
    setMemo('')
    setMedicineName('')
    setMedicineDosage('')
    setMedicineDosageUnit('정')
    setMedicineInputMode('preset')
    setSelectedPreset(null)
    setLogTime(getCurrentTime())
    setLogDate(defaultDate || getCurrentDate())
    // 사진 미리보기 URL 정리
    photoPreviews.forEach(url => URL.revokeObjectURL(url))
    setPhotos([])
    setPhotoPreviews([])
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

  // 사진 선택 핸들러
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>, isFromCamera = false) => {
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

    // 파일 크기 및 타입 검증 (이미지 타입 더 유연하게)
    const validFiles: File[] = []
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: '파일 크기 초과',
          description: `${file.name}은(는) 10MB를 초과합니다.`,
          variant: 'destructive',
        })
        continue
      }
      // 이미지 타입 체크 (카메라 촬영 시 다양한 포맷 허용)
      if (!file.type.startsWith('image/')) {
        toast({
          title: '지원하지 않는 형식',
          description: `${file.name}은(는) 이미지 파일이 아닙니다.`,
          variant: 'destructive',
        })
        continue
      }
      validFiles.push(file)

      // 카메라로 촬영한 사진은 기기에도 저장
      if (isFromCamera) {
        savePhotoToDevice(file)
      }
    }

    if (validFiles.length === 0) return

    // 미리보기 URL 생성
    const newPreviews = validFiles.map(file => URL.createObjectURL(file))

    setPhotos(prev => [...prev, ...validFiles])
    setPhotoPreviews(prev => [...prev, ...newPreviews])

    // input 초기화 (같은 파일 다시 선택 가능하도록)
    e.target.value = ''
  }

  // 사진 제거 핸들러
  const handlePhotoRemove = (index: number) => {
    URL.revokeObjectURL(photoPreviews[index])
    setPhotos(prev => prev.filter((_, i) => i !== index))
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index))
  }

  // 사진 업로드 함수 (API를 통해 업로드, 압축 적용)
  const uploadPhotos = async (): Promise<string[]> => {
    if (photos.length === 0) return []

    setIsUploading(true)
    try {
      // 이미지 압축 (Vercel 4.5MB 페이로드 제한 방지)
      const compressedPhotos = await Promise.all(
        photos.map(photo => compressImage(photo))
      )

      const formData = new FormData()
      compressedPhotos.forEach((photo, index) => {
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

  // 날짜와 시간을 ISO 문자열로 변환 (한국 시간 KST, UTC+9 명시)
  const getLoggedAtISO = () => {
    // KST 타임존을 명시적으로 포함하여 시간대 변환 문제 방지
    // 예: "2025-02-01T14:30:00+09:00"
    return `${logDate}T${logTime}:00+09:00`
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

      // 약 이름 조합
      let fullMedicineName = null
      if (selectedCategory === 'medicine') {
        if (medicineInputMode === 'preset' && selectedPreset) {
          // 프리셋 선택: "프리셋명 (약1, 약2, ...)" 형식
          const medicineList = selectedPreset.medicines.map(m =>
            `${m.name} ${m.dosage}${m.dosage_unit === 'tablet' ? '정' : m.dosage_unit}`
          ).join(', ')
          fullMedicineName = `${selectedPreset.preset_name} (${medicineList})`
        } else if (medicineInputMode === 'manual' && medicineName) {
          // 직접 입력: "약이름 복용량단위" 형식
          fullMedicineName = medicineDosage
            ? `${medicineName} ${medicineDosage}${medicineDosageUnit}`
            : medicineName
        }
      }

      const logData: DailyLogInput = {
        category: selectedCategory,
        pet_id: petId || null,
        logged_at: getLoggedAtISO(),
        amount: amount ? parseFloat(amount) : (selectedCategory === 'poop' || selectedCategory === 'pee' ? 1 : null),
        leftover_amount: selectedCategory === 'meal' ? (leftoverAmount ? parseFloat(leftoverAmount) : 0) : null,
        unit: config.unit,
        memo: memo || null,
        photo_urls: photoUrls,
        medicine_name: fullMedicineName,
      }

      const response = await fetch('/api/daily-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData),
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('Daily log save failed:', result)
        throw new Error(result.error || 'Failed to save log')
      }

      // 저장된 데이터 검증
      if (!result.data?.id) {
        console.error('Daily log save returned no data:', result)
        throw new Error('저장된 데이터를 확인할 수 없습니다')
      }

      console.log('Daily log saved successfully:', result.data.id)

      toast({
        title: '기록 완료',
        description: `${config.icon} ${config.label} 기록이 저장되었습니다.`,
      })

      resetForm()
      onOpenChange(false)
      onSuccess?.()

    } catch (error) {
      console.error('Failed to save log:', error)
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
      toast({
        title: '저장 실패',
        description: `기록 저장에 실패했습니다: ${errorMessage}`,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCategoryClick = (category: LogCategory) => {
    // 호흡수 선택 시 타이머 모달 열기
    if (category === 'breathing' && onBreathingSelect) {
      onBreathingSelect()
      return
    }
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

            {/* 식사 양 입력 (급여량, 남긴양, 식사량) */}
            {selectedCategory === 'meal' && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">급여량</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="급여량 (g)"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="flex-1"
                    />
                    <span className="flex items-center text-muted-foreground px-3 bg-muted rounded-md">
                      g
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">남긴 양 (선택)</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="남긴 양 (g)"
                      value={leftoverAmount}
                      onChange={(e) => setLeftoverAmount(e.target.value)}
                      className="flex-1"
                    />
                    <span className="flex items-center text-muted-foreground px-3 bg-muted rounded-md">
                      g
                    </span>
                  </div>
                </div>
                {/* 식사량 계산 결과 표시 */}
                {amount && (
                  <div className="p-3 bg-muted/50 rounded-md">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">실제 식사량</span>
                      <span className="font-medium">
                        {(parseFloat(amount) - (leftoverAmount ? parseFloat(leftoverAmount) : 0)).toFixed(0)}g
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 양 입력 (음수, 호흡수 - 배변/배뇨/식사 제외) */}
            {selectedCategory !== 'poop' && selectedCategory !== 'pee' && selectedCategory !== 'meal' && selectedCategory !== 'medicine' && (
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

            {/* 약 선택 (약일 때만) */}
            {selectedCategory === 'medicine' && (
              <div className="space-y-3">
                {/* 프리셋/직접입력 탭 */}
                <Tabs value={medicineInputMode} onValueChange={(v) => {
                  setMedicineInputMode(v as 'preset' | 'manual')
                  setSelectedPreset(null)
                  setMedicineName('')
                  setMedicineDosage('')
                }}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="preset">프리셋 선택</TabsTrigger>
                    <TabsTrigger value="manual">직접 입력</TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* 프리셋 선택 모드 */}
                {medicineInputMode === 'preset' && (
                  <div>
                    {medicinePresets.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {medicinePresets.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setSelectedPreset(selectedPreset?.id === preset.id ? null : preset)}
                            className={`p-3 rounded-lg border-2 text-left transition-all ${
                              selectedPreset?.id === preset.id
                                ? 'border-primary bg-primary/10'
                                : 'border-muted hover:border-primary/50'
                            }`}
                          >
                            <div className="font-medium text-sm">{preset.preset_name}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {preset.medicines.map(m => m.name).join(', ')}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        등록된 프리셋이 없습니다.<br />
                        설정에서 약 프리셋을 추가하세요.
                      </div>
                    )}
                  </div>
                )}

                {/* 직접 입력 모드 */}
                {medicineInputMode === 'manual' && (
                  <>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">약 이름</label>
                      <Input
                        placeholder="예: 타이레놀, 소화제"
                        value={medicineName}
                        onChange={(e) => setMedicineName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">복용량 (선택)</label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="복용량"
                          value={medicineDosage}
                          onChange={(e) => setMedicineDosage(e.target.value)}
                          className="flex-1"
                        />
                        <select
                          value={medicineDosageUnit}
                          onChange={(e) => setMedicineDosageUnit(e.target.value)}
                          className="px-3 py-2 border rounded-md bg-background text-sm"
                        >
                          <option value="정">정</option>
                          <option value="mg">mg</option>
                          <option value="ml">ml</option>
                          <option value="포">포</option>
                          <option value="캡슐">캡슐</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}
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
                <div className="flex gap-2">
                  {/* 카메라 촬영 버튼 */}
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handlePhotoSelect(e, true)}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={isSubmitting || isUploading}
                    className="flex-1"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    촬영
                  </Button>

                  {/* 갤러리 선택 버튼 */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handlePhotoSelect(e, false)}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSubmitting || isUploading}
                    className="flex-1"
                  >
                    <ImageIcon className="w-4 h-4 mr-2" />
                    갤러리 ({photos.length}/{MAX_PHOTOS})
                  </Button>
                </div>
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
