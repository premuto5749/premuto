'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AppHeader } from '@/components/layout/AppHeader'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { Loader2, Users, ShieldCheck, PawPrint } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface UserInfo {
  user_id: string
  tier: string
  pets: string[]
  today_ocr: number
  today_photo: number
  test_records: number
  daily_logs: number
  joined_at: string | null
}

const TIER_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  premium: { label: '프리미엄', variant: 'default' },
  basic: { label: '기본', variant: 'secondary' },
  free: { label: '무료', variant: 'outline' },
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<UserInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [changingTier, setChangingTier] = useState<{ userId: string; newTier: string; petNames: string[] } | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/admin/users')
        if (res.status === 403) {
          setAuthorized(false)
          return
        }
        const data = await res.json()
        if (data.success) {
          setAuthorized(true)
          setUsers(data.data)
        }
      } catch (err) {
        console.error('Failed to fetch users:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchUsers()
  }, [])

  const handleTierChange = async () => {
    if (!changingTier) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: changingTier.userId,
          tier: changingTier.newTier,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)

      setUsers(prev =>
        prev.map(u =>
          u.user_id === changingTier.userId
            ? { ...u, tier: changingTier.newTier }
            : u
        )
      )
      toast({ title: 'Tier 변경 완료' })
    } catch (err) {
      toast({
        title: 'Tier 변경 실패',
        description: err instanceof Error ? err.message : '알 수 없는 오류',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
      setChangingTier(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-muted">
        <AppHeader title="사용자 관리" showBack backHref="/admin" />
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-muted">
        <AppHeader title="사용자 관리" showBack backHref="/admin" />
        <div className="container max-w-4xl mx-auto py-10 px-4">
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <ShieldCheck className="w-5 h-5" />
                접근 권한 없음
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/admin')}>관리자로 돌아가기</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // tier별 통계
  const tierStats = {
    free: users.filter(u => u.tier === 'free').length,
    basic: users.filter(u => u.tier === 'basic').length,
    premium: users.filter(u => u.tier === 'premium').length,
  }

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader title="사용자 관리" showBack backHref="/admin" />

      <div className="container max-w-6xl mx-auto py-6 px-4">
        {/* 요약 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Users className="w-4 h-4" />
                전체
              </div>
              <div className="text-2xl font-bold">{users.length}명</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm font-medium text-muted-foreground">프리미엄</div>
              <div className="text-2xl font-bold text-primary">{tierStats.premium}명</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm font-medium text-muted-foreground">기본</div>
              <div className="text-2xl font-bold text-blue-600">{tierStats.basic}명</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm font-medium text-muted-foreground">무료</div>
              <div className="text-2xl font-bold text-gray-500">{tierStats.free}명</div>
            </CardContent>
          </Card>
        </div>

        {/* 사용자 테이블 */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">반려동물</TableHead>
                  <TableHead className="w-[120px]">Tier</TableHead>
                  <TableHead className="text-center">오늘 OCR</TableHead>
                  <TableHead className="text-center">검사기록</TableHead>
                  <TableHead className="text-center">일일기록</TableHead>
                  <TableHead className="w-[140px]">Tier 변경</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      등록된 사용자가 없습니다
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map(user => {
                    const tierInfo = TIER_BADGE[user.tier] || TIER_BADGE.free
                    return (
                      <TableRow key={user.user_id}>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <PawPrint className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm font-medium truncate">
                              {user.pets.length > 0 ? user.pets.join(', ') : '-'}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                            {user.user_id.substring(0, 8)}...
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={tierInfo.variant}>{tierInfo.label}</Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {user.today_ocr}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {user.test_records}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {user.daily_logs}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.tier}
                            onValueChange={(newTier) => {
                              if (newTier !== user.tier) {
                                setChangingTier({
                                  userId: user.user_id,
                                  newTier,
                                  petNames: user.pets,
                                })
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="free">무료</SelectItem>
                              <SelectItem value="basic">기본</SelectItem>
                              <SelectItem value="premium">프리미엄</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Tier 변경 확인 다이얼로그 */}
      <AlertDialog open={!!changingTier} onOpenChange={(open) => !open && setChangingTier(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tier를 변경하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              {changingTier && (
                <>
                  <strong>{changingTier.petNames.join(', ') || changingTier.userId.substring(0, 8)}</strong>
                  {' 사용자의 Tier를 '}
                  <Badge variant={TIER_BADGE[changingTier.newTier]?.variant || 'outline'}>
                    {TIER_BADGE[changingTier.newTier]?.label || changingTier.newTier}
                  </Badge>
                  {' (으)로 변경합니다.'}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleTierChange} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              변경
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
