'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { AppHeader } from '@/components/layout/AppHeader'
import { useToast } from '@/hooks/use-toast'
import { PetFood, PetFoodInput, FoodType, TargetAnimal } from '@/types'
import { Loader2, ShieldCheck, Plus, Pencil, Trash2, Search } from 'lucide-react'

const FOOD_TYPES: FoodType[] = ['건사료', '습식', '기타']
const TARGET_ANIMALS: TargetAnimal[] = ['강아지', '고양이', '공통']

const emptyForm: PetFoodInput = {
  name: '',
  brand: '',
  calorie_density: 0,
  food_type: '건사료',
  target_animal: '공통',
  memo: '',
}

export default function AdminPetFoodsPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [foods, setFoods] = useState<PetFood[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterFoodType, setFilterFoodType] = useState<string>('all')
  const [filterTarget, setFilterTarget] = useState<string>('all')

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingFood, setEditingFood] = useState<PetFood | null>(null)
  const [form, setForm] = useState<PetFoodInput>(emptyForm)
  const [saving, setSaving] = useState(false)

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<PetFood | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Fetch data
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

        const res = await fetch('/api/admin/pet-foods')
        const data = await res.json()
        if (data.success) {
          setFoods(data.data || [])
        }
      } catch (err) {
        console.error('Failed to fetch pet foods:', err)
        setError('사료 목록을 불러오는데 실패했습니다')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Filtered list
  const filteredFoods = foods.filter((food) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (
        !food.name.toLowerCase().includes(q) &&
        !(food.brand || '').toLowerCase().includes(q)
      ) {
        return false
      }
    }
    if (filterFoodType !== 'all' && food.food_type !== filterFoodType) return false
    if (filterTarget !== 'all' && food.target_animal !== filterTarget) return false
    return true
  })

  // Open dialog for add
  const handleAdd = () => {
    setEditingFood(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  // Open dialog for edit
  const handleEdit = (food: PetFood) => {
    setEditingFood(food)
    setForm({
      name: food.name,
      brand: food.brand || '',
      calorie_density: food.calorie_density,
      food_type: food.food_type,
      target_animal: food.target_animal,
      memo: food.memo || '',
    })
    setDialogOpen(true)
  }

  // Save (add or edit)
  const handleSave = async () => {
    if (!form.name?.trim()) {
      toast({ title: '오류', description: '사료명은 필수입니다.', variant: 'destructive' })
      return
    }
    if (!form.calorie_density || form.calorie_density <= 0) {
      toast({ title: '오류', description: '칼로리 밀도는 0보다 커야 합니다.', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      if (editingFood) {
        // PATCH
        const res = await fetch(`/api/admin/pet-foods/${editingFood.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const data = await res.json()
        if (data.success) {
          setFoods(prev => prev.map(f => f.id === editingFood.id ? data.data : f))
          toast({ title: '수정 완료' })
          setDialogOpen(false)
        } else {
          throw new Error(data.error)
        }
      } else {
        // POST
        const res = await fetch('/api/admin/pet-foods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const data = await res.json()
        if (data.success) {
          setFoods(prev => [...prev, data.data])
          toast({ title: '추가 완료' })
          setDialogOpen(false)
        } else {
          throw new Error(data.error)
        }
      }
    } catch (err) {
      toast({
        title: '저장 실패',
        description: err instanceof Error ? err.message : '오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Delete
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/pet-foods/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        setFoods(prev => prev.filter(f => f.id !== deleteTarget.id))
        toast({ title: '삭제 완료' })
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      toast({
        title: '삭제 실패',
        description: err instanceof Error ? err.message : '오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-muted">
        <AppHeader title="사료 데이터베이스" showBack backHref="/admin" />
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-muted">
        <AppHeader title="사료 데이터베이스" showBack backHref="/admin" />
        <div className="container max-w-4xl mx-auto py-10 px-4">
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <ShieldCheck className="w-5 h-5" />
                접근 권한 없음
              </CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/')}>메인으로 돌아가기</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader title="사료 데이터베이스" showBack backHref="/admin" />

      <div className="container max-w-4xl mx-auto py-6 px-4 space-y-4">
        {/* 검색/필터 + 추가 버튼 */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="사료명 또는 브랜드 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterFoodType} onValueChange={setFilterFoodType}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 종류</SelectItem>
              {FOOD_TYPES.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterTarget} onValueChange={setFilterTarget}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 동물</SelectItem>
              {TARGET_ANIMALS.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-1" />
            추가
          </Button>
        </div>

        {/* 목록 */}
        <div className="text-sm text-muted-foreground">
          총 {filteredFoods.length}개
          {searchQuery || filterFoodType !== 'all' || filterTarget !== 'all'
            ? ` (전체 ${foods.length}개 중)`
            : ''}
        </div>

        {filteredFoods.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              {foods.length === 0
                ? '등록된 사료가 없습니다. 상단의 "추가" 버튼을 눌러 사료를 등록해주세요.'
                : '검색 결과가 없습니다.'}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredFoods.map((food) => (
              <Card key={food.id}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">
                        {food.brand && (
                          <span className="text-muted-foreground">{food.brand} </span>
                        )}
                        {food.name}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                        <span className="bg-muted px-1.5 py-0.5 rounded">{food.calorie_density} kcal/g</span>
                        <span className="bg-muted px-1.5 py-0.5 rounded">{food.food_type}</span>
                        {food.target_animal !== '공통' && (
                          <span className="bg-muted px-1.5 py-0.5 rounded">{food.target_animal}</span>
                        )}
                      </div>
                      {food.memo && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{food.memo}</p>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(food)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(food)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 추가/수정 Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingFood ? '사료 수정' : '사료 추가'}</DialogTitle>
            <DialogDescription>
              {editingFood ? '사료 정보를 수정합니다.' : '새 사료를 등록합니다.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>사료명 *</Label>
              <Input
                placeholder="예: 인도어 캣"
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>브랜드</Label>
              <Input
                placeholder="예: 로얄캐닌"
                value={form.brand || ''}
                onChange={(e) => setForm(prev => ({ ...prev, brand: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>칼로리 밀도 (kcal/g) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="예: 3.63"
                value={form.calorie_density || ''}
                onChange={(e) => setForm(prev => ({ ...prev, calorie_density: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>종류</Label>
                <Select
                  value={form.food_type || '건사료'}
                  onValueChange={(val) => setForm(prev => ({ ...prev, food_type: val as FoodType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FOOD_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>대상 동물</Label>
                <Select
                  value={form.target_animal || '공통'}
                  onValueChange={(val) => setForm(prev => ({ ...prev, target_animal: val as TargetAnimal }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TARGET_ANIMALS.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>메모</Label>
              <Textarea
                placeholder="관리자 메모..."
                value={form.memo || ''}
                onChange={(e) => setForm(prev => ({ ...prev, memo: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              {editingFood ? '수정' : '추가'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>사료 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.brand ? `${deleteTarget.brand} ` : ''}{deleteTarget?.name}&quot;을(를) 삭제하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
