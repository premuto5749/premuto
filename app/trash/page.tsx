'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AppHeader } from '@/components/layout/AppHeader'
import { Loader2, RotateCcw, Trash2, FlaskConical, ClipboardList, X } from 'lucide-react'
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
import { useToast } from '@/hooks/use-toast'
import { usePet } from '@/contexts/PetContext'

interface DeletedTestRecord {
  id: string
  test_date: string
  hospital_name: string | null
  deleted_at: string
  test_results: Array<{ id: string }>
}

interface DeletedDailyLog {
  id: string
  category: string
  logged_at: string
  amount: number | null
  unit: string | null
  memo: string | null
  medicine_name: string | null
  deleted_at: string
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  meal: { label: '식사', icon: '🍚' },
  water: { label: '음수', icon: '💧' },
  medicine: { label: '약', icon: '💊' },
  poop: { label: '배변', icon: '💩' },
  pee: { label: '배뇨', icon: '🚽' },
  breathing: { label: '호흡수', icon: '🫁' },
}

function getDaysUntilPermanentDelete(deletedAt: string): number {
  const deleted = new Date(deletedAt)
  const expiry = new Date(deleted.getTime() + 7 * 24 * 60 * 60 * 1000)
  const now = new Date()
  const diff = expiry.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type ConfirmAction = {
  action: 'restore' | 'delete'
  type: 'test' | 'daily'
  id: string
}

export default function TrashPage() {
  const [testRecords, setTestRecords] = useState<DeletedTestRecord[]>([])
  const [dailyLogs, setDailyLogs] = useState<DeletedDailyLog[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [tab, setTab] = useState<'test' | 'daily'>('test')
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null)
  const { toast } = useToast()
  const { currentPet } = usePet()

  const fetchDeleted = async () => {
    setLoading(true)
    try {
      const petParam = currentPet?.id ? `&petId=${currentPet.id}` : ''

      const [testRes, dailyRes] = await Promise.all([
        fetch(`/api/test-results?deleted=true${petParam}`),
        fetch(`/api/daily-logs?deleted=true${currentPet?.id ? `&pet_id=${currentPet.id}` : ''}`),
      ])

      if (testRes.ok) {
        const testData = await testRes.json()
        setTestRecords(testData.data || [])
      }
      if (dailyRes.ok) {
        const dailyData = await dailyRes.json()
        setDailyLogs(dailyData.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch deleted records:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDeleted()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPet?.id])

  const handleRestore = async (type: 'test' | 'daily', id: string) => {
    setProcessing(id)
    try {
      const url = type === 'test' ? '/api/test-results' : '/api/daily-logs'
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, restore: true }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '복원에 실패했습니다')
      }

      toast({ title: '복원 완료', description: '기록이 복원되었습니다.' })

      if (type === 'test') {
        setTestRecords(prev => prev.filter(r => r.id !== id))
      } else {
        setDailyLogs(prev => prev.filter(r => r.id !== id))
      }
    } catch (err) {
      toast({
        title: '복원 실패',
        description: err instanceof Error ? err.message : '알 수 없는 오류',
        variant: 'destructive',
      })
    } finally {
      setProcessing(null)
      setConfirm(null)
    }
  }

  const handlePermanentDelete = async (type: 'test' | 'daily', id: string) => {
    setProcessing(id)
    try {
      const url = type === 'test'
        ? `/api/test-results?id=${id}&permanent=true`
        : `/api/daily-logs?id=${id}&permanent=true`
      const res = await fetch(url, { method: 'DELETE' })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '삭제에 실패했습니다')
      }

      toast({ title: '영구 삭제 완료' })

      if (type === 'test') {
        setTestRecords(prev => prev.filter(r => r.id !== id))
      } else {
        setDailyLogs(prev => prev.filter(r => r.id !== id))
      }
    } catch (err) {
      toast({
        title: '삭제 실패',
        description: err instanceof Error ? err.message : '알 수 없는 오류',
        variant: 'destructive',
      })
    } finally {
      setProcessing(null)
      setConfirm(null)
    }
  }

  const handleConfirmAction = () => {
    if (!confirm) return
    if (confirm.action === 'restore') {
      handleRestore(confirm.type, confirm.id)
    } else {
      handlePermanentDelete(confirm.type, confirm.id)
    }
  }

  const totalDeleted = testRecords.length + dailyLogs.length

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="휴지통" />

      <main className="max-w-2xl mx-auto px-4 py-6">
        <p className="text-sm text-muted-foreground mb-4">
          삭제된 기록은 7일간 보관 후 자동 영구 삭제됩니다.
        </p>

        {/* 탭 */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={tab === 'test' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab('test')}
            className="gap-1.5"
          >
            <FlaskConical className="w-4 h-4" />
            검사 기록 ({testRecords.length})
          </Button>
          <Button
            variant={tab === 'daily' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab('daily')}
            className="gap-1.5"
          >
            <ClipboardList className="w-4 h-4" />
            일일 기록 ({dailyLogs.length})
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : totalDeleted === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Trash2 className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">휴지통이 비어있습니다</p>
            </CardContent>
          </Card>
        ) : tab === 'test' ? (
          testRecords.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                삭제된 검사 기록이 없습니다
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {testRecords.map(record => {
                const daysLeft = getDaysUntilPermanentDelete(record.deleted_at)
                const isProcessing = processing === record.id
                return (
                  <Card key={record.id}>
                    <CardContent className="py-3 px-4 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm">
                          {record.test_date}
                          {record.hospital_name && (
                            <span className="text-muted-foreground ml-2">
                              ({record.hospital_name})
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          항목 {record.test_results?.length || 0}개
                          {' · '}
                          <span className={daysLeft <= 2 ? 'text-red-500 font-medium' : ''}>
                            {daysLeft}일 후 영구 삭제
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isProcessing}
                          onClick={() => setConfirm({ action: 'restore', type: 'test', id: record.id })}
                          className="gap-1 h-8 px-2"
                        >
                          {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          복원
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isProcessing}
                          onClick={() => setConfirm({ action: 'delete', type: 'test', id: record.id })}
                          className="gap-1 h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )
        ) : (
          dailyLogs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                삭제된 일일 기록이 없습니다
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {dailyLogs.map(log => {
                const daysLeft = getDaysUntilPermanentDelete(log.deleted_at)
                const cat = CATEGORY_LABELS[log.category] || { label: log.category, icon: '📌' }
                const isProcessing = processing === log.id
                return (
                  <Card key={log.id}>
                    <CardContent className="py-3 px-4 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm">
                          {cat.icon} {cat.label}
                          {log.amount != null && log.unit && (
                            <span className="text-muted-foreground ml-1">
                              {log.amount}{log.unit}
                            </span>
                          )}
                          {log.medicine_name && (
                            <span className="text-muted-foreground ml-1">
                              ({log.medicine_name})
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(log.logged_at)}
                          {log.memo && ` · ${log.memo}`}
                          {' · '}
                          <span className={daysLeft <= 2 ? 'text-red-500 font-medium' : ''}>
                            {daysLeft}일 후 영구 삭제
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isProcessing}
                          onClick={() => setConfirm({ action: 'restore', type: 'daily', id: log.id })}
                          className="gap-1 h-8 px-2"
                        >
                          {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          복원
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isProcessing}
                          onClick={() => setConfirm({ action: 'delete', type: 'daily', id: log.id })}
                          className="gap-1 h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )
        )}
      </main>

      {/* 확인 다이얼로그 */}
      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.action === 'restore' ? '기록을 복원하시겠습니까?' : '영구 삭제하시겠습니까?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.action === 'restore'
                ? '복원된 기록은 다시 목록에 표시됩니다.'
                : '영구 삭제된 기록은 복구할 수 없습니다.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              className={confirm?.action === 'delete' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {confirm?.action === 'restore' ? '복원' : '영구 삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
