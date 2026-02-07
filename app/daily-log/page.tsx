'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, ChevronLeft, ChevronRight, Copy, CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { QuickLogModal } from '@/components/daily-log/QuickLogModal'
import { BreathingTimerModal } from '@/components/daily-log/BreathingTimerModal'
import { DailyStatsCard } from '@/components/daily-log/DailyStatsCard'
import { Timeline } from '@/components/daily-log/Timeline'
import { AppHeader } from '@/components/layout/AppHeader'
import { useToast } from '@/hooks/use-toast'
import type { DailyLog, DailyStats, LogCategory } from '@/types'
import { LOG_CATEGORY_CONFIG } from '@/types'
import { formatNumber } from '@/lib/utils'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from '@/components/ui/calendar'
import { usePet } from '@/contexts/PetContext'

// 한국 시간(KST, UTC+9) 기준 오늘 날짜 반환
function getKSTToday(): string {
  // Intl.DateTimeFormat을 사용하여 명시적으로 Asia/Seoul 타임존 적용
  // 'sv-SE' 로케일은 YYYY-MM-DD 형식을 반환
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}

export default function DailyLogPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isBreathingTimerOpen, setIsBreathingTimerOpen] = useState(false)
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [stats, setStats] = useState<DailyStats | null>(null)
  const [selectedDate, setSelectedDate] = useState(() => {
    return getKSTToday()
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<LogCategory | null>(null)
  const { toast } = useToast()
  const { pets, currentPet, setCurrentPet, isLoading: isPetsLoading } = usePet()

  // 반려동물 로딩 완료 후 currentPet이 없으면 기본 반려동물 자동 선택
  useEffect(() => {
    if (!isPetsLoading && pets.length > 0 && !currentPet) {
      const defaultPet = pets.find(p => p.is_default) || pets[0]
      if (defaultPet) {
        setCurrentPet(defaultPet)
      }
    }
  }, [isPetsLoading, pets, currentPet, setCurrentPet])

  const fetchData = useCallback(async () => {
    // 반려동물 로딩 중이면 대기
    if (isPetsLoading) return

    setIsLoading(true)
    try {
      // pet_id 파라미터 추가
      const petParam = currentPet ? `&pet_id=${currentPet.id}` : ''

      // 기록 + 통계 병렬 조회
      const [logsRes, statsRes] = await Promise.all([
        fetch(`/api/daily-logs?date=${selectedDate}${petParam}`),
        fetch(`/api/daily-logs?date=${selectedDate}&stats=true${petParam}`),
      ])

      if (logsRes.ok) {
        const logsData = await logsRes.json()
        setLogs(logsData.data || [])
      } else {
        setLogs([])
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData.data?.[0] || null)
      } else {
        setStats(null)
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
      setLogs([])
      setStats(null)
    } finally {
      setIsLoading(false)
    }
  }, [selectedDate, currentPet, isPetsLoading])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/daily-logs?id=${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Delete failed')

      toast({
        title: '삭제 완료',
        description: '기록이 삭제되었습니다.',
      })

      fetchData()
    } catch (error) {
      console.error('Delete error:', error)
      toast({
        title: '삭제 실패',
        description: '기록 삭제에 실패했습니다.',
        variant: 'destructive',
      })
    }
  }

  const handleUpdate = async (id: string, data: Partial<DailyLog>) => {
    const response = await fetch('/api/daily-logs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...data }),
    })

    if (!response.ok) {
      toast({
        title: '수정 실패',
        description: '기록 수정에 실패했습니다.',
        variant: 'destructive',
      })
      throw new Error('Update failed')
    }

    toast({
      title: '수정 완료',
      description: '기록이 수정되었습니다.',
    })

    fetchData()
  }

  const goToPrevDay = () => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() - 1)
    setSelectedDate(d.toISOString().split('T')[0])
    setSelectedCategory(null) // 날짜 변경 시 필터 해제
  }

  const goToNextDay = () => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + 1)
    setSelectedDate(d.toISOString().split('T')[0])
    setSelectedCategory(null) // 날짜 변경 시 필터 해제
  }

  const goToToday = () => {
    setSelectedDate(getKSTToday())
    setSelectedCategory(null) // 날짜 변경 시 필터 해제
  }

  const formatDateHeader = (dateStr: string) => {
    const d = new Date(dateStr)
    const today = getKSTToday()
    const yesterdayDate = new Date(today)
    yesterdayDate.setDate(yesterdayDate.getDate() - 1)
    const yesterday = yesterdayDate.toISOString().split('T')[0]
    const tomorrowDate = new Date(today)
    tomorrowDate.setDate(tomorrowDate.getDate() + 1)
    const tomorrow = tomorrowDate.toISOString().split('T')[0]

    if (dateStr === today) {
      return '오늘'
    } else if (dateStr === yesterday) {
      return '어제'
    } else if (dateStr === tomorrow) {
      return '내일'
    }

    return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })
  }

  const isToday = selectedDate === getKSTToday()

  const handleCalendarSelect = (date: Date) => {
    setSelectedDate(date.toISOString().split('T')[0])
    setIsCalendarOpen(false)
    setSelectedCategory(null) // 날짜 변경 시 필터 해제
  }

  const exportLogsToText = () => {
    if (logs.length === 0) {
      toast({
        title: '내보낼 기록 없음',
        description: '해당 날짜에 기록이 없습니다.',
        variant: 'destructive',
      })
      return
    }

    // 시간순 정렬
    const sortedLogs = [...logs].sort((a, b) =>
      new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()
    )

    // 날짜 헤더
    const dateHeader = new Date(selectedDate).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    })

    const lines = [`📋 ${dateHeader} 기록`, '']

    // 오늘 요약 추가
    if (stats) {
      lines.push('📊 오늘 요약')

      if (stats.meal_count > 0) {
        lines.push(`🍚 식사: ${formatNumber(stats.total_meal_amount)}g (${stats.meal_count}회)`)
      }
      if (stats.water_count > 0) {
        lines.push(`💧 음수: ${formatNumber(stats.total_water_amount)}ml (${stats.water_count}회)`)
      }
      if (stats.medicine_count > 0) {
        lines.push(`💊 약: ${stats.medicine_count}회`)
      }
      if (stats.poop_count > 0) {
        lines.push(`💩 배변: ${stats.poop_count}회`)
      }
      if (stats.pee_count > 0) {
        lines.push(`🚽 배뇨: ${stats.pee_count}회`)
      }
      if (stats.breathing_count > 0 && stats.avg_breathing_rate) {
        lines.push(`🫁 호흡수: 평균 ${formatNumber(Math.round(stats.avg_breathing_rate))}회/분 (${stats.breathing_count}회 측정)`)
      }

      lines.push('')
    }

    lines.push('📝 상세 기록')

    for (const log of sortedLogs) {
      const config = LOG_CATEGORY_CONFIG[log.category]
      const time = new Date(log.logged_at).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })

      let content = `${config.icon} ${config.label}`

      // 양 표시 (배변/배뇨 제외)
      if (log.amount !== null && log.category !== 'poop' && log.category !== 'pee') {
        content += ` ${formatNumber(log.amount)}${log.unit || config.unit}`
      }

      // 약 이름
      if (log.medicine_name) {
        content += ` (${log.medicine_name})`
      }

      // 메모
      const memo = log.memo ? ` - ${log.memo}` : ''

      lines.push(`${time} | ${content}${memo}`)
    }

    const text = lines.join('\n')

    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: '복사 완료',
        description: '기록이 클립보드에 복사되었습니다.',
      })
    }).catch(() => {
      toast({
        title: '복사 실패',
        description: '클립보드 복사에 실패했습니다.',
        variant: 'destructive',
      })
    })
  }

  // 카테고리 필터링 토글 핸들러
  const handleCategoryClick = (category: LogCategory) => {
    setSelectedCategory(prev => prev === category ? null : category)
  }

  // 필터링된 로그 계산
  const filteredLogs = useMemo(() => {
    if (!selectedCategory) {
      return logs
    }
    return logs.filter(log => log.category === selectedCategory)
  }, [logs, selectedCategory])

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 - AppHeader 사용 */}
      <AppHeader title={currentPet ? `${currentPet.name} 건강 기록` : '건강 기록'} />

      {/* 날짜 네비게이션 */}
      <div className="bg-background border-b">
        <div className="max-w-lg mx-auto px-4 py-2 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={goToPrevDay}>
            <ChevronLeft className="w-5 h-5" />
          </Button>

          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <button className="font-medium text-center flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                {formatDateHeader(selectedDate)}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                selected={new Date(selectedDate)}
                onSelect={handleCalendarSelect}
              />
              {!isToday && (
                <div className="px-3 pb-3">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      goToToday()
                      setIsCalendarOpen(false)
                    }}
                  >
                    오늘로 이동
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          <div className="flex items-center">
            <Button variant="ghost" size="icon" onClick={exportLogsToText} title="기록 내보내기">
              <Copy className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={goToNextDay}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <main className="max-w-lg mx-auto px-4 py-4 pb-24">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            로딩 중...
          </div>
        ) : (
          <div className="space-y-4">
            {/* 일일 통계 */}
            <DailyStatsCard
              stats={stats}
              date={selectedDate}
              selectedCategory={selectedCategory}
              onCategoryClick={handleCategoryClick}
            />

            {/* 타임라인 */}
            <div>
              <h2 className="font-medium mb-3">
                기록 목록
                {selectedCategory && (
                  <span className="text-sm text-muted-foreground ml-2">
                    ({LOG_CATEGORY_CONFIG[selectedCategory].icon} {LOG_CATEGORY_CONFIG[selectedCategory].label} {filteredLogs.length}건)
                  </span>
                )}
              </h2>
              <Timeline logs={filteredLogs} onDelete={handleDelete} onUpdate={handleUpdate} />
            </div>
          </div>
        )}
      </main>

      {/* 플로팅 추가 버튼 */}
      <Button
        size="lg"
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg"
        onClick={() => setIsModalOpen(true)}
      >
        <Plus className="w-6 h-6" />
      </Button>

      {/* 빠른 기록 모달 */}
      <QuickLogModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSuccess={fetchData}
        defaultDate={selectedDate}
        petId={currentPet?.id}
        onBreathingSelect={() => {
          setIsModalOpen(false)
          setIsBreathingTimerOpen(true)
        }}
      />

      {/* 호흡수 타이머 모달 */}
      <BreathingTimerModal
        open={isBreathingTimerOpen}
        onOpenChange={setIsBreathingTimerOpen}
        onSuccess={fetchData}
        defaultDate={selectedDate}
        petId={currentPet?.id}
      />
    </div>
  )
}
