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
import { Loader2, Users, ShieldCheck, PawPrint, Mail, Shield } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface UserInfo {
  user_id: string
  email: string
  tier: string
  role: string | null // 'super_admin' | 'admin' | 'env_admin' | null
  pets: string[]
  total_ocr: number
  test_records: number
  daily_logs: number
  joined_at: string | null
  last_active: string | null
  terms_accepted_at: string | null
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  const pad = (n: number) => n < 10 ? '0' + n : String(n)
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  const pad = (n: number) => n < 10 ? '0' + n : String(n)
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatRelativeDateTime(dateStr: string | null): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  const now = new Date()
  const pad = (n: number) => n < 10 ? '0' + n : String(n)

  // KST 기준으로 날짜 비교
  const kstOptions: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Seoul' }
  const dKST = new Date(d.toLocaleString('en-US', kstOptions))
  const nowKST = new Date(now.toLocaleString('en-US', kstOptions))

  const dDate = `${dKST.getFullYear()}-${pad(dKST.getMonth() + 1)}-${pad(dKST.getDate())}`
  const nowDate = `${nowKST.getFullYear()}-${pad(nowKST.getMonth() + 1)}-${pad(nowKST.getDate())}`
  const time = `${pad(dKST.getHours())}:${pad(dKST.getMinutes())}`

  if (dDate === nowDate) return `오늘 ${time}`

  const diffMs = nowKST.getTime() - dKST.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 1) return `어제 ${time}`
  if (diffDays < 7) return `${diffDays}일 전 ${time}`

  // 7일 이상이면 날짜 표시
  return `${pad(dKST.getMonth() + 1)}.${pad(dKST.getDate())} ${time}`
}

const TIER_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  premium: { label: '프리미엄', variant: 'default' },
  basic: { label: '기본', variant: 'secondary' },
  free: { label: '무료', variant: 'outline' },
}

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  super_admin: { label: 'Super Admin', className: 'bg-red-100 text-red-800 border-red-200' },
  env_admin: { label: 'Admin (ENV)', className: 'bg-purple-100 text-purple-800 border-purple-200' },
  admin: { label: 'Admin', className: 'bg-orange-100 text-orange-800 border-orange-200' },
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<UserInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [changingTier, setChangingTier] = useState<{ userId: string; newTier: string; email: string; petNames: string[] } | null>(null)
  const [changingRole, setChangingRole] = useState<{ userId: string; email: string; action: 'grant' | 'revoke' } | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/admin/users')
        if (res.status === 403) {
          setAuthorized(false)
          setError('관리자 권한이 필요합니다')
          return
        }
        const data = await res.json()
        if (data.success) {
          setAuthorized(true)
          setUsers(data.data)
        } else {
          setAuthorized(false)
          setError(data.error || '사용자 목록을 불러오지 못했습니다')
        }
      } catch (err) {
        console.error('Failed to fetch users:', err)
        setError('서버에 연결할 수 없습니다')
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

  const handleRoleChange = async () => {
    if (!changingRole) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: changingRole.userId,
          action: changingRole.action,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)

      setUsers(prev =>
        prev.map(u =>
          u.user_id === changingRole.userId
            ? { ...u, role: changingRole.action === 'grant' ? 'admin' : null }
            : u
        )
      )
      toast({
        title: changingRole.action === 'grant' ? '관리자 권한 부여 완료' : '관리자 권한 해제 완료',
      })
    } catch (err) {
      toast({
        title: '권한 변경 실패',
        description: err instanceof Error ? err.message : '알 수 없는 오류',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
      setChangingRole(null)
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
                {error?.includes('권한') ? '접근 권한 없음' : '데이터 로드 실패'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {error && (
                <p className="text-sm text-muted-foreground">{error}</p>
              )}
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
  const adminCount = users.filter(u => u.role).length

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader title="사용자 관리" showBack backHref="/admin" />

      <div className="container max-w-6xl mx-auto py-6 px-4">
        {/* 요약 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
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
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Shield className="w-4 h-4" />
                관리자
              </div>
              <div className="text-2xl font-bold text-orange-600">{adminCount}명</div>
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
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">계정</TableHead>
                  <TableHead className="w-[90px]">역할</TableHead>
                  <TableHead className="w-[70px]">Tier</TableHead>
                  <TableHead className="text-center w-[50px]">약관</TableHead>
                  <TableHead className="text-center w-[80px]">가입일</TableHead>
                  <TableHead className="text-center w-[100px]">마지막 접속</TableHead>
                  <TableHead className="text-center">OCR</TableHead>
                  <TableHead className="text-center">검사</TableHead>
                  <TableHead className="text-center">일일</TableHead>
                  <TableHead className="w-[120px]">Tier 변경</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      등록된 사용자가 없습니다
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map(user => {
                    const tierInfo = TIER_BADGE[user.tier] || TIER_BADGE.free
                    const roleInfo = user.role ? ROLE_BADGE[user.role] : null
                    const canToggleAdmin = !user.role || user.role === 'admin'
                    return (
                      <TableRow key={user.user_id}>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm font-medium truncate">
                              {user.email || user.user_id.substring(0, 8) + '...'}
                            </span>
                          </div>
                          {user.pets.length > 0 && (
                            <div className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground">
                              <PawPrint className="w-3 h-3 flex-shrink-0" />
                              {user.pets.join(', ')}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {roleInfo ? (
                            <Badge variant="outline" className={roleInfo.className}>
                              {roleInfo.label}
                            </Badge>
                          ) : canToggleAdmin ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-muted-foreground hover:text-orange-600"
                              onClick={() => setChangingRole({
                                userId: user.user_id,
                                email: user.email,
                                action: 'grant',
                              })}
                            >
                              + 관리자
                            </Button>
                          ) : null}
                          {user.role === 'admin' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 text-[10px] text-muted-foreground hover:text-red-600 px-1 mt-0.5"
                              onClick={() => setChangingRole({
                                userId: user.user_id,
                                email: user.email,
                                action: 'revoke',
                              })}
                            >
                              해제
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={tierInfo.variant}>{tierInfo.label}</Badge>
                        </TableCell>
                        <TableCell className="text-center text-xs">
                          {user.terms_accepted_at ? (
                            <span className="text-green-600" title={formatDateTime(user.terms_accepted_at)}>O</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {formatDate(user.joined_at)}
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">
                          <span title={formatDateTime(user.last_active)}>
                            {formatRelativeDateTime(user.last_active)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {user.total_ocr}
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
                                  email: user.email,
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
                  <strong>{changingTier.email || changingTier.userId.substring(0, 8)}</strong>
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

      {/* 관리자 권한 변경 확인 다이얼로그 */}
      <AlertDialog open={!!changingRole} onOpenChange={(open) => !open && setChangingRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {changingRole?.action === 'grant' ? '관리자 권한을 부여하시겠습니까?' : '관리자 권한을 해제하시겠습니까?'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {changingRole && (
                  <>
                    <p>
                      <strong>{changingRole.email || changingRole.userId.substring(0, 8)}</strong>
                      {changingRole.action === 'grant'
                        ? ' 사용자에게 관리자 권한을 부여합니다.'
                        : ' 사용자의 관리자 권한을 해제합니다.'}
                    </p>
                    {changingRole.action === 'grant' && (
                      <p className="mt-2 text-orange-600">
                        관리자는 마스터 데이터, 사용자 관리 등 모든 관리 기능에 접근할 수 있습니다.
                      </p>
                    )}
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleRoleChange} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {changingRole?.action === 'grant' ? '부여' : '해제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
