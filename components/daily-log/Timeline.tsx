'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
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

interface TimelineProps {
  logs: DailyLog[]
  onDelete?: (id: string) => void
}

export function Timeline({ logs, onDelete }: TimelineProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }

  const formatValue = (log: DailyLog) => {
    const config = LOG_CATEGORY_CONFIG[log.category]

    if (log.category === 'poop' || log.category === 'pee') {
      return '' // 배변/배뇨는 양 표시 안함
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
            <Card key={log.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center">
                  {/* 시간 */}
                  <div className="w-16 py-3 text-center text-sm text-muted-foreground border-r">
                    {formatTime(log.logged_at)}
                  </div>

                  {/* 아이콘 */}
                  <div className={`w-14 py-3 text-center text-2xl ${config.color}`}>
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
                          ({log.medicine_name})
                        </span>
                      )}
                    </div>
                    {log.memo && (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {log.memo}
                      </p>
                    )}
                  </div>

                  {/* 삭제 버튼 */}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mr-2 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteId(log.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
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
    </>
  )
}
