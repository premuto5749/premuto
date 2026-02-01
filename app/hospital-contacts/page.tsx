'use client'

import { useState, useEffect, Suspense } from 'react'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Loader2, Plus, Trash2, Edit2, Save, Phone, MapPin, ExternalLink } from 'lucide-react'
import type { Hospital } from '@/types'

function HospitalContactsContent() {
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null)
  const [form, setForm] = useState({ name: '', address: '', phone: '', website: '', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadHospitals()
  }, [])

  const loadHospitals = async () => {
    try {
      const res = await fetch('/api/hospitals')
      const data = await res.json()
      if (data.success) {
        setHospitals(data.data)
      }
    } catch (error) {
      console.error('Failed to load hospitals:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setForm({ name: '', address: '', phone: '', website: '', notes: '' })
    setEditingHospital(null)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)

    try {
      const method = editingHospital ? 'PATCH' : 'POST'
      const body = editingHospital
        ? { id: editingHospital.id, ...form }
        : form

      const res = await fetch('/api/hospitals', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await res.json()
      if (data.success) {
        if (editingHospital) {
          setHospitals(hospitals.map(h => h.id === data.data.id ? data.data : h))
        } else {
          setHospitals([...hospitals, data.data])
        }
        setIsDialogOpen(false)
        resetForm()
      }
    } catch (error) {
      console.error('Failed to save hospital:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/hospitals?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setHospitals(hospitals.filter(h => h.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete hospital:', error)
    }
  }

  const openEditDialog = (hospital: Hospital) => {
    setEditingHospital(hospital)
    setForm({
      name: hospital.name,
      address: hospital.address || '',
      phone: hospital.phone || '',
      website: hospital.website || '',
      notes: hospital.notes || ''
    })
    setIsDialogOpen(true)
  }

  const handlePhoneCall = (phone: string) => {
    window.location.href = `tel:${phone.replace(/[^0-9]/g, '')}`
  }

  const handleOpenMap = (website: string) => {
    window.open(website, '_blank', 'noopener,noreferrer')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-muted">
        <AppHeader title="병원 연락처" />
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader title="병원 연락처" />

      <div className="container max-w-2xl mx-auto py-6 px-4">
        {/* 헤더 및 추가 버튼 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">병원 목록</h2>
            <p className="text-sm text-muted-foreground">
              자주 가는 병원의 연락처를 관리하세요
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) resetForm()
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-1" />
                병원 추가
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingHospital ? '병원 정보 수정' : '새 병원 추가'}</DialogTitle>
                <DialogDescription>
                  병원 정보를 입력하세요. 이름만 필수이며 나머지는 선택사항입니다.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="hospital_name">병원 이름 *</Label>
                  <Input
                    id="hospital_name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="병원 이름"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hospital_address">주소</Label>
                  <Input
                    id="hospital_address"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="예: 서울특별시 강남구..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hospital_phone">연락처</Label>
                  <Input
                    id="hospital_phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="02-XXX-XXXX"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hospital_website">지도 링크 (네이버지도, 카카오맵 등)</Label>
                  <Input
                    id="hospital_website"
                    value={form.website}
                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                    placeholder="https://naver.me/..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hospital_notes">메모</Label>
                  <Textarea
                    id="hospital_notes"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="메모 (진료시간, 담당 수의사 등)"
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>취소</Button>
                <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  저장
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* 병원 카드 목록 */}
        {hospitals.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                등록된 병원이 없습니다
              </p>
              <Button variant="outline" onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />
                첫 병원 등록하기
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {hospitals.map((hospital) => (
              <Card key={hospital.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* 좌측: 병원 정보 */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg truncate">{hospital.name}</h3>
                      {hospital.address && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{hospital.address}</span>
                        </p>
                      )}
                      {hospital.notes && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {hospital.notes}
                        </p>
                      )}
                    </div>

                    {/* 우측: 액션 버튼 */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {hospital.phone && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handlePhoneCall(hospital.phone!)}
                          title="전화 걸기"
                          className="w-10 h-10"
                        >
                          <Phone className="w-5 h-5 text-green-600" />
                        </Button>
                      )}
                      {hospital.website && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleOpenMap(hospital.website!)}
                          title="지도 열기"
                          className="w-10 h-10"
                        >
                          <ExternalLink className="w-5 h-5 text-blue-600" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(hospital)}
                        title="수정"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" title="삭제">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>병원 삭제</AlertDialogTitle>
                            <AlertDialogDescription>
                              &quot;{hospital.name}&quot;을(를) 삭제하시겠습니까?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>취소</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(hospital.id)}>삭제</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 팁 */}
        <div className="mt-8 p-4 bg-muted rounded-lg">
          <h3 className="font-medium mb-2">💡 팁</h3>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>지도 링크에 네이버지도나 카카오맵 URL을 입력하면 버튼으로 바로 열 수 있습니다</li>
            <li>전화번호를 입력하면 버튼 터치로 바로 전화를 걸 수 있습니다</li>
            <li>메모에 진료시간, 담당 수의사 등을 기록해두세요</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default function HospitalContactsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <HospitalContactsContent />
    </Suspense>
  )
}
