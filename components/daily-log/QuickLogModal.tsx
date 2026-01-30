'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import type { LogCategory, DailyLogInput } from '@/types'
import { LOG_CATEGORY_CONFIG } from '@/types'

interface QuickLogModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

// 현재 시간을 HH:MM 형식으로 반환
const getCurrentTime = () => {
  const now = new Date()
  return now.toTimeString().slice(0, 5)
}

// 오늘 날짜를 YYYY-MM-DD 형식으로 반환
const getCurrentDate = () => {
  const now = new Date()
  return now.toISOString().slice(0, 10)
}

export function QuickLogModal({ open, onOpenChange, onSuccess }: QuickLogModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<LogCategory | null>(null)
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [medicineName, setMedicineName] = useState('')
  const [logTime, setLogTime] = useState(getCurrentTime())
  const [logDate, setLogDate] = useState(getCurrentDate())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  // 모달이 열릴 때마다 현재 시간으로 초기화
  useEffect(() => {
    if (open) {
      setLogTime(getCurrentTime())
      setLogDate(getCurrentDate())
    }
  }, [open])

  const categories: LogCategory[] = ['meal', 'water', 'medicine', 'poop', 'pee', 'breathing']

  const resetForm = () => {
    setSelectedCategory(null)
    setAmount('')
    setMemo('')
    setMedicineName('')
    setLogTime(getCurrentTime())
    setLogDate(getCurrentDate())
  }

  // 날짜와 시간을 ISO 문자열로 변환
  const getLoggedAtISO = () => {
    return `${logDate}T${logTime}:00`
  }

  const handleSubmit = async () => {
    if (!selectedCategory) return

    setIsSubmitting(true)

    try {
      const config = LOG_CATEGORY_CONFIG[selectedCategory]
      const logData: DailyLogInput = {
        category: selectedCategory,
        logged_at: getLoggedAtISO(),
        amount: amount ? parseFloat(amount) : (selectedCategory === 'poop' || selectedCategory === 'pee' ? 1 : null),
        unit: config.unit,
        memo: memo || null,
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
    // 배변/배뇨는 바로 저장 (양 입력 불필요)
    if (category === 'poop' || category === 'pee') {
      setSelectedCategory(category)
      // 바로 저장
      saveQuickLog(category)
    } else {
      setSelectedCategory(category)
    }
  }

  const saveQuickLog = async (category: LogCategory) => {
    setIsSubmitting(true)
    try {
      const config = LOG_CATEGORY_CONFIG[category]
      const response = await fetch('/api/daily-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          logged_at: getLoggedAtISO(),
          amount: 1,
          unit: config.unit,
        }),
      })

      if (!response.ok) throw new Error('Failed to save')

      toast({
        title: '기록 완료',
        description: `${config.icon} ${config.label} 기록이 저장되었습니다.`,
      })

      resetForm()
      onOpenChange(false)
      onSuccess?.()

    } catch (error) {
      console.error('Quick save error:', error)
      toast({
        title: '저장 실패',
        description: '기록 저장에 실패했습니다.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
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
                  className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 border-transparent hover:border-primary transition-all ${config.color}`}
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

            {/* 버튼 */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setSelectedCategory(null)}
                className="flex-1"
              >
                뒤로
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? '저장 중...' : '저장'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
