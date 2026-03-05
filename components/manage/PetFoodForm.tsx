'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Camera, ChevronDown, ChevronUp, Loader2, Plus, Save, X } from 'lucide-react'
import { usePet } from '@/contexts/PetContext'
import type {
  PetFood,
  PetFoodInput,
  PetFoodNutrientInput,
  PetFoodOcrResult,
  NutrientUnit,
  FoodCategory,
  TargetAnimal,
} from '@/types'

const FOOD_CATEGORIES: FoodCategory[] = ['건사료', '습식', '생식', '간식', '보충제/영양제']
const TARGET_ANIMALS: TargetAnimal[] = ['강아지', '고양이', '공통']

interface PetFoodFormProps {
  food?: PetFood | null
  nutrientUnits: NutrientUnit[]
  onSave: (input: PetFoodInput) => Promise<void>
  onCancel: () => void
  saving: boolean
}

export function PetFoodForm({ food, nutrientUnits, onSave, onCancel, saving }: PetFoodFormProps) {
  const { pets } = usePet()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isEditMode = !!food

  // Form state
  const [brand, setBrand] = useState(food?.brand || '')
  const [name, setName] = useState(food?.name || '')
  const [foodCategory, setFoodCategory] = useState<FoodCategory>(food?.food_category || '건사료')
  const [targetAnimal, setTargetAnimal] = useState<TargetAnimal>(food?.target_animal || '공통')
  const [petId, setPetId] = useState<string | null>(food?.pet_id || null)
  const [isActive, setIsActive] = useState(food?.is_active ?? true)
  const [calorieDensity, setCalorieDensity] = useState(food?.calorie_density?.toString() || '')
  const [ingredientsText, setIngredientsText] = useState(food?.ingredients_text || '')
  const [memo, setMemo] = useState(food?.memo || '')
  const [nutrients, setNutrients] = useState<PetFoodNutrientInput[]>(
    food?.nutrients?.map(n => ({
      nutrient_name: n.nutrient_name,
      value: n.value,
      unit_symbol: n.unit_symbol || '%',
      sort_order: n.sort_order,
    })) || []
  )

  // OCR state
  const [ocrExpanded, setOcrExpanded] = useState(false)
  const [ocrFiles, setOcrFiles] = useState<File[]>([])
  const [ocrPreviews, setOcrPreviews] = useState<string[]>([])
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrError, setOcrError] = useState<string | null>(null)

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      ocrPreviews.forEach(url => URL.revokeObjectURL(url))
    }
  }, [ocrPreviews])

  // --- OCR ---

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    // Revoke old previews
    ocrPreviews.forEach(url => URL.revokeObjectURL(url))

    setOcrFiles(files)
    setOcrPreviews(files.map(f => URL.createObjectURL(f)))
    setOcrError(null)
  }

  const removeOcrFile = (index: number) => {
    URL.revokeObjectURL(ocrPreviews[index])
    setOcrFiles(prev => prev.filter((_, i) => i !== index))
    setOcrPreviews(prev => prev.filter((_, i) => i !== index))
  }

  const handleOcr = async () => {
    if (ocrFiles.length === 0) return

    setOcrLoading(true)
    setOcrError(null)

    try {
      // Convert files to base64 (API expects { files: [{ data, type, name }] })
      const files = await Promise.all(
        ocrFiles.map(file =>
          new Promise<{ data: string; type: string; name: string }>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
              const dataUrl = reader.result as string
              const data = dataUrl.split(',')[1]
              const type = file.type || 'image/jpeg'
              resolve({ data, type, name: file.name })
            }
            reader.onerror = reject
            reader.readAsDataURL(file)
          })
        )
      )

      const res = await fetch('/api/pet-foods/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'OCR 처리에 실패했습니다')
      }

      const result: PetFoodOcrResult = data.data

      // Fill form fields — don't overwrite fields user already filled
      if (result.brand && !brand.trim()) setBrand(result.brand)
      if (result.name && !name.trim()) setName(result.name)
      if (result.food_category) setFoodCategory(result.food_category)
      if (result.target_animal) setTargetAnimal(result.target_animal)
      if (result.ingredients_text && !ingredientsText.trim()) setIngredientsText(result.ingredients_text)
      if (result.calorie_density != null && !calorieDensity.trim()) {
        setCalorieDensity(result.calorie_density.toString())
      }
      if (result.nutrients && result.nutrients.length > 0 && nutrients.length === 0) {
        setNutrients(result.nutrients)
      }

      // Collapse OCR section after success
      setOcrExpanded(false)
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : 'OCR 처리 중 오류가 발생했습니다')
    } finally {
      setOcrLoading(false)
    }
  }

  // --- Nutrients ---

  const addNutrientRow = () => {
    setNutrients(prev => [
      ...prev,
      {
        nutrient_name: '',
        value: 0,
        unit_symbol: nutrientUnits[0]?.symbol || '%',
        sort_order: prev.length,
      },
    ])
  }

  const updateNutrient = (index: number, field: keyof PetFoodNutrientInput, val: string | number) => {
    setNutrients(prev =>
      prev.map((n, i) => (i === index ? { ...n, [field]: val } : n))
    )
  }

  const removeNutrient = (index: number) => {
    setNutrients(prev => prev.filter((_, i) => i !== index))
  }

  // --- Save ---

  const handleSave = () => {
    if (!name.trim()) return

    const input: PetFoodInput = {
      name: name.trim(),
      brand: brand.trim() || null,
      calorie_density: calorieDensity ? parseFloat(calorieDensity) : null,
      food_category: foodCategory,
      target_animal: targetAnimal,
      pet_id: petId,
      ingredients_text: ingredientsText.trim() || null,
      is_active: isActive,
      memo: memo.trim() || null,
      nutrients: nutrients
        .filter(n => n.nutrient_name.trim())
        .map((n, i) => ({ ...n, nutrient_name: n.nutrient_name.trim(), sort_order: i })),
    }

    onSave(input)
  }

  return (
    <div className="space-y-5">
      {/* 1. OCR Section — hide in edit mode */}
      {!isEditMode && (
        <Collapsible open={ocrExpanded} onOpenChange={setOcrExpanded}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center justify-between w-full px-3 py-2 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors text-sm"
            >
              <span className="flex items-center gap-2 font-medium">
                <Camera className="w-4 h-4" />
                사진으로 자동 입력
              </span>
              {ocrExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="border rounded-lg p-4 space-y-3 bg-muted/10">
              <p className="text-xs text-muted-foreground">
                앞면(브랜드/제품명)과 뒷면(성분표)을 각각 찍으면 더 정확합니다
              </p>

              {/* File input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                사진 선택
              </Button>

              {/* File previews */}
              {ocrPreviews.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {ocrPreviews.map((url, i) => (
                    <div key={i} className="relative w-20 h-20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`선택된 사진 ${i + 1}`}
                        className="w-full h-full object-cover rounded-md border"
                      />
                      <button
                        type="button"
                        onClick={() => removeOcrFile(i)}
                        className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* OCR error */}
              {ocrError && (
                <p className="text-xs text-destructive">{ocrError}</p>
              )}

              {/* Analyze button */}
              <Button
                type="button"
                size="sm"
                className="w-full"
                disabled={ocrFiles.length === 0 || ocrLoading}
                onClick={handleOcr}
              >
                {ocrLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    분석 중...
                  </>
                ) : (
                  '분석하기'
                )}
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* 2. Basic Info */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="pf_brand">브랜드</Label>
          <Input
            id="pf_brand"
            placeholder="예: 로얄캐닌"
            value={brand}
            onChange={e => setBrand(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pf_name">제품명 *</Label>
          <Input
            id="pf_name"
            placeholder="예: 인도어 캣"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>분류</Label>
            <Select value={foodCategory} onValueChange={val => setFoodCategory(val as FoodCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FOOD_CATEGORIES.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>대상</Label>
            <Select value={targetAnimal} onValueChange={val => setTargetAnimal(val as TargetAnimal)}>
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

        <div className="space-y-1.5">
          <Label>반려동물</Label>
          <Select
            value={petId || 'all'}
            onValueChange={val => setPetId(val === 'all' ? null : val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="반려동물 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              {pets.map(pet => (
                <SelectItem key={pet.id} value={pet.id}>{pet.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="pf_is_active"
            checked={isActive}
            onChange={e => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <Label htmlFor="pf_is_active" className="cursor-pointer text-sm font-normal">
            급여 중
          </Label>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pf_calorie">칼로리 (kcal/g, 선택)</Label>
          <Input
            id="pf_calorie"
            type="number"
            step="0.01"
            min="0"
            placeholder="예: 3.63"
            value={calorieDensity}
            onChange={e => setCalorieDensity(e.target.value)}
          />
        </div>
      </div>

      {/* 3. Nutrients */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">영양성분</Label>
        {nutrients.length > 0 && (
          <div className="space-y-2">
            {nutrients.map((n, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  placeholder="성분명"
                  value={n.nutrient_name}
                  onChange={e => updateNutrient(i, 'nutrient_name', e.target.value)}
                  className="flex-1 min-w-0"
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="수치"
                  value={n.value || ''}
                  onChange={e => updateNutrient(i, 'value', parseFloat(e.target.value) || 0)}
                  className="w-20"
                />
                <Select
                  value={n.unit_symbol}
                  onValueChange={val => updateNutrient(i, 'unit_symbol', val)}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {nutrientUnits.map(u => (
                      <SelectItem key={u.id} value={u.symbol}>{u.symbol}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 shrink-0"
                  onClick={() => removeNutrient(i)}
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <Button type="button" variant="outline" size="sm" onClick={addNutrientRow}>
          <Plus className="w-3.5 h-3.5 mr-1" />
          항목 추가
        </Button>
      </div>

      {/* 4. Ingredients */}
      <div className="space-y-1.5">
        <Label htmlFor="pf_ingredients">원재료</Label>
        <Textarea
          id="pf_ingredients"
          placeholder="원재료 목록을 입력하세요"
          value={ingredientsText}
          onChange={e => setIngredientsText(e.target.value)}
          rows={3}
        />
      </div>

      {/* 5. Memo */}
      <div className="space-y-1.5">
        <Label htmlFor="pf_memo">메모 (선택)</Label>
        <Textarea
          id="pf_memo"
          placeholder="관리용 메모"
          value={memo}
          onChange={e => setMemo(e.target.value)}
          rows={2}
        />
      </div>

      {/* 6. Action Buttons */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving || !name.trim()}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin mr-1" />
          ) : (
            <Save className="w-4 h-4 mr-1" />
          )}
          저장
        </Button>
      </div>
    </div>
  )
}
