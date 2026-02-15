'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Loader2, Plus, Trash2, Edit2, Save, Pill } from 'lucide-react'
import { MedicinePreset, Medicine } from '@/types'
import { usePet } from '@/contexts/PetContext'

const FREQUENCY_OPTIONS = [
  { value: 'qd', label: 'QD (1일 1회)' },
  { value: 'bid', label: 'BID (1일 2회)' },
  { value: 'tid', label: 'TID (1일 3회)' },
  { value: 'qid', label: 'QID (1일 4회)' },
  { value: 'prn', label: 'PRN (필요시)' },
]

export function MedicinePresetSection({
  presets,
  setPresets
}: {
  presets: MedicinePreset[]
  setPresets: (p: MedicinePreset[]) => void
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPreset, setEditingPreset] = useState<MedicinePreset | null>(null)
  const [presetName, setPresetName] = useState('')
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null)
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [saving, setSaving] = useState(false)
  const { pets } = usePet()

  const resetForm = () => {
    setPresetName('')
    setSelectedPetId(null)
    setMedicines([])
    setEditingPreset(null)
  }

  const addMedicine = () => {
    setMedicines([...medicines, { name: '', dosage: 0, dosage_unit: 'mg', frequency: 'qd' }])
  }

  const removeMedicine = (index: number) => {
    setMedicines(medicines.filter((_, i) => i !== index))
  }

  const updateMedicine = (index: number, field: keyof Medicine, value: string | number) => {
    const updated = [...medicines]
    updated[index] = { ...updated[index], [field]: value }
    setMedicines(updated)
  }

  const handleSave = async () => {
    if (!presetName.trim()) return
    setSaving(true)

    try {
      const url = '/api/medicine-presets'
      const method = editingPreset ? 'PATCH' : 'POST'
      const body = editingPreset
        ? { id: editingPreset.id, preset_name: presetName, pet_id: selectedPetId, medicines }
        : { preset_name: presetName, pet_id: selectedPetId, medicines }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await res.json()
      if (data.success) {
        if (editingPreset) {
          setPresets(presets.map(p => p.id === data.data.id ? data.data : p))
        } else {
          setPresets([...presets, data.data])
        }
        setIsDialogOpen(false)
        resetForm()
      }
    } catch (error) {
      console.error('Failed to save preset:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/medicine-presets?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setPresets(presets.filter(p => p.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete preset:', error)
    }
  }

  const openEditDialog = (preset: MedicinePreset) => {
    setEditingPreset(preset)
    setPresetName(preset.preset_name)
    setSelectedPetId(preset.pet_id)
    setMedicines(preset.medicines)
    setIsDialogOpen(true)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Pill className="w-5 h-5" />
              약 프리셋
            </CardTitle>
            <CardDescription>자주 사용하는 약 조합을 저장하세요</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) resetForm()
          }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" />
                추가
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingPreset ? '프리셋 수정' : '새 프리셋 추가'}</DialogTitle>
                <DialogDescription>약물 정보를 입력하세요</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="preset_name">프리셋 이름</Label>
                  <Input
                    id="preset_name"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="예: 아침 약, 저녁 약"
                  />
                </div>

                <div className="space-y-2">
                  <Label>표시 대상</Label>
                  <Select
                    value={selectedPetId || 'all'}
                    onValueChange={(value) => setSelectedPetId(value === 'all' ? null : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="반려동물 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">모든 반려동물</SelectItem>
                      {pets.map((pet) => (
                        <SelectItem key={pet.id} value={pet.id}>
                          {pet.name}만
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    특정 반려동물을 선택하면 해당 반려동물 선택 시에만 이 프리셋이 표시됩니다.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>약물 목록</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addMedicine}>
                      <Plus className="w-3 h-3 mr-1" />
                      약물 추가
                    </Button>
                  </div>

                  {medicines.map((med, index) => (
                    <div key={index} className="p-3 border rounded-lg space-y-2 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">약물 {index + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMedicine(index)}
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="약물명"
                          value={med.name}
                          onChange={(e) => updateMedicine(index, 'name', e.target.value)}
                        />
                        <div className="flex gap-1">
                          <Input
                            type="number"
                            placeholder="용량"
                            value={med.dosage || ''}
                            onChange={(e) => updateMedicine(index, 'dosage', parseFloat(e.target.value) || 0)}
                            className="w-20"
                          />
                          <Select
                            value={med.dosage_unit}
                            onValueChange={(value) => updateMedicine(index, 'dosage_unit', value)}
                          >
                            <SelectTrigger className="w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="mg">mg</SelectItem>
                              <SelectItem value="mg/kg">mg/kg</SelectItem>
                              <SelectItem value="ml">ml</SelectItem>
                              <SelectItem value="ml/kg">ml/kg</SelectItem>
                              <SelectItem value="tablet">정</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Select
                        value={med.frequency}
                        onValueChange={(value) => updateMedicine(index, 'frequency', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="투약 빈도" />
                        </SelectTrigger>
                        <SelectContent>
                          {FREQUENCY_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}

                  {medicines.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      약물 추가 버튼을 눌러 약물을 추가하세요
                    </p>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>취소</Button>
                <Button onClick={handleSave} disabled={saving || !presetName.trim()}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  저장
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {presets.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            등록된 프리셋이 없습니다
          </p>
        ) : (
          <div className="space-y-3">
            {presets.map((preset) => {
              const targetPet = preset.pet_id ? pets.find(p => p.id === preset.pet_id) : null
              return (
              <div key={preset.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{preset.preset_name}</h4>
                    {targetPet ? (
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                        {targetPet.name}
                      </span>
                    ) : (
                      <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                        전체
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(preset)}>
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>프리셋 삭제</AlertDialogTitle>
                          <AlertDialogDescription>
                            &quot;{preset.preset_name}&quot; 프리셋을 삭제하시겠습니까?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>취소</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(preset.id)}>삭제</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="space-y-1">
                  {preset.medicines.map((med, idx) => (
                    <div key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                      <span>💊</span>
                      <span>{med.name}</span>
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {med.dosage} {med.dosage_unit}
                      </span>
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {FREQUENCY_OPTIONS.find(f => f.value === med.frequency)?.label || med.frequency}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
