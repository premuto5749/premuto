'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Loader2, Plus, Trash2, Edit2, Save, Download, Sun, Moon, Monitor, PawPrint, Pill, Building2, Palette, Database, AlertTriangle, Camera, Star, StarOff, RefreshCw, CheckCircle, AlertCircle, Info, ArrowRight } from 'lucide-react'
import { UserSettings, MedicinePreset, Medicine, Pet, PetInput } from '@/types'
import { usePet } from '@/contexts/PetContext'
import { createClient } from '@/lib/supabase/client'

// 투약 빈도 옵션
const FREQUENCY_OPTIONS = [
  { value: 'qd', label: 'QD (1일 1회)' },
  { value: 'bid', label: 'BID (1일 2회)' },
  { value: 'tid', label: 'TID (1일 3회)' },
  { value: 'qid', label: 'QID (1일 4회)' },
  { value: 'prn', label: 'PRN (필요시)' },
]

function SettingsPageContent({ defaultTab, isOnboarding = false }: { defaultTab: string; isOnboarding?: boolean }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [presets, setPresets] = useState<MedicinePreset[]>([])
  const { pets } = usePet()

  // 데이터 로드
  const loadData = useCallback(async () => {
    try {
      const [settingsRes, presetsRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/medicine-presets')
      ])

      const [settingsData, presetsData] = await Promise.all([
        settingsRes.json(),
        presetsRes.json()
      ])

      if (settingsData.success) setSettings(settingsData.data)
      if (presetsData.success) setPresets(presetsData.data)
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) {
    return (
      <div className="min-h-screen bg-muted">
        <AppHeader title="설정" />
        <div className="container max-w-4xl mx-auto py-10">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader title="설정" />

      <div className="container max-w-4xl mx-auto py-6 px-4">
        {/* 온보딩 환영 메시지 */}
        {isOnboarding && (
          <Card className={`mb-6 border-primary ${pets.length > 0 ? 'bg-green-50 border-green-500' : 'bg-primary/5'}`}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${pets.length > 0 ? 'bg-green-100' : 'bg-primary/20'}`}>
                  {pets.length > 0 ? (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  ) : (
                    <PawPrint className="w-6 h-6 text-primary" />
                  )}
                </div>
                <div className="flex-1">
                  {pets.length > 0 ? (
                    <>
                      <h2 className="text-lg font-semibold mb-1 text-green-700">등록 완료!</h2>
                      <p className="text-sm text-green-600 mb-3">
                        반려동물 등록이 완료되었습니다. 이제 서비스를 시작할 수 있습니다.
                      </p>
                      <Button onClick={() => window.location.href = '/'} className="bg-green-600 hover:bg-green-700">
                        시작하기
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <h2 className="text-lg font-semibold mb-1">환영합니다!</h2>
                      <p className="text-sm text-muted-foreground">
                        서비스를 시작하려면 먼저 반려동물을 등록해주세요.
                        등록 후 일일 건강 기록을 시작할 수 있습니다.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="pet" className="text-xs sm:text-sm">
              <PawPrint className="w-4 h-4 mr-1 hidden sm:inline" />
              반려동물
            </TabsTrigger>
            <TabsTrigger value="medicine" className="text-xs sm:text-sm">
              <Pill className="w-4 h-4 mr-1 hidden sm:inline" />
              약 프리셋
            </TabsTrigger>
            <TabsTrigger value="hospital" className="text-xs sm:text-sm">
              <Building2 className="w-4 h-4 mr-1 hidden sm:inline" />
              병원
            </TabsTrigger>
            <TabsTrigger value="theme" className="text-xs sm:text-sm">
              <Palette className="w-4 h-4 mr-1 hidden sm:inline" />
              테마
            </TabsTrigger>
            <TabsTrigger value="data" className="text-xs sm:text-sm">
              <Database className="w-4 h-4 mr-1 hidden sm:inline" />
              데이터
            </TabsTrigger>
          </TabsList>

          {/* 반려동물 프로필 */}
          <TabsContent value="pet">
            <PetProfileSection />
          </TabsContent>

          {/* 약 프리셋 */}
          <TabsContent value="medicine">
            <MedicinePresetSection
              presets={presets}
              setPresets={setPresets}
            />
          </TabsContent>

          {/* 병원 관리 - 병원 연락처 페이지로 이동 */}
          <TabsContent value="hospital">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  병원 관리
                </CardTitle>
                <CardDescription>병원 연락처 페이지에서 관리할 수 있습니다</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <a href="/hospital-contacts">병원 연락처 페이지로 이동</a>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 테마 설정 */}
          <TabsContent value="theme">
            <ThemeSection
              settings={settings}
              setSettings={setSettings}
              saving={saving}
              setSaving={setSaving}
            />
          </TabsContent>

          {/* 데이터 관리 */}
          <TabsContent value="data">
            <DataManagementSection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

// 메인 페이지 컴포넌트 (Suspense로 래핑)
function SettingsPageWrapper() {
  const searchParams = useSearchParams()
  const defaultTab = searchParams.get('tab') || 'pet'
  const isOnboarding = searchParams.get('onboarding') === 'true'
  return <SettingsPageContent defaultTab={defaultTab} isOnboarding={isOnboarding} />
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <SettingsPageWrapper />
    </Suspense>
  )
}

// 반려동물 프로필 섹션 (다중 반려동물 지원)
function PetProfileSection() {
  const { pets, currentPet, addPet, updatePet, removePet, refreshPets } = usePet()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPet, setEditingPet] = useState<Pet | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<PetInput>({
    name: '',
    type: '',
    breed: '',
    birth_date: '',
    weight_kg: null,
    photo_url: null,
    is_default: false,
  })

  const resetForm = () => {
    setForm({
      name: '',
      type: '',
      breed: '',
      birth_date: '',
      weight_kg: null,
      photo_url: null,
      is_default: false,
    })
    setEditingPet(null)
  }

  const openEditDialog = (pet: Pet) => {
    setEditingPet(pet)
    setForm({
      name: pet.name,
      type: pet.type || '',
      breed: pet.breed || '',
      birth_date: pet.birth_date || '',
      weight_kg: pet.weight_kg,
      photo_url: pet.photo_url,
      is_default: pet.is_default,
    })
    setIsDialogOpen(true)
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 파일 크기 제한 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('파일 크기는 5MB 이하여야 합니다.')
      return
    }

    // 이미지 타입 확인
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.')
      return
    }

    setUploading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `pets/${user.id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('pet-photos')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('pet-photos')
        .getPublicUrl(filePath)

      setForm(prev => ({ ...prev, photo_url: publicUrl }))
    } catch (error) {
      console.error('Photo upload failed:', error)
      alert('사진 업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert('이름을 입력해주세요.')
      return
    }

    setSaving(true)
    try {
      const method = editingPet ? 'PATCH' : 'POST'
      const body = editingPet
        ? { id: editingPet.id, ...form, weight_kg: form.weight_kg || null }
        : { ...form, weight_kg: form.weight_kg || null }

      const res = await fetch('/api/pets', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await res.json()
      if (data.success) {
        if (editingPet) {
          updatePet(data.data)
        } else {
          addPet(data.data)
        }
        setIsDialogOpen(false)
        resetForm()
      } else {
        alert(data.error || '저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('Failed to save pet:', error)
      alert('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (petId: string) => {
    try {
      const res = await fetch(`/api/pets?id=${petId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        removePet(petId)
      } else {
        alert(data.error || '삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('Failed to delete pet:', error)
      alert('삭제에 실패했습니다.')
    }
  }

  const handleSetDefault = async (pet: Pet) => {
    try {
      const res = await fetch('/api/pets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pet.id, is_default: true })
      })

      const data = await res.json()
      if (data.success) {
        // 기존 기본 반려동물 해제 후 새로운 기본 설정
        refreshPets()
      }
    } catch (error) {
      console.error('Failed to set default pet:', error)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <PawPrint className="w-5 h-5" />
              반려동물 프로필
            </CardTitle>
            <CardDescription>여러 마리의 반려동물을 등록하고 관리하세요</CardDescription>
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
                <DialogTitle>{editingPet ? '반려동물 수정' : '새 반려동물 추가'}</DialogTitle>
                <DialogDescription>반려동물의 정보를 입력하세요</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* 프로필 사진 */}
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    {form.photo_url ? (
                      <Image
                        src={form.photo_url}
                        alt="Pet photo"
                        width={96}
                        height={96}
                        className="w-24 h-24 rounded-full object-cover border-2 border-muted"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/30">
                        <PawPrint className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="absolute bottom-0 right-0 rounded-full w-8 h-8"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Camera className="w-4 h-4" />
                      )}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">사진을 클릭하여 업로드</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pet_name">이름 *</Label>
                    <Input
                      id="pet_name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="반려동물 이름"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pet_type">종류</Label>
                    <Select
                      value={form.type || ''}
                      onValueChange={(value) => setForm({ ...form, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="종류 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="고양이">고양이</SelectItem>
                        <SelectItem value="강아지">강아지</SelectItem>
                        <SelectItem value="기타">기타</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pet_breed">품종</Label>
                    <Input
                      id="pet_breed"
                      value={form.breed || ''}
                      onChange={(e) => setForm({ ...form, breed: e.target.value })}
                      placeholder="예: 코리안 숏헤어"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pet_birth_date">생년월일</Label>
                    <Input
                      id="pet_birth_date"
                      type="date"
                      value={form.birth_date || ''}
                      onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pet_weight_kg">체중 (kg)</Label>
                    <Input
                      id="pet_weight_kg"
                      type="number"
                      step="0.1"
                      value={form.weight_kg?.toString() || ''}
                      onChange={(e) => setForm({ ...form, weight_kg: e.target.value ? parseFloat(e.target.value) : null })}
                      placeholder="예: 4.5"
                    />
                  </div>
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
      </CardHeader>
      <CardContent>
        {pets.length === 0 ? (
          <div className="text-center py-8">
            <PawPrint className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              등록된 반려동물이 없습니다
            </p>
            <Button variant="outline" onClick={() => setIsDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />
              첫 반려동물 등록하기
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {pets.map((pet) => (
              <div
                key={pet.id}
                className={`p-4 border rounded-lg ${
                  currentPet?.id === pet.id ? 'border-primary bg-primary/5' : ''
                }`}
              >
                {/* 모바일: 세로 스택, 데스크탑: 가로 배열 */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  {/* 상단: 사진 + 정보 */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* 프로필 사진 */}
                    {pet.photo_url ? (
                      <Image
                        src={pet.photo_url}
                        alt={pet.name}
                        width={56}
                        height={56}
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <PawPrint className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
                      </div>
                    )}

                    {/* 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium truncate">{pet.name}</h4>
                        {pet.is_default && (
                          <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded flex-shrink-0">기본</span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground flex flex-wrap gap-x-1">
                        {pet.type && <span>{pet.type}</span>}
                        {pet.breed && <span>· {pet.breed}</span>}
                        {pet.weight_kg && <span>· {pet.weight_kg}kg</span>}
                      </div>
                    </div>
                  </div>

                  {/* 액션 버튼: 모바일에서 우측 정렬 */}
                  <div className="flex gap-1 justify-end sm:flex-shrink-0">
                    {!pet.is_default && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetDefault(pet)}
                        title="기본으로 설정"
                        className="h-9 w-9 p-0"
                      >
                        <StarOff className="w-4 h-4" />
                      </Button>
                    )}
                    {pet.is_default && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled
                        title="기본 반려동물"
                        className="h-9 w-9 p-0"
                      >
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(pet)} className="h-9 w-9 p-0">
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>반려동물 삭제</AlertDialogTitle>
                          <AlertDialogDescription>
                            &quot;{pet.name}&quot;을(를) 삭제하시겠습니까?
                            이 반려동물의 기록은 삭제되지 않습니다.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>취소</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(pet.id)}>삭제</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// 약 프리셋 섹션
function MedicinePresetSection({
  presets,
  setPresets
}: {
  presets: MedicinePreset[]
  setPresets: (p: MedicinePreset[]) => void
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPreset, setEditingPreset] = useState<MedicinePreset | null>(null)
  const [presetName, setPresetName] = useState('')
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null)  // null = 모든 반려동물
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

// 테마 설정 섹션
function ThemeSection({
  settings,
  setSettings,
  saving,
  setSaving
}: {
  settings: UserSettings | null
  setSettings: (s: UserSettings | null) => void
  saving: boolean
  setSaving: (s: boolean) => void
}) {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(settings?.theme || 'system')

  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme)
    setSaving(true)

    // 실제 테마 적용
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else if (newTheme === 'light') {
      document.documentElement.classList.remove('dark')
    } else {
      // system
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: newTheme })
      })
      const data = await res.json()
      if (data.success) {
        setSettings(data.data)
      }
    } catch (error) {
      console.error('Failed to save theme:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="w-5 h-5" />
          테마 설정
        </CardTitle>
        <CardDescription>앱의 외관을 설정하세요</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => handleThemeChange('light')}
            className={`p-4 border rounded-lg flex flex-col items-center gap-2 transition-colors ${
              theme === 'light' ? 'border-primary bg-primary/5' : 'hover:bg-muted'
            }`}
            disabled={saving}
          >
            <Sun className="w-6 h-6" />
            <span className="text-sm">라이트</span>
          </button>
          <button
            onClick={() => handleThemeChange('dark')}
            className={`p-4 border rounded-lg flex flex-col items-center gap-2 transition-colors ${
              theme === 'dark' ? 'border-primary bg-primary/5' : 'hover:bg-muted'
            }`}
            disabled={saving}
          >
            <Moon className="w-6 h-6" />
            <span className="text-sm">다크</span>
          </button>
          <button
            onClick={() => handleThemeChange('system')}
            className={`p-4 border rounded-lg flex flex-col items-center gap-2 transition-colors ${
              theme === 'system' ? 'border-primary bg-primary/5' : 'hover:bg-muted'
            }`}
            disabled={saving}
          >
            <Monitor className="w-6 h-6" />
            <span className="text-sm">시스템</span>
          </button>
        </div>
      </CardContent>
    </Card>
  )
}

// 사용자 커스텀 데이터 상태 인터페이스
interface UserCustomDataStats {
  customItems: number
  customAliases: number
  customMappings: number
  hasCustomData: boolean
}

// 데이터 관리 섹션
function DataManagementSection() {
  const [exporting, setExporting] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // 사용자 커스텀 데이터 초기화 관련 상태
  const [userCustomStats, setUserCustomStats] = useState<UserCustomDataStats | null>(null)
  const [loadingUserStats, setLoadingUserStats] = useState(false)
  const [resettingUserData, setResettingUserData] = useState(false)
  const [userResetDialogOpen, setUserResetDialogOpen] = useState(false)
  const [userResetSuccess, setUserResetSuccess] = useState<boolean | null>(null)

  // 사용자 커스텀 데이터 상태 조회
  const loadUserCustomStats = async () => {
    setLoadingUserStats(true)
    try {
      const res = await fetch('/api/user/reset-master-data')
      const data = await res.json()
      if (data.success) {
        setUserCustomStats(data.data)
      }
    } catch (error) {
      console.error('Failed to load user custom stats:', error)
    } finally {
      setLoadingUserStats(false)
    }
  }

  // 사용자 커스텀 데이터 초기화
  const handleUserDataReset = async () => {
    setResettingUserData(true)
    setUserResetSuccess(null)
    setUserResetDialogOpen(false)
    try {
      const res = await fetch('/api/user/reset-master-data', {
        method: 'POST'
      })
      const data = await res.json()
      setUserResetSuccess(data.success)
      if (data.success) {
        setUserCustomStats({ customItems: 0, customAliases: 0, customMappings: 0, hasCustomData: false })
      }
    } catch (error) {
      console.error('Failed to reset user data:', error)
      setUserResetSuccess(false)
    } finally {
      setResettingUserData(false)
    }
  }

  const handleExport = async (type: 'daily-log' | 'test-results') => {
    setExporting(type)
    try {
      if (type === 'test-results') {
        // 검사결과 Excel 내보내기
        const response = await fetch('/api/export-excel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            options: { format: 'pivot', includeReference: true, includeStatus: true }
          })
        })

        if (!response.ok) throw new Error('Export failed')

        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `mimo-test-results-${new Date().toISOString().split('T')[0]}.xlsx`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      } else {
        // Daily log 내보내기
        const response = await fetch('/api/daily-logs?all=true')
        const data = await response.json()

        if (!data.success) throw new Error('Export failed')

        const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `mimo-daily-logs-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setExporting(null)
    }
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    try {
      const res = await fetch('/api/settings', { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        // 로그아웃 처리
        window.location.href = '/auth/signout'
      }
    } catch (error) {
      console.error('Failed to delete account:', error)
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 내 커스텀 데이터 초기화 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            내 커스텀 데이터 초기화
          </CardTitle>
          <CardDescription>
            직접 추가하거나 수정한 검사항목/별칭을 기본값으로 되돌립니다. 검사 기록은 유지됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 현재 상태 표시 */}
          {userCustomStats ? (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>커스텀 검사항목</span>
                <span className="font-medium">{userCustomStats.customItems}개</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>커스텀 별칭</span>
                <span className="font-medium">{userCustomStats.customAliases}개</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>커스텀 매핑</span>
                <span className="font-medium">{userCustomStats.customMappings}개</span>
              </div>
              {!userCustomStats.hasCustomData && (
                <div className="flex items-center gap-2 text-sm text-green-600 mt-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>커스텀 데이터가 없습니다 (기본값 사용 중)</span>
                </div>
              )}
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={loadUserCustomStats} disabled={loadingUserStats}>
              {loadingUserStats ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Info className="w-4 h-4 mr-2" />
              )}
              현재 상태 확인
            </Button>
          )}

          {/* 초기화 결과 표시 */}
          {userResetSuccess !== null && (
            <div className={`p-4 rounded-lg ${userResetSuccess ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center gap-2">
                {userResetSuccess ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                )}
                <span className="font-medium">
                  {userResetSuccess ? '초기화 완료! 기본값으로 되돌아갔습니다.' : '초기화 실패'}
                </span>
              </div>
            </div>
          )}

          {/* 초기화 버튼 */}
          <AlertDialog open={userResetDialogOpen} onOpenChange={setUserResetDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                disabled={resettingUserData || (userCustomStats !== null && !userCustomStats.hasCustomData)}
                className="w-full"
              >
                {resettingUserData ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                커스텀 데이터 초기화
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  커스텀 데이터 초기화
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>직접 추가하거나 수정한 검사항목, 별칭, 매핑이 모두 삭제됩니다.</p>
                  <p className="text-amber-600">
                    초기화 후에는 기본 마스터 데이터만 사용하게 됩니다.
                  </p>
                  <p>검사 기록(결과값)은 영향받지 않습니다.</p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={handleUserDataReset}>
                  초기화 실행
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <p className="text-xs text-muted-foreground">
            * 이 기능은 내가 직접 추가/수정한 데이터만 삭제합니다. 전역 마스터 데이터에는 영향을 주지 않습니다.
          </p>
        </CardContent>
      </Card>

      {/* 데이터 내보내기 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            데이터 내보내기
          </CardTitle>
          <CardDescription>기록된 데이터를 파일로 내보냅니다</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => handleExport('daily-log')}
            disabled={exporting !== null}
          >
            {exporting === 'daily-log' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            일일 기록 내보내기 (JSON)
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => handleExport('test-results')}
            disabled={exporting !== null}
          >
            {exporting === 'test-results' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            검사 결과 내보내기 (Excel)
          </Button>
        </CardContent>
      </Card>

      {/* 계정 삭제 */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            계정 삭제
          </CardTitle>
          <CardDescription>
            모든 데이터가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                계정 및 모든 데이터 삭제
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>정말 삭제하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                  이 작업은 되돌릴 수 없습니다. 모든 일일 기록, 검사 결과, 설정이 영구적으로 삭제됩니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  삭제
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  )
}
