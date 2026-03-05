'use client'

import { useEffect, useState, useCallback } from 'react'
import { AppHeader } from '@/components/layout/AppHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'
import type { MedicinePreset, SnackPreset, PetFood, PetFoodNutrient, NutrientUnit, PetFoodInput } from '@/types'

/** Supabase join 응답의 pet_food_nutrients → nutrients 변환 */
function mapPetFoods(raw: Record<string, unknown>[]): PetFood[] {
  return raw.map(f => {
    const pfn = f.pet_food_nutrients as Array<Record<string, unknown>> | undefined
    const nutrients: PetFoodNutrient[] | undefined = pfn?.map(n => ({
      id: n.id as string,
      pet_food_id: n.pet_food_id as string,
      nutrient_name: n.nutrient_name as string,
      value: n.value as number,
      unit_id: n.unit_id as string | null,
      unit_symbol: (n.nutrient_units as { symbol: string } | null)?.symbol ?? undefined,
      sort_order: n.sort_order as number,
      created_at: n.created_at as string,
    }))
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { pet_food_nutrients: _removed, ...rest } = f
    return { ...rest, nutrients } as PetFood
  })
}
import { SnackPresetSection } from '@/components/manage/SnackPresetSection'
import { MedicinePresetSection } from '@/components/manage/MedicinePresetSection'
import { PetFoodSection } from '@/components/manage/PetFoodSection'
import { PetFoodForm } from '@/components/manage/PetFoodForm'

export default function ManagePage() {
  const [loading, setLoading] = useState(true)
  const [medicinePresets, setMedicinePresets] = useState<MedicinePreset[]>([])
  const [snackPresets, setSnackPresets] = useState<SnackPreset[]>([])
  const [petFoods, setPetFoods] = useState<PetFood[]>([])
  const [nutrientUnits, setNutrientUnits] = useState<NutrientUnit[]>([])
  const [foodFormOpen, setFoodFormOpen] = useState(false)
  const [editingFood, setEditingFood] = useState<PetFood | null>(null)
  const [foodSaving, setFoodSaving] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [medicineRes, snackRes, foodRes, unitRes] = await Promise.all([
        fetch('/api/medicine-presets'),
        fetch('/api/snack-presets'),
        fetch('/api/pet-foods?include_nutrients=true'),
        fetch('/api/nutrient-units')
      ])

      const [medicineData, snackData, foodData, unitData] = await Promise.all([
        medicineRes.json(),
        snackRes.json(),
        foodRes.json(),
        unitRes.json()
      ])

      if (medicineData.success) setMedicinePresets(medicineData.data)
      if (snackData.success) setSnackPresets(snackData.data)
      if (foodData.success) setPetFoods(mapPetFoods(foodData.data))
      if (unitData.success) setNutrientUnits(unitData.data)
    } catch (error) {
      console.error('Failed to load manage data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleFoodSave = async (input: PetFoodInput) => {
    setFoodSaving(true)
    try {
      const isEdit = !!editingFood
      const method = isEdit ? 'PATCH' : 'POST'
      const body = isEdit ? { id: editingFood.id, ...input } : input

      const res = await fetch('/api/pet-foods', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (data.success) {
        // Refresh the full list (with nutrients)
        const refreshRes = await fetch('/api/pet-foods?include_nutrients=true')
        const refreshData = await refreshRes.json()
        if (refreshData.success) setPetFoods(mapPetFoods(refreshData.data))
        setFoodFormOpen(false)
        setEditingFood(null)
      }
    } catch (error) {
      console.error('Failed to save pet food:', error)
    } finally {
      setFoodSaving(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) {
    return (
      <div className="min-h-screen bg-muted">
        <AppHeader title="사료/간식/약 관리" />
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
      <AppHeader title="사료/간식/약 관리" />
      <div className="container max-w-4xl mx-auto py-6 px-4">
        <Tabs defaultValue="food" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="food" className="text-xs sm:text-sm">
              🥩 사료/간식 성분
            </TabsTrigger>
            <TabsTrigger value="snack" className="text-xs sm:text-sm">
              🍪 간식 프리셋
            </TabsTrigger>
            <TabsTrigger value="medicine" className="text-xs sm:text-sm">
              💊 약 프리셋
            </TabsTrigger>
          </TabsList>

          <TabsContent value="food">
            <PetFoodSection
              foods={petFoods}
              setFoods={setPetFoods}
              nutrientUnits={nutrientUnits}
              onAddClick={() => { setEditingFood(null); setFoodFormOpen(true) }}
              onEditClick={(food) => { setEditingFood(food); setFoodFormOpen(true) }}
            />
          </TabsContent>

          <TabsContent value="snack">
            <SnackPresetSection
              presets={snackPresets}
              setPresets={setSnackPresets}
            />
          </TabsContent>

          <TabsContent value="medicine">
            <MedicinePresetSection
              presets={medicinePresets}
              setPresets={setMedicinePresets}
            />
          </TabsContent>
        </Tabs>

        <Dialog open={foodFormOpen} onOpenChange={(open) => {
          setFoodFormOpen(open)
          if (!open) setEditingFood(null)
        }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingFood ? '제품 수정' : '새 제품 등록'}</DialogTitle>
              <DialogDescription>
                {editingFood ? '제품 정보를 수정합니다.' : '사료나 간식 정보를 입력하세요. 사진으로 자동 입력도 가능합니다.'}
              </DialogDescription>
            </DialogHeader>
            <PetFoodForm
              food={editingFood}
              nutrientUnits={nutrientUnits}
              onSave={handleFoodSave}
              onCancel={() => { setFoodFormOpen(false); setEditingFood(null) }}
              saving={foodSaving}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
