'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { Camera, X, Loader2, Image as ImageIcon, Repeat } from 'lucide-react'
import type { LogCategory, DailyLog, DailyLogInput, MedicinePreset, SnackPreset } from '@/types'
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
  currentWeight?: number | null // 현재 체중 (체중 기록 페이지에서 pre-fill)
  onWeightLogged?: () => void // 체중 기록 후 콜백
  activeWalk?: DailyLog | null // 현재 진행 중인 산책
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

export function QuickLogModal({ open, onOpenChange, onSuccess, defaultDate, petId, onBreathingSelect, currentWeight, onWeightLogged, activeWalk }: QuickLogModalProps) {
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
  // 간식 상태
  const [snackInputMode, setSnackInputMode] = useState<'preset' | 'manual'>('preset')
  const [snackPresets, setSnackPresets] = useState<SnackPreset[]>([])
  const [snackSelections, setSnackSelections] = useState<Record<string, number>>({})
  const [snackName, setSnackName] = useState('')
  const [snackUnit, setSnackUnit] = useState('개')
  const [logTime, setLogTime] = useState(getCurrentTime())
  const [logDate, setLogDate] = useState(getCurrentDate())
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // 체중 입력 상태
  const [weightInput, setWeightInput] = useState('')
  const [isWeightSubmitting, setIsWeightSubmitting] = useState(false)

  // 카테고리 페이지 스와이프 상태
  const [categoryPage, setCategoryPage] = useState(0) // 0: 6개 카테고리, 1: 체중
  const touchStartX = useRef<number>(0)

  const handleCategoryTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }, [])

  const handleCategoryTouchEnd = useCallback((e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) {
      if (diff > 0 && categoryPage === 0) setCategoryPage(1)
      else if (diff < 0 && categoryPage === 1) setCategoryPage(0)
    }
  }, [categoryPage])

  // 모달이 열릴 때마다 현재 시간으로 초기화 (defaultDate가 있으면 해당 날짜 사용)
  useEffect(() => {
    if (open) {
      setLogTime(getCurrentTime())
      setLogDate(defaultDate || getCurrentDate())
      setCategoryPage(0)
      setWeightInput(currentWeight?.toString() || '')
    }
  }, [open, defaultDate, currentWeight])

  // 사진 미리보기 URL cleanup
  useEffect(() => {
    return () => {
      photoPreviews.forEach(url => URL.revokeObjectURL(url))
    }
  }, [photoPreviews])

  // 약/간식 프리셋 로드 (현재 선택된 반려동물에 맞는 프리셋만)
  useEffect(() => {
    const fetchPresets = async () => {
      try {
        const petQuery = petId ? `?pet_id=${petId}` : ''
        const [medRes, snackRes] = await Promise.all([
          fetch(`/api/medicine-presets${petQuery}`),
          fetch(`/api/snack-presets${petQuery}`)
        ])
        if (medRes.ok) {
          const data = await medRes.json()
          setMedicinePresets(data.data || [])
        }
        if (snackRes.ok) {
          const data = await snackRes.json()
          setSnackPresets(data.data || [])
        }
      } catch (err) {
        console.error('Failed to fetch presets:', err)
      }
    }
    fetchPresets()
  }, [petId])

  const categories: LogCategory[] = ['meal', 'water', 'snack', 'poop', 'pee', 'breathing']

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
    setSnackInputMode('preset')
    setSnackSelections({})
    setSnackName('')
    setSnackUnit('개')
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

    // input 초기화 (카메라, 갤러리 모두)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = ''
    }
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
    // 현재 초를 포함하여 같은 분 내 기록도 생성 순서 유지
    const seconds = String(new Date().getSeconds()).padStart(2, '0')
    return `${logDate}T${logTime}:${seconds}+09:00`
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

      // 간식 프리셋 모드: 선택된 프리셋별로 개별 엔트리 POST
      if (selectedCategory === 'snack' && snackInputMode === 'preset') {
        const entries = Object.entries(snackSelections)

        let isFirst = true
        for (const [presetId, count] of entries) {
          const preset = snackPresets.find(p => p.id === presetId)
          if (!preset) continue

          const presetAmount = count * (preset.default_amount || 1)
          const presetCalories = preset.calories_per_unit
            ? Math.round(count * preset.calories_per_unit * 100) / 100
            : null

          const logData: DailyLogInput = {
            category: 'snack',
            pet_id: petId || null,
            logged_at: getLoggedAtISO(),
            amount: presetAmount,
            unit: preset.unit || '개',
            memo: memo || null,
            photo_urls: isFirst ? photoUrls : [],
            snack_name: preset.name,
            calories: presetCalories,
            input_source: 'preset',
            walk_id: activeWalk?.id || null,
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
          if (!result.data?.id) {
            console.error('Daily log save returned no data:', result)
            throw new Error('저장된 데이터를 확인할 수 없습니다')
          }
          console.log('Daily log saved successfully:', result.data.id)
          isFirst = false
        }
      } else {
      // 간식 직접 입력 또는 다른 카테고리
      const fullSnackName: string | null = (selectedCategory === 'snack' && snackInputMode === 'manual' && snackName) ? snackName : null
      const snackCalories: number | null = null

      const logData: DailyLogInput = {
        category: selectedCategory,
        pet_id: petId || null,
        logged_at: getLoggedAtISO(),
        amount: amount ? parseFloat(amount) : (selectedCategory === 'poop' || selectedCategory === 'pee' ? 1 : null),
        leftover_amount: selectedCategory === 'meal' ? (leftoverAmount ? parseFloat(leftoverAmount) : 0) : null,
        unit: selectedCategory === 'snack' ? snackUnit : config.unit,
        memo: memo || null,
        photo_urls: photoUrls,
        medicine_name: fullMedicineName,
        snack_name: fullSnackName,
        calories: snackCalories,
        input_source: (selectedCategory === 'medicine' && medicineInputMode === 'preset') ? 'preset' : 'manual',
        walk_id: activeWalk?.id || null,
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

      if (!result.data?.id) {
        console.error('Daily log save returned no data:', result)
        throw new Error('저장된 데이터를 확인할 수 없습니다')
      }

      console.log('Daily log saved successfully:', result.data.id)
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

  // 체중 기록 제출
  const handleWeightSubmit = async () => {
    if (!weightInput || !petId) return

    setIsWeightSubmitting(true)
    try {
      const logData: DailyLogInput = {
        category: 'weight',
        pet_id: petId,
        logged_at: `${logDate}T${logTime}:00+09:00`,
        amount: parseFloat(weightInput),
        unit: 'kg',
      }

      const response = await fetch('/api/daily-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData),
      })

      if (!response.ok) throw new Error('Failed to save weight')

      toast({
        title: '체중 기록 완료',
        description: `⚖️ ${weightInput}kg 기록되었습니다.`,
      })

      onWeightLogged?.()
      onSuccess?.()
      onOpenChange(false)
    } catch (error) {
      console.error('Weight save error:', error)
      toast({
        title: '저장 실패',
        description: '체중 기록에 실패했습니다.',
        variant: 'destructive',
      })
    } finally {
      setIsWeightSubmitting(false)
    }
  }

  // 산책 시작/종료 제출
  const handleWalkSubmit = async () => {
    if (!petId) return

    setIsSubmitting(true)
    try {
      if (!activeWalk) {
        // 산책 시작: POST
        const logData: DailyLogInput = {
          category: 'walk',
          pet_id: petId,
          logged_at: getLoggedAtISO(),
          walk_end_at: null,
          memo: memo || null,
        }

        const response = await fetch('/api/daily-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logData),
        })

        if (!response.ok) throw new Error('Failed to start walk')

        toast({
          title: '산책 시작',
          description: '🐕 산책이 시작되었습니다. 종료 시 다시 기록해주세요.',
        })
      } else {
        // 산책 종료: PATCH
        const endAt = getLoggedAtISO()
        const startTime = new Date(activeWalk.logged_at).getTime()
        const endTime = new Date(endAt).getTime()

        if (endTime <= startTime) {
          toast({
            title: '종료 시간 오류',
            description: '종료 시간은 시작 시간 이후여야 합니다.',
            variant: 'destructive',
          })
          setIsSubmitting(false)
          return
        }

        const durationMinutes = Math.round((endTime - startTime) / 60000) || 1

        const response = await fetch('/api/daily-logs', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: activeWalk.id,
            walk_end_at: endAt,
            amount: durationMinutes,
            unit: '분',
            memo: memo || activeWalk.memo || null,
          }),
        })

        if (!response.ok) throw new Error('Failed to end walk')

        toast({
          title: '산책 종료',
          description: `🐕 산책 ${durationMinutes}분 기록되었습니다.`,
        })
      }

      resetForm()
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('Walk submit error:', error)
      toast({
        title: activeWalk ? '산책 종료 실패' : '산책 시작 실패',
        description: '다시 시도해주세요.',
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
            {selectedCategory
              ? selectedCategory === 'walk' && activeWalk
                ? '🐕 산책 종료'
                : LOG_CATEGORY_CONFIG[selectedCategory].icon + ' ' + LOG_CATEGORY_CONFIG[selectedCategory].label + ' 기록'
              : '빠른 기록'}
          </DialogTitle>
          <DialogDescription className="sr-only">일일 건강 기록 입력</DialogDescription>
        </DialogHeader>

        {!selectedCategory ? (
          // 카테고리 선택 화면 (스와이프: 페이지1=6개 카테고리, 페이지2=체중+산책)
          <div className="space-y-2">
          {/* 산책 중 배너 */}
          {activeWalk && (
            <button
              onClick={() => setSelectedCategory('walk')}
              className="w-full p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between hover:bg-green-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">🐕</span>
                <span className="text-sm font-medium text-green-800">
                  산책 중 {(() => {
                    const elapsed = Math.floor((Date.now() - new Date(activeWalk.logged_at).getTime()) / 60000)
                    return `${elapsed}분 경과`
                  })()}
                </span>
              </div>
              <span className="text-xs text-green-600">종료하기 →</span>
            </button>
          )}
          <div
            onTouchStart={handleCategoryTouchStart}
            onTouchEnd={handleCategoryTouchEnd}
          >
            <div className="overflow-hidden">
              <div
                className="flex transition-transform duration-300 ease-in-out"
                style={{ transform: categoryPage === 1 ? 'translateX(-100%)' : 'translateX(0)' }}
              >
                {/* 페이지 1: 6개 카테고리 (3x2) */}
                <div className="min-w-full">
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
                </div>

                {/* 페이지 2: 약 + 체중 */}
                <div className="min-w-full">
                  <div className="grid grid-cols-3 gap-3 py-4">
                    <button
                      onClick={() => handleCategoryClick('medicine')}
                      disabled={isSubmitting}
                      className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-muted hover:border-primary hover:bg-muted/50 transition-all"
                    >
                      <span className="text-3xl mb-2">{LOG_CATEGORY_CONFIG.medicine.icon}</span>
                      <span className="text-sm font-medium">{LOG_CATEGORY_CONFIG.medicine.label}</span>
                    </button>
                    <button
                      onClick={() => handleCategoryClick('weight')}
                      disabled={isSubmitting}
                      className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-muted hover:border-primary hover:bg-muted/50 transition-all"
                    >
                      <span className="text-3xl mb-2">{LOG_CATEGORY_CONFIG.weight.icon}</span>
                      <span className="text-sm font-medium">{LOG_CATEGORY_CONFIG.weight.label}</span>
                    </button>
                    <button
                      onClick={() => handleCategoryClick('walk')}
                      disabled={isSubmitting}
                      className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
                        activeWalk
                          ? 'border-green-500 bg-green-50 hover:bg-green-100'
                          : 'border-muted hover:border-primary hover:bg-muted/50'
                      }`}
                    >
                      <span className="text-3xl mb-2">{LOG_CATEGORY_CONFIG.walk.icon}</span>
                      <span className="text-sm font-medium">
                        {activeWalk ? '산책 중' : LOG_CATEGORY_CONFIG.walk.label}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 페이지 인디케이터 */}
            <div className="flex justify-center gap-2 pb-2">
              <button
                className={`w-2 h-2 rounded-full transition-colors ${categoryPage === 0 ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                onClick={() => setCategoryPage(0)}
              />
              <button
                className={`w-2 h-2 rounded-full transition-colors ${categoryPage === 1 ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                onClick={() => setCategoryPage(1)}
              />
            </div>
          </div>
          </div>
        ) : (
          // 입력 화면
          <div className="space-y-4 py-4">
            {/* 시간 선택 (산책 종료 모드에서는 산책 폼 내부에 종료 시간 표시) */}
            {!(selectedCategory === 'walk' && activeWalk) && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">{selectedCategory === 'walk' ? '시작 시간' : '시간'}</label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="w-1/2"
                />
                <Input
                  type="time"
                  value={logTime}
                  onChange={(e) => setLogTime(e.target.value)}
                  className="w-1/2"
                />
              </div>
            </div>
            )}

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

            {/* 체중 입력 */}
            {selectedCategory === 'weight' && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">체중</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="체중 (kg)"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    className="flex-1"
                  />
                  <span className="flex items-center text-muted-foreground px-3 bg-muted rounded-md">
                    kg
                  </span>
                </div>
              </div>
            )}

            {/* 산책 입력 */}
            {selectedCategory === 'walk' && (
              <div className="space-y-3">
                {!activeWalk ? (
                  // 산책 시작 모드
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200 text-center space-y-2">
                    <div className="text-4xl">🐕</div>
                    <p className="text-sm text-green-800">산책을 시작합니다</p>
                    <p className="text-xs text-green-600">종료 시 다시 산책 버튼을 눌러주세요</p>
                  </div>
                ) : (
                  // 산책 종료 모드
                  <div className="space-y-3">
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">시작 시각</span>
                        <span className="font-medium text-sm">
                          {new Date(activeWalk.logged_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-sm text-muted-foreground">경과 시간</span>
                        <span className="font-medium text-green-700">
                          {Math.floor((Date.now() - new Date(activeWalk.logged_at).getTime()) / 60000)}분
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">종료 시간</label>
                      <div className="flex gap-2">
                        <Input
                          type="date"
                          value={logDate}
                          onChange={(e) => setLogDate(e.target.value)}
                          className="w-1/2"
                        />
                        <Input
                          type="time"
                          value={logTime}
                          onChange={(e) => setLogTime(e.target.value)}
                          className="w-1/2"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 간식 선택 (간식일 때만) */}
            {selectedCategory === 'snack' && (
              <div className="space-y-3">
                {/* 프리셋/직접입력 탭 */}
                <Tabs value={snackInputMode} onValueChange={(v) => {
                  setSnackInputMode(v as 'preset' | 'manual')
                  setSnackSelections({})
                  setSnackName('')
                  setAmount('')
                  setSnackUnit('개')
                }}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="preset">프리셋 선택</TabsTrigger>
                    <TabsTrigger value="manual">직접 입력</TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* 프리셋 선택 모드 */}
                {snackInputMode === 'preset' && (
                  <div className="space-y-2">
                    {snackPresets.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2 max-h-[240px] overflow-y-auto pr-1">
                        {snackPresets.map((preset) => {
                          const count = snackSelections[preset.id] || 0
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => {
                                setSnackSelections(prev => ({
                                  ...prev,
                                  [preset.id]: (prev[preset.id] || 0) + 1
                                }))
                              }}
                              className={`p-3 rounded-lg border-2 text-left transition-all relative ${
                                count > 0
                                  ? 'border-primary bg-primary/10'
                                  : 'border-muted hover:border-primary/50'
                              }`}
                            >
                              <div className="font-medium text-sm">{preset.name}</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {preset.default_amount && `${preset.default_amount}${preset.unit}`}
                                {preset.calories_per_unit && ` · ${preset.calories_per_unit}kcal`}
                              </div>
                              {count > 0 && (
                                <>
                                  <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                    {count}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSnackSelections(prev => {
                                        const next = { ...prev }
                                        if (next[preset.id] <= 1) {
                                          delete next[preset.id]
                                        } else {
                                          next[preset.id] -= 1
                                        }
                                        return next
                                      })
                                    }}
                                    className="absolute -bottom-2 -right-2 bg-muted-foreground text-background text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center hover:bg-destructive"
                                  >
                                    −
                                  </button>
                                </>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        등록된 간식이 없습니다.<br />
                        <Link href="/manage" onClick={() => onOpenChange(false)} className="text-primary underline underline-offset-2">간식/약 관리</Link>에서 간식을 추가하세요.
                      </div>
                    )}
                    {/* 선택 요약 */}
                    {Object.keys(snackSelections).length > 0 && (
                      <div className="text-sm text-muted-foreground px-1">
                        선택: {Object.entries(snackSelections).map(([id, cnt]) => {
                          const p = snackPresets.find(sp => sp.id === id)
                          return p ? `${p.name} ×${cnt}` : null
                        }).filter(Boolean).join(', ')}
                      </div>
                    )}
                  </div>
                )}

                {/* 직접 입력 모드 */}
                {snackInputMode === 'manual' && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">간식 이름</label>
                      <Input
                        placeholder="예: 츄르, 닭가슴살"
                        value={snackName}
                        onChange={(e) => setSnackName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">급여량</label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="간식량"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const units = ['개', '봉', 'g', 'ml']
                            const idx = units.indexOf(snackUnit)
                            setSnackUnit(units[(idx + 1) % units.length])
                          }}
                          className="flex items-center justify-center gap-1 min-w-[56px] px-3 bg-muted hover:bg-muted/80 rounded-md text-sm font-medium transition-colors border border-border"
                        >
                          {snackUnit}
                          <Repeat className="w-3 h-3 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 양 입력 (음수, 호흡수 - 배변/배뇨/식사/약/체중/간식 제외) */}
            {selectedCategory !== 'poop' && selectedCategory !== 'pee' && selectedCategory !== 'meal' && selectedCategory !== 'medicine' && selectedCategory !== 'weight' && selectedCategory !== 'snack' && selectedCategory !== 'walk' && (
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
                        <Link href="/manage" onClick={() => onOpenChange(false)} className="text-primary underline underline-offset-2">간식/약 관리</Link>에서 약 프리셋을 추가하세요.
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

            {/* 메모 (체중 제외) */}
            {selectedCategory !== 'weight' && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">메모 (선택)</label>
              <Textarea
                placeholder="추가 메모..."
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={2}
              />
            </div>
            )}

            {/* 사진 첨부 (체중, 산책 제외) */}
            {selectedCategory !== 'weight' && selectedCategory !== 'walk' && (
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
            )}

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
                onClick={selectedCategory === 'weight' ? handleWeightSubmit : selectedCategory === 'walk' ? handleWalkSubmit : handleSubmit}
                disabled={
                  selectedCategory === 'weight' ? (isWeightSubmitting || !weightInput || !petId)
                  : selectedCategory === 'walk' ? (isSubmitting || !petId)
                  : (isSubmitting || isUploading || (selectedCategory === 'medicine' && medicineInputMode === 'preset' && !selectedPreset) || (selectedCategory === 'snack' && snackInputMode === 'preset' && Object.keys(snackSelections).length === 0))
                }
                className="flex-1"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    사진 업로드 중...
                  </>
                ) : (isSubmitting || isWeightSubmitting) ? (
                  '저장 중...'
                ) : selectedCategory === 'walk' ? (
                  activeWalk ? '종료하기' : '시작하기'
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
