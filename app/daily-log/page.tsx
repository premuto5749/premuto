'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Menu, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { QuickLogModal } from '@/components/daily-log/QuickLogModal'
import { DailyStatsCard } from '@/components/daily-log/DailyStatsCard'
import { Timeline } from '@/components/daily-log/Timeline'
import { useToast } from '@/hooks/use-toast'
import type { DailyLog, DailyStats } from '@/types'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import Link from 'next/link'

export default function DailyLogPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [stats, setStats] = useState<DailyStats | null>(null)
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [isLoading, setIsLoading] = useState(true)
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

  const goToPrevDay = () => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() - 1)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  const goToNextDay = () => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + 1)
    const today = new Date().toISOString().split('T')[0]
    if (d.toISOString().split('T')[0] <= today) {
      setSelectedDate(d.toISOString().split('T')[0])
    }
  }

  const goToToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0])
  }

  const formatDateHeader = (dateStr: string) => {
    const d = new Date(dateStr)
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    if (dateStr === today) {
      return '오늘'
    } else if (dateStr === yesterday.toISOString().split('T')[0]) {
      return '어제'
    }

    return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })
  }

  const isToday = selectedDate === new Date().toISOString().split('T')[0]

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

          <div className="w-10" /> {/* 균형 맞추기 */}
        </div>
      </header>

      {/* 날짜 네비게이션 */}
      <div className="bg-white border-b">
        <div className="max-w-lg mx-auto px-4 py-2 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={goToPrevDay}>
            <ChevronLeft className="w-5 h-5" />
          </Button>

          <button
            onClick={goToToday}
            className="font-medium text-center"
          >
            {formatDateHeader(selectedDate)}
            {!isToday && (
              <span className="block text-xs text-muted-foreground">탭하여 오늘로</span>
            )}
          </button>

          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextDay}
            disabled={isToday}
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
              <Timeline logs={logs} onDelete={handleDelete} />
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
