'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trash2, ImageIcon } from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface TimelineProps {
  logs: DailyLog[]
  onDelete?: (id: string) => void
}

export function Timeline({ logs, onDelete }: TimelineProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [selectedLog, setSelectedLog] = useState<DailyLog | null>(null)

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
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
            <Card
              key={log.id}
              className="overflow-hidden cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setSelectedLog(log)}
            >
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

                  {/* 삭제 버튼 */}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mr-2 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteId(log.id)
                      }}
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

      {/* 상세 정보 모달 */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="sm:max-w-md">
          {selectedLog && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="text-2xl">{LOG_CATEGORY_CONFIG[selectedLog.category].icon}</span>
                  {LOG_CATEGORY_CONFIG[selectedLog.category].label}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* 시간 */}
                <div>
                  <p className="text-sm text-muted-foreground">기록 시간</p>
                  <p className="font-medium">{formatDateTime(selectedLog.logged_at)}</p>
                </div>

                {/* 양 (배변/배뇨 제외) */}
                {selectedLog.category !== 'poop' && selectedLog.category !== 'pee' && selectedLog.amount !== null && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {selectedLog.category === 'breathing' ? '호흡수' : '양'}
                    </p>
                    <p className="font-medium">
                      {selectedLog.amount} {selectedLog.unit || LOG_CATEGORY_CONFIG[selectedLog.category].unit}
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
                        <div key={idx} className="relative aspect-square">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`사진 ${idx + 1}`}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 삭제 버튼 */}
                {onDelete && (
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => {
                      setDeleteId(selectedLog.id)
                      setSelectedLog(null)
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    기록 삭제
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
