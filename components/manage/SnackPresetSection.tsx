'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Loader2, Plus, Trash2, Edit2, Save } from 'lucide-react'
import type { SnackPreset } from '@/types'
import { usePet } from '@/contexts/PetContext'

export function SnackPresetSection({
  presets,
  setPresets
}: {
  presets: SnackPreset[]
  setPresets: (p: SnackPreset[]) => void
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPreset, setEditingPreset] = useState<SnackPreset | null>(null)
  const [name, setName] = useState('')
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null)
  const [defaultAmount, setDefaultAmount] = useState('')
  const [caloriesPerUnit, setCaloriesPerUnit] = useState('')
  const [unit, setUnit] = useState('g')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const { pets } = usePet()

  const resetForm = () => {
    setName('')
    setSelectedPetId(null)
    setDefaultAmount('')
    setCaloriesPerUnit('')
    setUnit('g')
    setMemo('')
    setEditingPreset(null)
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)

    try {
      const url = '/api/snack-presets'
      const method = editingPreset ? 'PATCH' : 'POST'
      const body = editingPreset
        ? {
            id: editingPreset.id,
            name,
            pet_id: selectedPetId,
            default_amount: defaultAmount ? parseFloat(defaultAmount) : null,
            calories_per_unit: caloriesPerUnit ? parseFloat(caloriesPerUnit) : null,
            unit,
            memo: memo || null,
          }
        : {
            name,
            pet_id: selectedPetId,
            default_amount: defaultAmount ? parseFloat(defaultAmount) : null,
            calories_per_unit: caloriesPerUnit ? parseFloat(caloriesPerUnit) : null,
            unit,
            memo: memo || null,
          }

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
      console.error('Failed to save snack preset:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/snack-presets?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setPresets(presets.filter(p => p.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete snack preset:', error)
    }
  }

  const openEditDialog = (preset: SnackPreset) => {
    setEditingPreset(preset)
    setName(preset.name)
    setSelectedPetId(preset.pet_id)
    setDefaultAmount(preset.default_amount?.toString() || '')
    setCaloriesPerUnit(preset.calories_per_unit?.toString() || '')
    setUnit(preset.unit || 'g')
    setMemo(preset.memo || '')
    setIsDialogOpen(true)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span className="text-xl">🍪</span>
              간식 프리셋
            </CardTitle>
            <CardDescription>자주 주는 간식을 등록하면 빠르게 기록할 수 있어요</CardDescription>
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
                <DialogTitle>{editingPreset ? '간식 수정' : '새 간식 추가'}</DialogTitle>
                <DialogDescription>간식 정보를 입력하세요</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="snack_name">간식 이름 *</Label>
                  <Input
                    id="snack_name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="예: 츄르, 닭가슴살"
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
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="default_amount">기본 급여량</Label>
                    <Input
                      id="default_amount"
                      type="number"
                      value={defaultAmount}
                      onChange={(e) => setDefaultAmount(e.target.value)}
                      placeholder="예: 14"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="snack_unit">단위</Label>
                    <Select value={unit} onValueChange={setUnit}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="g">g</SelectItem>
                        <SelectItem value="개">개</SelectItem>
                        <SelectItem value="ml">ml</SelectItem>
                        <SelectItem value="봉">봉</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="calories_per_unit">칼로리 (kcal, 선택)</Label>
                  <Input
                    id="calories_per_unit"
                    type="number"
                    step="0.1"
                    value={caloriesPerUnit}
                    onChange={(e) => setCaloriesPerUnit(e.target.value)}
                    placeholder="1회 급여 기준 kcal"
                  />
                  <p className="text-xs text-muted-foreground">기본 급여량 기준 칼로리를 입력하세요</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="snack_memo">메모 (선택)</Label>
                  <Textarea
                    id="snack_memo"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="예: 냉장 보관, 하루 2개 이내"
                    rows={2}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>취소</Button>
                <Button onClick={handleSave} disabled={saving || !name.trim()}>
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
            등록된 간식이 없습니다
          </p>
        ) : (
          <div className="space-y-3">
            {presets.map((preset) => {
              const targetPet = preset.pet_id ? pets.find(p => p.id === preset.pet_id) : null
              return (
                <div key={preset.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span>🍪</span>
                      <h4 className="font-medium">{preset.name}</h4>
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
                            <AlertDialogTitle>간식 삭제</AlertDialogTitle>
                            <AlertDialogDescription>
                              &quot;{preset.name}&quot; 간식을 삭제하시겠습니까?
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
                  <div className="text-sm text-muted-foreground flex flex-wrap gap-2">
                    {preset.default_amount && (
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {preset.default_amount}{preset.unit}
                      </span>
                    )}
                    {preset.calories_per_unit && (
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {preset.calories_per_unit}kcal
                      </span>
                    )}
                    {preset.memo && (
                      <span className="text-xs text-muted-foreground">{preset.memo}</span>
                    )}
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
