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
import { Loader2, Plus, Trash2, Edit2, Save, Download, Sun, Moon, Monitor, PawPrint, Pill, Palette, Database, AlertTriangle, Camera, Star, StarOff, RefreshCw, CheckCircle, AlertCircle, Info, ArrowRight, KeyRound, Eye, EyeOff, Crown, User, Flame, CalendarDays, FileText, TestTube2, Scale } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { UserSettings, MedicinePreset, Medicine, Pet, PetInput } from '@/types'
import { usePet } from '@/contexts/PetContext'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { GoogleDriveSection } from '@/components/settings/GoogleDriveSection'

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
            <TabsTrigger value="theme" className="text-xs sm:text-sm">
              <Palette className="w-4 h-4 mr-1 hidden sm:inline" />
              테마
            </TabsTrigger>
            <TabsTrigger value="account" className="text-xs sm:text-sm">
              <KeyRound className="w-4 h-4 mr-1 hidden sm:inline" />
              계정
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

          {/* 테마 설정 */}
          <TabsContent value="theme">
            <ThemeSection
              settings={settings}
              setSettings={setSettings}
              saving={saving}
              setSaving={setSaving}
            />
          </TabsContent>

          {/* 계정 관리 */}
          <TabsContent value="account">
            <div className="space-y-6">
              <AccountInfoSection />
              <KakaoLinkSection />
              <PasswordChangeSection />
            </div>
          </TabsContent>

          {/* 데이터 관리 */}
          <TabsContent value="data">
            <div className="space-y-6">
              <GoogleDriveSection />
              <DataManagementSection />
            </div>
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
    is_neutered: false,
    activity_level: 'normal',
    food_calorie_density: null,
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
      is_neutered: false,
      activity_level: 'normal',
      food_calorie_density: null,
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
      is_neutered: pet.is_neutered ?? false,
      activity_level: pet.activity_level || 'normal',
      food_calorie_density: pet.food_calorie_density ?? null,
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
                </div>

                {/* 칼로리 관련 설정 */}
                <div className="border-t pt-4 mt-2">
                  <div className="flex items-center gap-2 mb-3">
                    <Scale className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">칼로리 설정</span>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="is_neutered"
                        checked={form.is_neutered ?? false}
                        onCheckedChange={(checked) => setForm({ ...form, is_neutered: checked === true })}
                      />
                      <Label htmlFor="is_neutered" className="text-sm font-normal">중성화 완료</Label>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="activity_level">활동량</Label>
                      <Select
                        value={form.activity_level || 'normal'}
                        onValueChange={(value) => setForm({ ...form, activity_level: value as 'low' | 'normal' | 'high' })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="활동량 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">낮음</SelectItem>
                          <SelectItem value="normal">보통</SelectItem>
                          <SelectItem value="high">높음</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="food_calorie_density">사료 칼로리 (kcal/g)</Label>
                      <Input
                        id="food_calorie_density"
                        type="number"
                        step="0.01"
                        value={form.food_calorie_density?.toString() || ''}
                        onChange={(e) => setForm({ ...form, food_calorie_density: e.target.value ? parseFloat(e.target.value) : null })}
                        placeholder="예: 3.8"
                      />
                      <p className="text-xs text-muted-foreground">사료 포장지에서 확인하세요</p>
                    </div>
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
  const [isCheckingExport, setIsCheckingExport] = useState(false)
  const [showExportConfirm, setShowExportConfirm] = useState(false)
  const [exportRemaining, setExportRemaining] = useState(0)
  const { toast } = useToast()

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

  const handleExportClick = async () => {
    setIsCheckingExport(true)
    try {
      const res = await fetch('/api/export-excel')
      const data = await res.json()
      const { limit, remaining } = data

      if (limit === -1) {
        executeExport()
        return
      }

      if (remaining <= 0) {
        toast({
          title: '내보내기 제한',
          description: '이번 달 내보내기 횟수를 모두 사용했습니다.',
          variant: 'destructive',
        })
        return
      }

      setExportRemaining(remaining)
      setShowExportConfirm(true)
    } catch (error) {
      console.error('Export check failed:', error)
      toast({ title: '확인 실패', description: '다시 시도해주세요.', variant: 'destructive' })
    } finally {
      setIsCheckingExport(false)
    }
  }

  const executeExport = async () => {
    setExporting('test-results')
    try {
      const response = await fetch('/api/export-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          options: { format: 'pivot', includeReference: true, includeStatus: true }
        })
      })

      if (response.status === 403) {
        const data = await response.json()
        if (data.error === 'TIER_LIMIT_EXCEEDED') {
          toast({
            title: '내보내기 제한',
            description: '이번 달 내보내기 횟수를 모두 사용했습니다.',
            variant: 'destructive',
          })
          return
        }
      }

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

      toast({ title: '내보내기 완료', description: '검사 결과가 다운로드되었습니다.' })
    } catch (error) {
      console.error('Export failed:', error)
      toast({ title: '내보내기 실패', description: '다시 시도해주세요.', variant: 'destructive' })
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

      {/* 혈액검사기록 내보내기 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            혈액검사기록 내보내기
          </CardTitle>
          <CardDescription>혈액검사 기록을 Excel 파일로 내보냅니다</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleExportClick}
            disabled={exporting !== null || isCheckingExport}
          >
            {exporting === 'test-results' || isCheckingExport ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            검사 결과 내보내기 (Excel)
          </Button>

          <AlertDialog open={showExportConfirm} onOpenChange={setShowExportConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>검사 결과 내보내기</AlertDialogTitle>
                <AlertDialogDescription>
                  이번 달 내보내기 횟수가 {exportRemaining}회 남았습니다. 내보내기를 진행하시겠습니까?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={() => executeExport()}>내보내기</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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

// 계정 정보 및 구독 섹션
function AccountInfoSection() {
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [tierData, setTierData] = useState<{
    tier: string
    config: { label: string; daily_ocr_limit: number; daily_log_max_photos: number; daily_description_gen_limit: number }
    usage: {
      ocr_analysis: { used: number; limit: number; remaining: number }
      daily_log_photo: { used: number; limit: number; remaining: number }
      description_generation: { used: number; limit: number; remaining: number }
    }
  } | null>(null)
  const [stats, setStats] = useState<{
    createdAt: string
    petCount: number
    totalDailyLogs: number
    totalTestRecords: number
    streak: number
    lastRecordDate: string | null
  } | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const loadAccountInfo = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setUserEmail(user.email || null)
        }

        const [tierRes, statsRes] = await Promise.all([
          fetch('/api/tier'),
          fetch('/api/account-stats'),
        ])
        const [tierJson, statsJson] = await Promise.all([tierRes.json(), statsRes.json()])

        if (tierJson.success) setTierData(tierJson.data)
        if (statsJson.success) setStats(statsJson.data)
      } catch (error) {
        console.error('Failed to load account info:', error)
      } finally {
        setLoading(false)
      }
    }
    loadAccountInfo()
  }, [])

  const handleUpgrade = () => {
    toast({
      title: '준비 중입니다',
      description: '의견주기를 통해서 궁금한 점은 여쭤보실 수 있습니다.',
    })
  }

  const formatUsage = (used: number, limit: number | undefined) => {
    if (limit === undefined || limit === null) return '-'
    if (limit === 0) return '잠금'
    if (limit === -1) return '무제한'
    return `${used} / ${limit}`
  }

  const tierBadgeStyle = (tier: string) => {
    switch (tier) {
      case 'premium':
        return 'bg-purple-100 text-purple-700 border-purple-200'
      case 'basic':
        return 'bg-blue-100 text-blue-700 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
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
          <User className="w-5 h-5" />
          계정 정보
        </CardTitle>
        <CardDescription>계정 및 구독 정보를 확인하세요</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 기본 정보 */}
        <div className="p-4 bg-muted rounded-lg space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">이메일</span>
            <span className="font-medium">{userEmail || '-'}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">현재 플랜</span>
            <Badge variant="outline" className={tierBadgeStyle(tierData?.tier || 'free')}>
              {tierData?.config?.label || '무료'}
            </Badge>
          </div>
          {stats && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">가입일</span>
              <span className="font-medium">{formatDate(stats.createdAt)}</span>
            </div>
          )}
        </div>

        {/* 활동 통계 */}
        {stats && (
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 border rounded-lg text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <PawPrint className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">반려동물</span>
              </div>
              <p className="text-lg font-semibold">{stats.petCount}</p>
            </div>
            <div className="p-3 border rounded-lg text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Flame className={`w-4 h-4 ${stats.streak > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
                <span className="text-xs text-muted-foreground">연속 기록</span>
              </div>
              <p className="text-lg font-semibold">{stats.streak}<span className="text-sm font-normal text-muted-foreground">일</span></p>
            </div>
            <div className="p-3 border rounded-lg text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">일일 기록</span>
              </div>
              <p className="text-lg font-semibold">{stats.totalDailyLogs.toLocaleString()}<span className="text-sm font-normal text-muted-foreground">건</span></p>
            </div>
            <div className="p-3 border rounded-lg text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <TestTube2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">혈액검사</span>
              </div>
              <p className="text-lg font-semibold">{stats.totalTestRecords}<span className="text-sm font-normal text-muted-foreground">건</span></p>
            </div>
          </div>
        )}

        {/* 마지막 기록 */}
        {stats?.lastRecordDate && (
          <div className="flex items-center justify-between text-sm px-1">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <CalendarDays className="w-3.5 h-3.5" />
              마지막 기록
            </span>
            <span className="font-medium">{formatDate(stats.lastRecordDate)}</span>
          </div>
        )}

        {/* 오늘 사용량 */}
        {tierData && (
          <div className="p-4 border rounded-lg space-y-2">
            <p className="text-sm font-medium mb-2">오늘 사용량</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">OCR 분석</span>
              <span className="font-medium">{formatUsage(tierData.usage.ocr_analysis.used, tierData.usage.ocr_analysis.limit)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">사진 첨부</span>
              <span className="font-medium">
                {tierData.usage.daily_log_photo.limit === -1
                  ? '무제한'
                  : `1회 최대 ${tierData.usage.daily_log_photo.limit}장`}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">AI 설명 생성</span>
              <span className="font-medium">{formatUsage(tierData.usage.description_generation.used, tierData.usage.description_generation.limit)}</span>
            </div>
          </div>
        )}

        {tierData && tierData.tier !== 'premium' && (
          <Button onClick={handleUpgrade} className="w-full" variant="outline">
            <Crown className="w-4 h-4 mr-2" />
            플랜 업그레이드
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

// 카카오 계정 연동 섹션
function KakaoLinkSection() {
  const [isLinked, setIsLinked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [kakaoEmail, setKakaoEmail] = useState<string | null>(null)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    const checkKakaoLink = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setUserEmail(user.email || null)
          const kakaoIdentity = user.identities?.find(
            (identity) => identity.provider === 'kakao'
          )
          setIsLinked(!!kakaoIdentity)
          if (kakaoIdentity?.identity_data?.email) {
            setKakaoEmail(kakaoIdentity.identity_data.email as string)
          }
        }
      } catch (error) {
        console.error('Failed to check Kakao link:', error)
      } finally {
        setLoading(false)
      }
    }
    checkKakaoLink()
  }, [])

  const handleLinkKakao = async () => {
    setActionLoading(true)
    setResult(null)

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.linkIdentity({
        provider: 'kakao',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/settings?tab=account')}`
        }
      })

      if (error) {
        throw error
      }

      // linkIdentity는 URL을 반환하므로 수동으로 리다이렉트해야 함
      if (data?.url) {
        window.location.href = data.url
      }
    } catch (err) {
      console.error('Kakao link error:', err)
      setResult({
        success: false,
        message: err instanceof Error ? err.message : '카카오 연동에 실패했습니다'
      })
      setActionLoading(false)
    }
  }

  const handleUnlinkKakao = async () => {
    setActionLoading(true)
    setResult(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const kakaoIdentity = user?.identities?.find(
        (identity) => identity.provider === 'kakao'
      )

      if (!kakaoIdentity) {
        throw new Error('카카오 연동 정보를 찾을 수 없습니다')
      }

      const { error } = await supabase.auth.unlinkIdentity(kakaoIdentity)

      if (error) {
        throw error
      }

      setIsLinked(false)
      setKakaoEmail(null)
      setResult({ success: true, message: '카카오 연동이 해제되었습니다' })
    } catch (err) {
      console.error('Kakao unlink error:', err)
      setResult({
        success: false,
        message: err instanceof Error ? err.message : '카카오 연동 해제에 실패했습니다'
      })
    } finally {
      setActionLoading(false)
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
          <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
            <path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.76 1.84 5.18 4.6 6.56-.2.72-.74 2.6-.84 3-.14.48.17.47.36.34.15-.1 2.4-1.63 3.36-2.3.5.07 1.01.1 1.52.1 5.52 0 10-3.48 10-7.8S17.52 3 12 3z" fill="#FEE500"/>
          </svg>
          카카오 계정 연동
        </CardTitle>
        <CardDescription>
          카카오 계정을 연동하면 카카오로 간편 로그인할 수 있습니다
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-muted rounded-lg space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>이메일 계정</span>
            <span className="font-medium">{userEmail || '-'}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>카카오 연동</span>
            {isLinked ? (
              <span className="flex items-center gap-1.5 text-green-600 font-medium">
                <CheckCircle className="w-4 h-4" />
                연동됨{kakaoEmail ? ` (${kakaoEmail})` : ''}
              </span>
            ) : (
              <span className="text-muted-foreground">미연동</span>
            )}
          </div>
        </div>

        {result && (
          <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
            result.success
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {result.success ? (
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            {result.message}
          </div>
        )}

        {isLinked ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full" disabled={actionLoading}>
                {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                카카오 연동 해제
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>카카오 연동 해제</AlertDialogTitle>
                <AlertDialogDescription>
                  카카오 연동을 해제하면 카카오로 로그인할 수 없게 됩니다.
                  이메일/비밀번호로는 계속 로그인할 수 있습니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={handleUnlinkKakao}>연동 해제</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button
            className="w-full bg-[#FEE500] hover:bg-[#FDD835] text-[#3C1E1E]"
            onClick={handleLinkKakao}
            disabled={actionLoading}
          >
            {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <svg viewBox="0 0 24 24" className="w-5 h-5 mr-2" aria-hidden="true">
              <path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.76 1.84 5.18 4.6 6.56-.2.72-.74 2.6-.84 3-.14.48.17.47.36.34.15-.1 2.4-1.63 3.36-2.3.5.07 1.01.1 1.52.1 5.52 0 10-3.48 10-7.8S17.52 3 12 3z" fill="#3C1E1E"/>
            </svg>
            카카오 계정 연동하기
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

// 비밀번호 변경 섹션
function PasswordChangeSection() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [hasPassword, setHasPassword] = useState<boolean | null>(null)

  // 이메일/비밀번호 identity 존재 여부 확인
  useEffect(() => {
    const checkIdentity = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const emailIdentity = user.identities?.find(
            (identity) => identity.provider === 'email'
          )
          setHasPassword(!!emailIdentity)
        }
      } catch (error) {
        console.error('Failed to check identity:', error)
        setHasPassword(true) // 에러 시 기본값
      }
    }
    checkIdentity()
  }, [])

  const handleSetPassword = async () => {
    setResult(null)

    if (!newPassword || !confirmPassword) {
      setResult({ success: false, message: '모든 필드를 입력해주세요' })
      return
    }

    if (newPassword.length < 6) {
      setResult({ success: false, message: '비밀번호는 6자 이상이어야 합니다' })
      return
    }

    if (newPassword !== confirmPassword) {
      setResult({ success: false, message: '비밀번호가 일치하지 않습니다' })
      return
    }

    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: newPassword })

      if (error) throw error

      setResult({ success: true, message: '비밀번호가 설정되었습니다. 이제 이메일로도 로그인할 수 있습니다.' })
      setNewPassword('')
      setConfirmPassword('')
      setHasPassword(true)
    } catch (error) {
      console.error('Failed to set password:', error)
      setResult({ success: false, message: error instanceof Error ? error.message : '비밀번호 설정에 실패했습니다' })
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    setResult(null)

    if (!currentPassword || !newPassword || !confirmPassword) {
      setResult({ success: false, message: '모든 필드를 입력해주세요' })
      return
    }

    if (newPassword.length < 6) {
      setResult({ success: false, message: '새 비밀번호는 6자 이상이어야 합니다' })
      return
    }

    if (newPassword !== confirmPassword) {
      setResult({ success: false, message: '새 비밀번호가 일치하지 않습니다' })
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      const data = await res.json()

      if (data.success) {
        setResult({ success: true, message: '비밀번호가 변경되었습니다' })
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        setResult({ success: false, message: data.error || '비밀번호 변경에 실패했습니다' })
      }
    } catch (error) {
      console.error('Failed to change password:', error)
      setResult({ success: false, message: '비밀번호 변경에 실패했습니다' })
    } finally {
      setSaving(false)
    }
  }

  if (hasPassword === null) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  // 카카오로만 가입한 사용자: 비밀번호 최초 설정
  if (!hasPassword) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            비밀번호 설정
          </CardTitle>
          <CardDescription>
            비밀번호를 설정하면 이메일로도 로그인할 수 있습니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>소셜 로그인으로 가입하여 비밀번호가 설정되지 않았습니다. 비밀번호를 설정하면 이메일과 비밀번호로도 로그인할 수 있습니다.</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new_password">비밀번호</Label>
            <div className="relative">
              <Input
                id="new_password"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="비밀번호 입력"
                disabled={saving}
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">최소 6자 이상</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm_password">비밀번호 확인</Label>
            <Input
              id="confirm_password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="비밀번호 다시 입력"
              disabled={saving}
            />
          </div>

          {result && (
            <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
              result.success
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {result.success ? (
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              {result.message}
            </div>
          )}

          <Button
            onClick={handleSetPassword}
            disabled={saving || !newPassword || !confirmPassword}
            className="w-full"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <KeyRound className="w-4 h-4 mr-2" />
            )}
            비밀번호 설정
          </Button>
        </CardContent>
      </Card>
    )
  }

  // 기존 비밀번호가 있는 사용자: 비밀번호 변경
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="w-5 h-5" />
          비밀번호 변경
        </CardTitle>
        <CardDescription>계정 비밀번호를 변경합니다</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="current_password">현재 비밀번호</Label>
          <div className="relative">
            <Input
              id="current_password"
              type={showCurrentPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="현재 비밀번호 입력"
              disabled={saving}
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="new_password">새 비밀번호</Label>
          <div className="relative">
            <Input
              id="new_password"
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="새 비밀번호 입력"
              disabled={saving}
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">최소 6자 이상</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm_password">새 비밀번호 확인</Label>
          <Input
            id="confirm_password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="새 비밀번호 다시 입력"
            disabled={saving}
          />
        </div>

        {result && (
          <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
            result.success
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {result.success ? (
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            {result.message}
          </div>
        )}

        <Button
          onClick={handleChangePassword}
          disabled={saving || !currentPassword || !newPassword || !confirmPassword}
          className="w-full"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <KeyRound className="w-4 h-4 mr-2" />
          )}
          비밀번호 변경
        </Button>
      </CardContent>
    </Card>
  )
}
