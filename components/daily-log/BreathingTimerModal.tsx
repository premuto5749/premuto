'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'
import { LOG_CATEGORY_CONFIG } from '@/types'
import { formatLocalDate } from '@/lib/utils'

interface BreathingTimerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  defaultDate?: string // YYYY-MM-DD 형식
  petId?: string
}

type TimerPhase = 'ready' | 'counting' | 'flashing' | 'input'

export function BreathingTimerModal({
  open,
  onOpenChange,
  onSuccess,
  defaultDate,
  petId,
}: BreathingTimerModalProps) {
  const [phase, setPhase] = useState<TimerPhase>('ready')
  const [timeLeft, setTimeLeft] = useState(60) // 60초
  const [breathingRate, setBreathingRate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [flashVisible, setFlashVisible] = useState(true)
  const [logDate, setLogDate] = useState('')
  const [logTime, setLogTime] = useState('')
  const { toast } = useToast()

  // 모달 열릴 때 기본값 설정
  useEffect(() => {
    if (open) {
      const now = new Date()
      setLogDate(defaultDate || formatLocalDate(now))
      setLogTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
    }
  }, [open, defaultDate])

  // 모달 닫힐 때 초기화
  useEffect(() => {
    if (!open) {
      setPhase('ready')
      setTimeLeft(60)
      setBreathingRate('')
      setFlashVisible(true)
      setLogDate('')
      setLogTime('')
    }
  }, [open])

  // 카운트다운 타이머
  useEffect(() => {
    if (phase !== 'counting') return

    if (timeLeft <= 0) {
      setPhase('flashing')
      return
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [phase, timeLeft])

  // 깜빡임 효과
  useEffect(() => {
    if (phase !== 'flashing') return

    const flashInterval = setInterval(() => {
      setFlashVisible((prev) => !prev)
    }, 300)

    return () => clearInterval(flashInterval)
  }, [phase])

  const handleStart = () => {
    setTimeLeft(60)
    setPhase('counting')
  }

  const handleFlashClick = useCallback(() => {
    if (phase === 'flashing') {
      setPhase('input')
    }
  }, [phase])

  const handleDirectInput = () => {
    // 바로 입력 모드로 전환
    setPhase('input')
  }

  const handleSubmit = async () => {
    if (!breathingRate) {
      toast({
        title: '입력 필요',
        description: '호흡수를 입력해주세요.',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)

    try {
      // KST 타임존을 명시적으로 포함하여 시간대 변환 문제 방지
      const loggedAt = `${logDate}T${logTime}:00+09:00`

      const response = await fetch('/api/daily-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'breathing',
          pet_id: petId || null,
          logged_at: loggedAt,
          amount: parseFloat(breathingRate),
          unit: '회/분',
          memo: null,
          photo_urls: [],
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save log')
      }

      toast({
        title: '기록 완료',
        description: `🫁 호흡수 ${breathingRate}회/분이 저장되었습니다.`,
      })

      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('Failed to save breathing rate:', error)
      toast({
        title: '저장 실패',
        description: '호흡수 저장에 실패했습니다. 다시 시도해주세요.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`sm:max-w-md transition-all duration-300 ${
          phase === 'flashing' ? (flashVisible ? 'bg-teal-500' : 'bg-teal-100') : ''
        }`}
        onClick={phase === 'flashing' ? handleFlashClick : undefined}
      >
        <DialogTitle className="sr-only">호흡수 측정</DialogTitle>
        <DialogDescription className="sr-only">반려동물의 분당 호흡수를 측정합니다</DialogDescription>
        {/* 시작 대기 화면 */}
        {phase === 'ready' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            <div className="text-6xl">🫁</div>
            <h2 className="text-xl font-semibold text-center">호흡수 측정</h2>
            <p className="text-center text-muted-foreground">
              시작 버튼을 누르고 1분 동안<br />
              반려동물의 호흡수를 세어주세요.
            </p>
            <Button
              size="lg"
              onClick={handleStart}
              className="w-40 h-14 text-lg bg-teal-600 hover:bg-teal-700"
            >
              타이머 시작
            </Button>
            <div className="flex flex-col items-center gap-2 pt-2 border-t w-full max-w-xs">
              <p className="text-xs text-muted-foreground">
                또는 이미 측정한 값이 있다면
              </p>
              <Button
                variant="outline"
                onClick={handleDirectInput}
                className="w-full"
              >
                바로 입력
              </Button>
            </div>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground"
            >
              취소
            </Button>
          </div>
        )}

        {/* 카운트다운 화면 */}
        {phase === 'counting' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            <div className="text-6xl animate-pulse">🫁</div>
            <div className="text-6xl font-mono font-bold text-teal-600">
              {formatTime(timeLeft)}
            </div>
            <p className="text-center text-muted-foreground">
              호흡수를 세고 있어요...
            </p>
            <div className="w-full max-w-xs bg-muted rounded-full h-3 overflow-hidden">
              <div
                className="bg-teal-500 h-full transition-all duration-1000 ease-linear"
                style={{ width: `${((60 - timeLeft) / 60) * 100}%` }}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setPhase('ready')
                setTimeLeft(60)
              }}
              className="text-muted-foreground"
            >
              다시 시작
            </Button>
          </div>
        )}

        {/* 깜빡임 화면 (1분 완료) */}
        {phase === 'flashing' && (
          <div
            className="flex flex-col items-center justify-center py-16 space-y-6 cursor-pointer"
          >
            <div className={`text-7xl ${flashVisible ? 'opacity-100' : 'opacity-30'}`}>
              🫁
            </div>
            <h2 className={`text-2xl font-bold ${flashVisible ? 'text-white' : 'text-teal-800'}`}>
              1분 완료!
            </h2>
            <p className={`text-center text-lg ${flashVisible ? 'text-white/90' : 'text-teal-700'}`}>
              화면을 터치해서<br />
              호흡수를 입력하세요
            </p>
          </div>
        )}

        {/* 호흡수 입력 화면 */}
        {phase === 'input' && (
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            <div className="text-5xl">🫁</div>
            <h2 className="text-xl font-semibold">호흡수 입력</h2>
            <p className="text-center text-muted-foreground text-sm">
              분당 호흡수를 입력해주세요
            </p>

            {/* 호흡수 입력 */}
            <div className="flex items-center gap-3 w-full max-w-xs">
              <Input
                type="number"
                placeholder="예: 24"
                value={breathingRate}
                onChange={(e) => setBreathingRate(e.target.value)}
                className="text-center text-2xl h-14 flex-1"
                autoFocus
              />
              <span className="text-muted-foreground whitespace-nowrap">
                {LOG_CATEGORY_CONFIG.breathing.unit}
              </span>
            </div>

            {/* 날짜/시간 선택 */}
            <div className="w-full max-w-xs pt-2 border-t">
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

            <div className="flex gap-3 w-full max-w-xs pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setPhase('ready')
                  setTimeLeft(60)
                  setBreathingRate('')
                }}
                disabled={isSubmitting}
                className="flex-1"
              >
                취소
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !breathingRate}
                className="flex-1 bg-teal-600 hover:bg-teal-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    저장 중...
                  </>
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
