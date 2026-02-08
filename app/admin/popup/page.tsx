'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AppHeader } from '@/components/layout/AppHeader'
import { RichTextEditor } from '@/components/editors/RichTextEditor'
import { Loader2, ShieldCheck, Save, Plus, Trash2, Pencil, ArrowLeft, ChevronDown, ChevronUp, Eye } from 'lucide-react'

interface PopupAnnouncement {
  id: string
  enabled: boolean
  title: string
  content: string
  startDate: string
  endDate: string
  priority: number
  createdAt: string
  updatedAt: string
}

export default function PopupManagementPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [announcements, setAnnouncements] = useState<PopupAnnouncement[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  // 편집 폼 상태
  const [form, setForm] = useState({
    enabled: true,
    title: '',
    content: '',
    startDate: '',
    endDate: '',
    priority: 0,
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const adminRes = await fetch('/api/admin/stats')
        if (adminRes.status === 403) {
          setError('관리자 권한이 필요합니다')
          setAuthorized(false)
          setLoading(false)
          return
        }
        setAuthorized(true)

        const res = await fetch('/api/admin/popup-settings')
        const data = await res.json()
        if (data.success) {
          setAnnouncements(data.data || [])
        }
      } catch (err) {
        console.error('Failed to fetch popup settings:', err)
        setError('설정을 불러오는데 실패했습니다')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const resetForm = () => {
    setForm({ enabled: true, title: '', content: '', startDate: '', endDate: '', priority: 0 })
    setEditingId(null)
    setShowPreview(false)
  }

  const startEdit = (announcement: PopupAnnouncement) => {
    setForm({
      enabled: announcement.enabled,
      title: announcement.title,
      content: announcement.content,
      startDate: announcement.startDate,
      endDate: announcement.endDate,
      priority: announcement.priority,
    })
    setEditingId(announcement.id)
    setShowPreview(false)
    setError(null)
    setSuccess(null)
  }

  const startCreate = () => {
    // 기본값: 오늘 ~ 30일 후
    const today = new Date()
    const thirtyDaysLater = new Date(today)
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30)

    setForm({
      enabled: true,
      title: '',
      content: '',
      startDate: today.toISOString().split('T')[0],
      endDate: thirtyDaysLater.toISOString().split('T')[0],
      priority: 0,
    })
    setEditingId('new')
    setShowPreview(false)
    setError(null)
    setSuccess(null)
  }

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError('제목을 입력해주세요')
      return
    }
    if (!form.startDate || !form.endDate) {
      setError('시작일과 종료일을 입력해주세요')
      return
    }
    if (form.startDate > form.endDate) {
      setError('종료일은 시작일 이후여야 합니다')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const isNew = editingId === 'new'
      const url = '/api/admin/popup-settings'
      const method = isNew ? 'POST' : 'PUT'
      const body = isNew ? form : { id: editingId, ...form }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '저장 실패')
        return
      }

      if (isNew) {
        setAnnouncements(prev => [...prev, data.data])
      } else {
        setAnnouncements(prev => prev.map(a => a.id === editingId ? data.data : a))
      }

      setSuccess(isNew ? '공지가 추가되었습니다' : '공지가 수정되었습니다')
      resetForm()
    } catch (err) {
      console.error('Save error:', err)
      setError('저장 중 오류가 발생했습니다')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 공지를 삭제하시겠습니까?')) return

    try {
      const res = await fetch(`/api/admin/popup-settings?id=${id}`, { method: 'DELETE' })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '삭제 실패')
        return
      }

      setAnnouncements(prev => prev.filter(a => a.id !== id))
      if (editingId === id) resetForm()
      setSuccess('공지가 삭제되었습니다')
    } catch (err) {
      console.error('Delete error:', err)
      setError('삭제 중 오류가 발생했습니다')
    }
  }

  const isExpired = (endDate: string) => {
    const today = new Date().toISOString().split('T')[0]
    return endDate < today
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-muted">
        <AppHeader title="관리자" />
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-muted">
        <AppHeader title="관리자" />
        <div className="container max-w-4xl mx-auto py-10 px-4">
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <ShieldCheck className="w-5 h-5" />
                접근 권한 없음
              </CardTitle>
              <CardDescription>
                {error || '이 페이지에 접근할 권한이 없습니다.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/')}>
                메인으로 돌아가기
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader title="팝업 공지 관리" />

      <div className="container max-w-4xl mx-auto py-6 px-4">
        {/* 뒤로가기 */}
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => router.push('/admin')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          관리자 대시보드
        </Button>

        {/* 알림 메시지 */}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* 공지 목록 */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">공지 목록</CardTitle>
                <CardDescription>등록된 팝업 공지를 관리합니다</CardDescription>
              </div>
              <Button onClick={startCreate} size="sm" disabled={editingId !== null}>
                <Plus className="w-4 h-4 mr-1" />
                새 공지
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {announcements.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                등록된 공지가 없습니다
              </p>
            ) : (
              <div className="space-y-3">
                {announcements
                  .sort((a, b) => b.priority - a.priority)
                  .map(announcement => (
                    <div
                      key={announcement.id}
                      className={`p-4 border rounded-lg ${
                        isExpired(announcement.endDate) ? 'opacity-50' : ''
                      } ${editingId === announcement.id ? 'border-primary bg-primary/5' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`inline-block w-2 h-2 rounded-full ${
                              announcement.enabled ? 'bg-green-500' : 'bg-gray-300'
                            }`} />
                            <span className="font-medium truncate">{announcement.title}</span>
                            {isExpired(announcement.endDate) && (
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">만료</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {announcement.startDate} ~ {announcement.endDate}
                            <span className="ml-2">우선순위: {announcement.priority}</span>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(announcement)}
                            disabled={editingId !== null && editingId !== announcement.id}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(announcement.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 편집/생성 폼 */}
        {editingId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {editingId === 'new' ? '새 공지 작성' : '공지 수정'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 활성화 */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={form.enabled}
                  onChange={e => setForm(prev => ({ ...prev, enabled: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <Label htmlFor="enabled">활성화</Label>
              </div>

              {/* 제목 */}
              <div className="space-y-2">
                <Label htmlFor="title">제목</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="공지 제목"
                  maxLength={100}
                />
              </div>

              {/* 기간 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">시작일</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={form.startDate}
                    onChange={e => setForm(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">종료일</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={form.endDate}
                    onChange={e => setForm(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              </div>

              {/* 우선순위 */}
              <div className="space-y-2">
                <Label htmlFor="priority">우선순위 (높을수록 먼저 표시)</Label>
                <Input
                  id="priority"
                  type="number"
                  value={form.priority}
                  onChange={e => setForm(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                />
              </div>

              {/* 본문 */}
              <div className="space-y-2">
                <Label>본문</Label>
                <RichTextEditor
                  content={form.content}
                  onChange={(html) => setForm(prev => ({ ...prev, content: html }))}
                  placeholder="공지 내용을 입력하세요"
                />
              </div>

              {/* 미리보기 토글 */}
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  미리보기
                  {showPreview ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
                </Button>
                {showPreview && (
                  <div className="mt-3 p-4 border rounded-lg bg-white">
                    <h3 className="font-semibold text-lg mb-2">{form.title || '(제목 없음)'}</h3>
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: form.content || '<span class="text-muted-foreground">(내용 없음)</span>' }}
                    />
                  </div>
                )}
              </div>

              {/* 액션 버튼 */}
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  저장
                </Button>
                <Button variant="outline" onClick={resetForm} disabled={saving}>
                  취소
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
