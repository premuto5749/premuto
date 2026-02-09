'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Loader2, HardDrive, CheckCircle, AlertCircle, Unlink, ExternalLink } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface DriveStatus {
  connected: boolean
  google_email?: string
  last_sync_at?: string
  connected_at?: string
  stats?: {
    total: number
    success: number
    failed: number
  }
}

interface SyncLogEntry {
  id: string
  source_type: 'daily_log_photo' | 'ocr_source'
  file_name: string
  drive_folder_path: string | null
  status: 'pending' | 'uploading' | 'success' | 'failed'
  error_message: string | null
  created_at: string
}

export function GoogleDriveSection() {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [driveStatus, setDriveStatus] = useState<DriveStatus | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([])
  const [showLogs, setShowLogs] = useState(false)

  const loadDriveStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/google-drive')
      const data = await res.json()
      if (data.success) {
        setDriveStatus(data.data)
      }
    } catch (error) {
      console.error('Failed to load Drive status:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadSyncLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/google-drive/sync-log?limit=10')
      const data = await res.json()
      if (data.success) {
        setSyncLogs(data.data.logs)
      }
    } catch (error) {
      console.error('Failed to load sync logs:', error)
    }
  }, [])

  useEffect(() => {
    loadDriveStatus()
  }, [loadDriveStatus])

  useEffect(() => {
    const driveConnected = searchParams.get('drive_connected')
    const driveError = searchParams.get('drive_error')

    if (driveConnected === 'true') {
      toast({ title: 'Google Drive 연결 완료', description: 'Google Drive가 성공적으로 연결되었습니다.' })
      loadDriveStatus()
      const url = new URL(window.location.href)
      url.searchParams.delete('drive_connected')
      window.history.replaceState({}, '', url.toString())
    }

    if (driveError) {
      const errorMessages: Record<string, string> = {
        access_denied: 'Google Drive 접근이 거부되었습니다.',
        missing_params: '인증 파라미터가 누락되었습니다.',
        invalid_state: '보안 검증에 실패했습니다. 다시 시도해주세요.',
        token_exchange: '토큰 교환에 실패했습니다.',
        no_tokens: '인증 토큰을 받지 못했습니다.',
        db_save: '연결 정보 저장에 실패했습니다.',
        unknown: '알 수 없는 오류가 발생했습니다.',
      }
      toast({
        title: 'Google Drive 연결 실패',
        description: errorMessages[driveError] || '연결에 실패했습니다.',
        variant: 'destructive',
      })
      const url = new URL(window.location.href)
      url.searchParams.delete('drive_error')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams, toast, loadDriveStatus])

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const res = await fetch('/api/google-drive/auth')
      const data = await res.json()

      if (res.status === 403) {
        toast({
          title: '플랜 업그레이드 필요',
          description: data.error || '베이직 이상 플랜에서 사용 가능합니다.',
          variant: 'destructive',
        })
        return
      }

      if (data.url) {
        window.location.href = data.url
      } else {
        toast({ title: '연결 실패', description: data.error || '인증 URL을 생성할 수 없습니다.', variant: 'destructive' })
      }
    } catch (error) {
      console.error('Drive connect error:', error)
      toast({ title: '연결 실패', description: '다시 시도해주세요.', variant: 'destructive' })
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      const res = await fetch('/api/google-drive', { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setDriveStatus({ connected: false })
        toast({ title: 'Google Drive 연결 해제', description: '연결이 해제되었습니다.' })
      }
    } catch (error) {
      console.error('Drive disconnect error:', error)
      toast({ title: '해제 실패', description: '다시 시도해주세요.', variant: 'destructive' })
    } finally {
      setDisconnecting(false)
    }
  }

  const handleToggleLogs = () => {
    if (!showLogs) {
      loadSyncLogs()
    }
    setShowLogs(!showLogs)
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const sourceTypeLabel = (type: string) =>
    type === 'daily_log_photo' ? '일일기록 사진' : 'OCR 원본'

  const statusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">완료</Badge>
      case 'failed':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">실패</Badge>
      case 'uploading':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">업로드 중</Badge>
      default:
        return <Badge variant="outline" className="text-xs">대기</Badge>
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="w-5 h-5" />
          Google Drive 백업
        </CardTitle>
        <CardDescription>
          사진과 검사지 원본을 Google Drive에 자동으로 백업합니다
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-muted rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">연결 상태</span>
            {driveStatus?.connected ? (
              <span className="flex items-center gap-1.5 text-green-600 font-medium text-sm">
                <CheckCircle className="w-4 h-4" />
                연결됨
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">미연결</span>
            )}
          </div>

          {driveStatus?.connected && driveStatus.google_email && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Google 계정</span>
              <span className="font-medium">{driveStatus.google_email}</span>
            </div>
          )}

          {driveStatus?.connected && driveStatus.last_sync_at && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">마지막 동기화</span>
              <span className="font-medium">{formatDate(driveStatus.last_sync_at)}</span>
            </div>
          )}

          {driveStatus?.connected && driveStatus.stats && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">동기화 통계</span>
              <span className="font-medium text-xs">
                총 {driveStatus.stats.total}건
                {driveStatus.stats.failed > 0 && (
                  <span className="text-red-500 ml-1">(실패 {driveStatus.stats.failed})</span>
                )}
              </span>
            </div>
          )}
        </div>

        {!driveStatus?.connected && (
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p>Google Drive를 연결하면 일일기록 사진과 혈액검사 원본이 자동으로 백업됩니다.</p>
              <p className="mt-1 text-xs text-blue-600">MIMOHARU 폴더에 반려동물별로 정리되어 저장됩니다.</p>
            </div>
          </div>
        )}

        {driveStatus?.connected ? (
          <div className="space-y-2">
            <Button variant="outline" className="w-full" onClick={handleToggleLogs}>
              <ExternalLink className="w-4 h-4 mr-2" />
              {showLogs ? '동기화 기록 닫기' : '동기화 기록 보기'}
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full text-muted-foreground" disabled={disconnecting}>
                  {disconnecting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Unlink className="w-4 h-4 mr-2" />
                  Google Drive 연결 해제
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Google Drive 연결 해제</AlertDialogTitle>
                  <AlertDialogDescription>
                    연결을 해제하면 사진과 검사지 원본이 더 이상 Google Drive에 백업되지 않습니다.
                    이미 백업된 파일은 Google Drive에 그대로 유지됩니다.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDisconnect}>연결 해제</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : (
          <Button className="w-full" onClick={handleConnect} disabled={connecting}>
            {connecting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <HardDrive className="w-4 h-4 mr-2" />
            )}
            Google Drive 연결하기
          </Button>
        )}

        {showLogs && (
          <div className="space-y-2 pt-2 border-t">
            <h4 className="text-sm font-medium">최근 동기화 기록</h4>
            {syncLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">동기화 기록이 없습니다</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {syncLogs.map((log) => (
                  <div key={log.id} className="p-2 border rounded text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{sourceTypeLabel(log.source_type)}</span>
                      {statusBadge(log.status)}
                    </div>
                    <div className="truncate font-medium">{log.file_name}</div>
                    {log.drive_folder_path && (
                      <div className="text-muted-foreground truncate">{log.drive_folder_path}</div>
                    )}
                    {log.error_message && (
                      <div className="text-red-500 truncate">{log.error_message}</div>
                    )}
                    <div className="text-muted-foreground">{formatDate(log.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          * 베이직 이상 플랜에서 사용 가능합니다. 앱이 만든 파일에만 접근하며 기존 파일에는 접근하지 않습니다.
        </p>
      </CardContent>
    </Card>
  )
}
