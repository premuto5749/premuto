'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Menu, ChevronLeft, ChevronRight, Copy, CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { QuickLogModal } from '@/components/daily-log/QuickLogModal'
import { DailyStatsCard } from '@/components/daily-log/DailyStatsCard'
import { Timeline } from '@/components/daily-log/Timeline'
import { useToast } from '@/hooks/use-toast'
import type { DailyLog, DailyStats } from '@/types'
import { LOG_CATEGORY_CONFIG } from '@/types'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from '@/components/ui/calendar'
import Link from 'next/link'

// 한국 시간(KST) 기준 오늘 날짜 반환
function getKSTToday(): string {
  const now = new Date()
  // UTC+9 (한국 시간)
  const kstOffset = 9 * 60 * 60 * 1000
  const kstDate = new Date(now.getTime() + kstOffset + now.getTimezoneOffset() * 60 * 1000)
  return kstDate.toISOString().split('T')[0]
}

export default function DailyLogPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [stats, setStats] = useState<DailyStats | null>(null)
  const [selectedDate, setSelectedDate] = useState(() => {
    return getKSTToday()
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const { toast } = useToast()

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      // 기록 조회
      const logsRes = await fetch(`/api/daily-logs?date=${selectedDate}`)
      if (logsRes.ok) {
        const logsData = await logsRes.json()
        setLogs(logsData.data || [])
      } else {
        setLogs([])
      }

      // 통계 조회 (별도 처리 - 뷰가 없을 수 있음)
      try {
        const statsRes = await fetch(`/api/daily-logs?date=${selectedDate}&stats=true`)
        if (statsRes.ok) {
          const statsData = await statsRes.json()
          setStats(statsData.data?.[0] || null)
        } else {
          setStats(null)
        }
      } catch {
        setStats(null)
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
      setLogs([])
      setStats(null)
    } finally {
      setIsLoading(false)
    }
  }, [selectedDate])

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
  }

  const goToNextDay = () => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + 1)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  const goToToday = () => {
    setSelectedDate(getKSTToday())
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
        lines.push(`🍚 식사: ${stats.total_meal_amount}g (${stats.meal_count}회)`)
      }
      if (stats.water_count > 0) {
        lines.push(`💧 음수: ${stats.total_water_amount}ml (${stats.water_count}회)`)
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
        lines.push(`🫁 호흡수: 평균 ${Math.round(stats.avg_breathing_rate)}회/분 (${stats.breathing_count}회 측정)`)
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
        content += ` ${log.amount}${log.unit || config.unit}`
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 bg-white border-b">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Mimo Health Log</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 space-y-2">
                <Link
                  href="/daily-log"
                  className="flex items-center px-4 py-3 rounded-lg bg-primary/10 text-primary font-medium"
                >
                  📝 일일 기록
                </Link>
                <Link
                  href="/upload"
                  className="flex items-center px-4 py-3 rounded-lg hover:bg-muted transition-colors"
                >
                  📄 검사지 업로드
                </Link>
                <Link
                  href="/dashboard"
                  className="flex items-center px-4 py-3 rounded-lg hover:bg-muted transition-colors"
                >
                  📊 검사 결과 대시보드
                </Link>
                <Link
                  href="/records-management"
                  className="flex items-center px-4 py-3 rounded-lg hover:bg-muted transition-colors"
                >
                  🗑️ 검사 기록 관리
                </Link>
                <Link
                  href="/mapping-management"
                  className="flex items-center px-4 py-3 rounded-lg hover:bg-muted transition-colors"
                >
                  ⚙️ 검사항목 매핑 관리
                </Link>
                <hr className="my-4" />
                <form action="/auth/signout" method="post">
                  <button
                    type="submit"
                    className="w-full flex items-center px-4 py-3 rounded-lg hover:bg-muted transition-colors text-left"
                  >
                    🚪 로그아웃
                  </button>
                </form>
              </nav>
            </SheetContent>
          </Sheet>

          <h1 className="font-semibold text-lg">미모 건강 기록</h1>

          <Button variant="ghost" size="icon" onClick={exportLogsToText} title="기록 내보내기">
            <Copy className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* 날짜 네비게이션 */}
      <div className="bg-white border-b">
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

          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextDay}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
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
            <DailyStatsCard stats={stats} date={selectedDate} />

            {/* 타임라인 */}
            <div>
              <h2 className="font-medium mb-3">기록 목록</h2>
              <Timeline logs={logs} onDelete={handleDelete} onUpdate={handleUpdate} />
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
      />
    </div>
  )
}
