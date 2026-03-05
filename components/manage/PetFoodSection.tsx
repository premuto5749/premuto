'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Plus, Trash2, Edit2, ShieldCheck } from 'lucide-react'
import type { PetFood, NutrientUnit } from '@/types'

const FOOD_CATEGORIES = [
  { value: 'all', label: '전체' },
  { value: '건사료', label: '건사료' },
  { value: '습식', label: '습식' },
  { value: '생식', label: '생식' },
  { value: '간식', label: '간식' },
  { value: '보충제/영양제', label: '보충제/영양제' },
] as const

interface PetFoodSectionProps {
  foods: PetFood[]
  setFoods: (foods: PetFood[]) => void
  nutrientUnits: NutrientUnit[]
  onAddClick: () => void
  onEditClick: (food: PetFood) => void
}

export function PetFoodSection({
  foods,
  setFoods,
  nutrientUnits,
  onAddClick,
  onEditClick,
}: PetFoodSectionProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [detailFood, setDetailFood] = useState<PetFood | null>(null)

  const filteredFoods = categoryFilter === 'all'
    ? foods
    : foods.filter(f => f.food_category === categoryFilter)

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/pet-foods?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setFoods(foods.filter(f => f.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete pet food:', error)
    }
  }

  const getUnitSymbol = (unitId: string | null) => {
    if (!unitId) return '%'
    const unit = nutrientUnits.find(u => u.id === unitId)
    return unit?.symbol ?? '%'
  }

  const getNutrientPreview = (food: PetFood) => {
    if (!food.nutrients || food.nutrients.length === 0) return null
    const sorted = [...food.nutrients].sort((a, b) => a.sort_order - b.sort_order)
    const top3 = sorted.slice(0, 3)
    return top3.map(n => `${n.nutrient_name} ${n.value}${n.unit_symbol ?? getUnitSymbol(n.unit_id)}`).join(' · ')
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span className="text-xl">🍚</span>
              사료 관리
            </CardTitle>
            <CardDescription>급여 중인 사료와 영양 성분을 관리하세요</CardDescription>
          </div>
          <Button size="sm" onClick={onAddClick}>
            <Plus className="w-4 h-4 mr-1" />
            추가
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Category filter chips */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {FOOD_CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setCategoryFilter(cat.value)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                categoryFilter === cat.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:bg-muted'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Food list */}
        {filteredFoods.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {categoryFilter === 'all' ? '등록된 사료가 없습니다' : `${categoryFilter} 카테고리에 등록된 제품이 없습니다`}
          </p>
        ) : (
          <div className="space-y-3">
            {filteredFoods.map(food => {
              const nutrientPreview = getNutrientPreview(food)
              const isUserOwned = food.user_id !== null

              return (
                <div
                  key={food.id}
                  className="p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setDetailFood(food)}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex-1 min-w-0">
                      {food.brand && (
                        <p className="text-xs text-muted-foreground truncate">{food.brand}</p>
                      )}
                      <h4 className="font-medium text-sm leading-tight">{food.name}</h4>
                    </div>
                    {isUserOwned && (
                      <div className="flex gap-1 ml-2 shrink-0" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEditClick(food)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>사료 삭제</AlertDialogTitle>
                              <AlertDialogDescription>
                                &quot;{food.name}&quot;을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>취소</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(food.id)}>삭제</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>

                  {/* Badges row */}
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{food.food_category}</span>
                    {food.target_animal !== '공통' && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                        {food.target_animal}
                      </span>
                    )}
                    {food.is_active ? (
                      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">급여 중</span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">과거 제품</span>
                    )}
                    {!isUserOwned && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5">
                        <ShieldCheck className="w-3 h-3" />
                        관리자 등록
                      </span>
                    )}
                  </div>

                  {/* Nutrient preview */}
                  {nutrientPreview && (
                    <p className="text-xs text-muted-foreground truncate">{nutrientPreview}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Detail dialog */}
        <Dialog open={!!detailFood} onOpenChange={open => { if (!open) setDetailFood(null) }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            {detailFood && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-base">
                    {detailFood.brand && (
                      <span className="text-sm text-muted-foreground font-normal block mb-0.5">
                        {detailFood.brand}
                      </span>
                    )}
                    {detailFood.name}
                  </DialogTitle>
                </DialogHeader>

                {/* Info badges */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{detailFood.food_category}</span>
                  {detailFood.target_animal !== '공통' && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                      {detailFood.target_animal}
                    </span>
                  )}
                  {detailFood.is_active ? (
                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">급여 중</span>
                  ) : (
                    <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">과거 제품</span>
                  )}
                  {detailFood.user_id === null && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5">
                      <ShieldCheck className="w-3 h-3" />
                      관리자 등록
                    </span>
                  )}
                </div>

                {/* Calorie density */}
                {detailFood.calorie_density > 0 && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">칼로리:</span>{' '}
                    <span className="font-medium">{detailFood.calorie_density} kcal/g</span>
                  </div>
                )}

                {/* Memo */}
                {detailFood.memo && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">메모:</span> {detailFood.memo}
                  </div>
                )}

                {/* Nutrients table */}
                {detailFood.nutrients && detailFood.nutrients.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">영양 성분</h4>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="text-left px-3 py-1.5 font-medium">성분</th>
                            <th className="text-right px-3 py-1.5 font-medium">함량</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...detailFood.nutrients]
                            .sort((a, b) => a.sort_order - b.sort_order)
                            .map(n => (
                              <tr key={n.id} className="border-t">
                                <td className="px-3 py-1.5">{n.nutrient_name}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">
                                  {n.value}{n.unit_symbol ?? getUnitSymbol(n.unit_id)}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Ingredients */}
                {detailFood.ingredients_text && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">원재료</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {detailFood.ingredients_text}
                    </p>
                  </div>
                )}

                {/* Photo URLs */}
                {detailFood.photo_urls && detailFood.photo_urls.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">사진</h4>
                    <p className="text-sm text-muted-foreground">
                      원본 사진 {detailFood.photo_urls.length}장
                    </p>
                  </div>
                )}

                {/* Close button */}
                <div className="flex justify-end pt-2">
                  <Button variant="outline" size="sm" onClick={() => setDetailFood(null)}>
                    닫기
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
