'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePet } from '@/contexts/PetContext'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Mic, Plus, ChevronDown, ChevronUp, Loader2,
  Pencil, Trash2, Calendar, Stethoscope, Pill,
  FileText, LineChart,
} from 'lucide-react'

interface Prescription {
  drug_name: string
  dosage: string
  frequency: string
  duration: string
}

interface VetVisit {
  id: string
  pet_id: string
  visit_date: string
  hospital_name: string | null
  vet_name: string | null
  diagnosis: string[]
  prescriptions: Prescription[]
  procedures: string | null
  next_visit_date: string | null
  vet_instructions: string | null
  cost: number | null
  transcript: string | null
  audio_file_path: string | null
  audio_signed_url?: string | null
  created_at: string
}

interface TranscribeResult {
  transcript: string
  structured: {
    visit_date: string | null
    hospital_name: string | null
    vet_name: string | null
    diagnosis: string[]
    prescriptions: Prescription[]
    procedures: string | null
    next_visit_date: string | null
    vet_instructions: string | null
    cost: number | null
  }
  audio_file_path: string
}

const CONSENT_TEXT = `본 서비스의 녹음 분석 기능을 이용하기 전에 다음 사항을 확인하고 동의합니다:

1. 적법한 녹음만 업로드합니다
   - 본인이 직접 참여한 진료 대화만 녹음하여 업로드합니다.
   - 제3자 간의 대화(예: 의료진 간 대화)를 몰래 녹음한 파일은 업로드하지 않습니다.
   - 의료진이 녹음을 명시적으로 거부한 경우, 해당 녹음은 업로드하지 않습니다.

2. 녹음 내용을 유포하지 않습니다
   - 녹음 및 분석 결과를 SNS, 인터넷 등에 무단 게시하지 않습니다.
   - 의료진을 비방·협박하는 용도로 사용하지 않습니다.
   - 위반 시 명예훼손, 모욕죄 등 법적 책임을 질 수 있습니다.

3. 서비스 면책
   - 미모의 하루는 녹음 행위의 적법성, 녹음 내용의 정확성·완전성에 대해 어떠한 책임도 지지 않습니다.
   - AI 분석 결과는 참고용이며, 의료적 판단의 근거로 사용할 수 없습니다.
   - 녹음 파일은 분석 목적으로만 사용되며, 제3자에게 제공되지 않습니다.`

export default function VetVisitsPage() {
  const { currentPet } = usePet()
  const { toast } = useToast()

  const [visits, setVisits] = useState<VetVisit[]>([])
  const [loading, setLoading] = useState(true)

  // Upload flow
  const [showUpload, setShowUpload] = useState(false)
  const [consentAgreed, setConsentAgreed] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [, setTranscribeResult] = useState<TranscribeResult | null>(null)

  // Edit form (shared for new + edit)
  const [editForm, setEditForm] = useState<{
    visit_date: string
    hospital_name: string
    vet_name: string
    diagnosis: string
    prescriptions: Prescription[]
    procedures: string
    next_visit_date: string
    vet_instructions: string
    cost: string
    transcript: string
    audio_file_path: string
  } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null) // null = new
  const [saving, setSaving] = useState(false)

  // Detail view
  const [selectedVisit, setSelectedVisit] = useState<VetVisit | null>(null)
  const [expandedTranscript, setExpandedTranscript] = useState(false)

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const fetchVisits = useCallback(async () => {
    if (!currentPet) return
    setLoading(true)
    try {
      const res = await fetch(`/api/vet-visits?pet_id=${currentPet.id}`)
      if (res.ok) {
        const { data } = await res.json()
        setVisits(data || [])
      }
    } catch {
      toast({ title: '진료 기록을 불러오지 못했습니다', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [currentPet, toast])

  useEffect(() => {
    fetchVisits()
  }, [fetchVisits])

  // Upload & transcribe
  const handleTranscribe = async () => {
    if (!selectedFile || !currentPet) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('pet_id', currentPet.id)
      formData.append('consent_agreed', 'true')

      const res = await fetch('/api/vet-visits/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (res.status === 403) {
        const { used, limit, tier } = await res.json()
        const tierLabel = tier === 'free' ? '무료' : tier === 'basic' ? '기본' : '프리미엄'
        toast({
          title: `이번 달 녹음 분석 횟수를 모두 사용했습니다`,
          description: `${tierLabel} 티어: ${used}/${limit}회`,
          variant: 'destructive',
        })
        return
      }

      if (!res.ok) {
        const { error } = await res.json()
        toast({ title: error || '업로드에 실패했습니다', variant: 'destructive' })
        return
      }

      const result: TranscribeResult = await res.json()
      setTranscribeResult(result)

      // Pre-fill edit form
      const s = result.structured
      setEditForm({
        visit_date: s.visit_date || new Date().toISOString().split('T')[0],
        hospital_name: s.hospital_name || '',
        vet_name: s.vet_name || '',
        diagnosis: (s.diagnosis || []).join(', '),
        prescriptions: s.prescriptions || [],
        procedures: s.procedures || '',
        next_visit_date: s.next_visit_date || '',
        vet_instructions: s.vet_instructions || '',
        cost: s.cost != null ? String(s.cost) : '',
        transcript: result.transcript,
        audio_file_path: result.audio_file_path,
      })
      setEditingId(null)
      setShowUpload(false)

      if (!result.transcript || result.transcript.trim().length === 0) {
        toast({ title: '녹음 내용을 인식하지 못했습니다', description: '직접 입력해주세요' })
      }
    } catch {
      toast({ title: '업로드에 실패했습니다. 다시 시도해주세요', variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  // Save (create or update)
  const handleSave = async () => {
    if (!editForm || !currentPet) return
    setSaving(true)
    try {
      const body = {
        pet_id: currentPet.id,
        visit_date: editForm.visit_date,
        hospital_name: editForm.hospital_name || null,
        vet_name: editForm.vet_name || null,
        diagnosis: editForm.diagnosis ? editForm.diagnosis.split(',').map(d => d.trim()).filter(Boolean) : [],
        prescriptions: editForm.prescriptions,
        procedures: editForm.procedures || null,
        next_visit_date: editForm.next_visit_date || null,
        vet_instructions: editForm.vet_instructions || null,
        cost: editForm.cost ? Number(editForm.cost) : null,
        transcript: editForm.transcript || null,
        audio_file_path: editForm.audio_file_path || null,
      }

      let res: Response
      if (editingId) {
        res = await fetch(`/api/vet-visits?id=${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch('/api/vet-visits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }

      if (!res.ok) {
        toast({ title: '저장에 실패했습니다', variant: 'destructive' })
        return
      }

      toast({ title: editingId ? '진료 기록이 수정되었습니다' : '진료 기록이 저장되었습니다' })
      setEditForm(null)
      setEditingId(null)
      setTranscribeResult(null)
      setSelectedVisit(null)
      fetchVisits()
    } catch {
      toast({ title: '저장에 실패했습니다', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // Delete
  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      const res = await fetch(`/api/vet-visits?id=${deleteTarget}`, { method: 'DELETE' })
      if (res.ok) {
        toast({ title: '진료 기록이 삭제되었습니다' })
        setSelectedVisit(null)
        fetchVisits()
      }
    } catch {
      toast({ title: '삭제에 실패했습니다', variant: 'destructive' })
    } finally {
      setDeleteTarget(null)
    }
  }

  // Open edit from detail
  const startEdit = (visit: VetVisit) => {
    setEditForm({
      visit_date: visit.visit_date,
      hospital_name: visit.hospital_name || '',
      vet_name: visit.vet_name || '',
      diagnosis: (visit.diagnosis || []).join(', '),
      prescriptions: visit.prescriptions || [],
      procedures: visit.procedures || '',
      next_visit_date: visit.next_visit_date || '',
      vet_instructions: visit.vet_instructions || '',
      cost: visit.cost != null ? String(visit.cost) : '',
      transcript: visit.transcript || '',
      audio_file_path: visit.audio_file_path || '',
    })
    setEditingId(visit.id)
    setSelectedVisit(null)
  }

  // Prescription helpers
  const addPrescription = () => {
    if (!editForm) return
    setEditForm({
      ...editForm,
      prescriptions: [...editForm.prescriptions, { drug_name: '', dosage: '', frequency: '', duration: '' }],
    })
  }

  const updatePrescription = (idx: number, field: keyof Prescription, value: string) => {
    if (!editForm) return
    const updated = [...editForm.prescriptions]
    updated[idx] = { ...updated[idx], [field]: value }
    setEditForm({ ...editForm, prescriptions: updated })
  }

  const removePrescription = (idx: number) => {
    if (!editForm) return
    setEditForm({
      ...editForm,
      prescriptions: editForm.prescriptions.filter((_, i) => i !== idx),
    })
  }

  if (!currentPet) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        반려동물을 먼저 선택해주세요
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Stethoscope className="h-5 w-5" />
          진료 기록
        </h1>
        <Button onClick={() => { setShowUpload(true); setConsentAgreed(false); setSelectedFile(null) }}>
          <Mic className="h-4 w-4 mr-1" />
          녹음 분석
        </Button>
      </div>

      {/* Edit Form (new or editing) */}
      {editForm && (
        <Card className="p-4 space-y-4 border-primary/30">
          <h2 className="font-semibold text-lg">
            {editingId ? '진료 기록 수정' : '진료 기록 검수'}
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>진료일 *</Label>
              <Input
                type="date"
                value={editForm.visit_date}
                onChange={e => setEditForm({ ...editForm, visit_date: e.target.value })}
              />
            </div>
            <div>
              <Label>병원명</Label>
              <Input
                value={editForm.hospital_name}
                onChange={e => setEditForm({ ...editForm, hospital_name: e.target.value })}
                placeholder="○○동물병원"
              />
            </div>
            <div>
              <Label>수의사</Label>
              <Input
                value={editForm.vet_name}
                onChange={e => setEditForm({ ...editForm, vet_name: e.target.value })}
                placeholder="김수의사"
              />
            </div>
            <div>
              <Label>비용 (원)</Label>
              <Input
                type="number"
                value={editForm.cost}
                onChange={e => setEditForm({ ...editForm, cost: e.target.value })}
                placeholder="350000"
              />
            </div>
          </div>

          <div>
            <Label>진단명 (쉼표로 구분)</Label>
            <Input
              value={editForm.diagnosis}
              onChange={e => setEditForm({ ...editForm, diagnosis: e.target.value })}
              placeholder="췌장염, 탈수"
            />
          </div>

          {/* Prescriptions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>처방약</Label>
              <Button variant="outline" size="sm" onClick={addPrescription}>
                <Plus className="h-3 w-3 mr-1" /> 추가
              </Button>
            </div>
            {editForm.prescriptions.map((rx, i) => (
              <div key={i} className="grid grid-cols-5 gap-2 mb-2">
                <Input
                  placeholder="약명"
                  value={rx.drug_name}
                  onChange={e => updatePrescription(i, 'drug_name', e.target.value)}
                  className="col-span-2"
                />
                <Input
                  placeholder="용량"
                  value={rx.dosage}
                  onChange={e => updatePrescription(i, 'dosage', e.target.value)}
                />
                <Input
                  placeholder="횟수"
                  value={rx.frequency}
                  onChange={e => updatePrescription(i, 'frequency', e.target.value)}
                />
                <div className="flex gap-1">
                  <Input
                    placeholder="기간"
                    value={rx.duration}
                    onChange={e => updatePrescription(i, 'duration', e.target.value)}
                  />
                  <Button variant="ghost" size="icon" onClick={() => removePrescription(i)} className="shrink-0">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div>
            <Label>시술/처치 내용</Label>
            <Textarea
              value={editForm.procedures}
              onChange={e => setEditForm({ ...editForm, procedures: e.target.value })}
              placeholder="수액 치료 500ml"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>다음 방문일</Label>
              <Input
                type="date"
                value={editForm.next_visit_date}
                onChange={e => setEditForm({ ...editForm, next_visit_date: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>수의사 지시사항</Label>
            <Textarea
              value={editForm.vet_instructions}
              onChange={e => setEditForm({ ...editForm, vet_instructions: e.target.value })}
              placeholder="3일간 금식 후 처방식이 소량 급여"
              rows={2}
            />
          </div>

          {/* Transcript toggle */}
          {editForm.transcript && (
            <div>
              <button
                onClick={() => setExpandedTranscript(!expandedTranscript)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                {expandedTranscript ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                전사 원문 {expandedTranscript ? '접기' : '보기'}
              </button>
              {expandedTranscript && (
                <div className="mt-2 p-3 bg-muted rounded-md text-sm whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {editForm.transcript}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => { setEditForm(null); setEditingId(null); setTranscribeResult(null) }}
            >
              취소
            </Button>
            <Button onClick={handleSave} disabled={saving || !editForm.visit_date}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              저장
            </Button>
          </div>
        </Card>
      )}

      {/* Visit List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : visits.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Stethoscope className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>아직 진료 기록이 없습니다</p>
          <p className="text-sm mt-1">녹음 분석 버튼을 눌러 진료 녹음을 업로드해보세요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visits.map(visit => (
            <Card
              key={visit.id}
              className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => setSelectedVisit(visit)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{visit.visit_date}</span>
                    {visit.hospital_name && (
                      <span className="text-sm text-muted-foreground">({visit.hospital_name})</span>
                    )}
                  </div>
                  {visit.diagnosis && visit.diagnosis.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {visit.diagnosis.map((d, i) => (
                        <Badge key={i} variant="secondary">{d}</Badge>
                      ))}
                    </div>
                  )}
                  {visit.prescriptions && visit.prescriptions.length > 0 && (
                    <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                      <Pill className="h-3 w-3" />
                      {visit.prescriptions.map(rx => rx.drug_name).filter(Boolean).join(', ')}
                    </div>
                  )}
                </div>
                {visit.cost != null && (
                  <span className="text-sm font-medium">{visit.cost.toLocaleString()}원</span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>진료 녹음 분석</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Consent */}
            <div className="border rounded-lg p-3 bg-muted/50 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
              {CONSENT_TEXT}
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="consent"
                checked={consentAgreed}
                onCheckedChange={v => setConsentAgreed(v === true)}
              />
              <label htmlFor="consent" className="text-sm cursor-pointer leading-tight">
                위 내용을 모두 확인하였으며, 동의합니다.
              </label>
            </div>

            {/* File select */}
            <div>
              <Label>오디오 파일 (mp3, m4a, wav, webm, ogg, flac / 최대 25MB)</Label>
              <Input
                type="file"
                accept="audio/*,.mp3,.m4a,.wav,.webm,.ogg,.flac"
                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                className="mt-1"
              />
              {selectedFile && (
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(1)}MB)
                </p>
              )}
            </div>

            <Button
              className="w-full"
              disabled={!consentAgreed || !selectedFile || uploading}
              onClick={handleTranscribe}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  분석 중... (1~2분 소요)
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4 mr-2" />
                  업로드 및 분석
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!selectedVisit} onOpenChange={open => { if (!open) setSelectedVisit(null) }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedVisit && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {selectedVisit.visit_date}
                  {selectedVisit.hospital_name && (
                    <span className="font-normal text-muted-foreground">
                      ({selectedVisit.hospital_name})
                    </span>
                  )}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {selectedVisit.vet_name && (
                  <div>
                    <Label className="text-muted-foreground">수의사</Label>
                    <p>{selectedVisit.vet_name}</p>
                  </div>
                )}

                {selectedVisit.diagnosis && selectedVisit.diagnosis.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">진단</Label>
                    <div className="flex gap-1 flex-wrap mt-1">
                      {selectedVisit.diagnosis.map((d, i) => (
                        <Badge key={i} variant="secondary">{d}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedVisit.prescriptions && selectedVisit.prescriptions.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">처방약</Label>
                    <div className="mt-1 space-y-1">
                      {selectedVisit.prescriptions.map((rx, i) => (
                        <div key={i} className="text-sm flex items-center gap-1">
                          <Pill className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{rx.drug_name}</span>
                          {rx.dosage && <span className="text-muted-foreground">{rx.dosage}</span>}
                          {rx.frequency && <span className="text-muted-foreground">/ {rx.frequency}</span>}
                          {rx.duration && <span className="text-muted-foreground">/ {rx.duration}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedVisit.procedures && (
                  <div>
                    <Label className="text-muted-foreground">시술/처치</Label>
                    <p className="text-sm">{selectedVisit.procedures}</p>
                  </div>
                )}

                {selectedVisit.vet_instructions && (
                  <div>
                    <Label className="text-muted-foreground">수의사 지시사항</Label>
                    <p className="text-sm">{selectedVisit.vet_instructions}</p>
                  </div>
                )}

                {selectedVisit.next_visit_date && (
                  <div>
                    <Label className="text-muted-foreground">다음 방문일</Label>
                    <p className="text-sm">{selectedVisit.next_visit_date}</p>
                  </div>
                )}

                {selectedVisit.cost != null && (
                  <div>
                    <Label className="text-muted-foreground">비용</Label>
                    <p className="text-sm font-medium">{selectedVisit.cost.toLocaleString()}원</p>
                  </div>
                )}

                {/* Transcript */}
                {selectedVisit.transcript && (
                  <div>
                    <button
                      onClick={() => setExpandedTranscript(!expandedTranscript)}
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                      {expandedTranscript ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      전사 원문 {expandedTranscript ? '접기' : '보기'}
                    </button>
                    {expandedTranscript && (
                      <div className="mt-2 p-3 bg-muted rounded-md text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {selectedVisit.transcript}
                      </div>
                    )}
                  </div>
                )}

                {/* 양방향 참조 링크 */}
                <div className="flex gap-2 flex-wrap">
                  <Link
                    href={`/daily-log?date=${selectedVisit.visit_date}`}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-muted hover:bg-accent transition-colors"
                  >
                    <FileText className="h-3 w-3" /> 일일기록 보기
                  </Link>
                  <Link
                    href={`/dashboard?date=${selectedVisit.visit_date}`}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-muted hover:bg-accent transition-colors"
                  >
                    <LineChart className="h-3 w-3" /> 검사결과 보기
                  </Link>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="outline" size="sm" onClick={() => startEdit(selectedVisit)}>
                    <Pencil className="h-3 w-3 mr-1" /> 수정
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteTarget(selectedVisit.id)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> 삭제
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>진료 기록 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 진료 기록을 삭제하시겠습니까? 삭제된 기록은 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
