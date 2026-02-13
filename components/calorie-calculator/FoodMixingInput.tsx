'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X, Plus, Search } from 'lucide-react'
import type { PetFood, FeedingPlanFood, CalorieDensityUnit } from '@/types'

interface FoodMixingInputProps {
  foods: FeedingPlanFood[]
  onChange: (foods: FeedingPlanFood[]) => void
  petFoods: PetFood[]
  foodsLoading: boolean
  petType?: string | null
}

const MAX_FOODS = 5

function createEmptyFood(): FeedingPlanFood {
  return {
    food_id: null,
    name: '',
    brand: null,
    calorie_density: 0,
    calorie_density_input: undefined,
    calorie_density_unit: 'kcal_per_g',
    ratio_percent: 100,
  }
}

export function FoodMixingInput({ foods, onChange, petFoods, foodsLoading, petType }: FoodMixingInputProps) {
  const [searchOpenIndex, setSearchOpenIndex] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [directInputIndex, setDirectInputIndex] = useState<Set<number>>(() => {
    // 초기: 이미 food_id가 없는 항목은 직접 입력 모드
    const set = new Set<number>()
    foods.forEach((f, i) => {
      if (!f.food_id) set.add(i)
    })
    return set
  })

  // pet type에 따라 사료 필터
  const filteredFoods = useMemo(() => {
    if (!petType) return petFoods
    return petFoods.filter(food => {
      if (food.target_animal === '공통') return true
      if (petType === '고양이' && food.target_animal === '고양이') return true
      if (petType === '강아지' && food.target_animal === '강아지') return true
      return false
    })
  }, [petFoods, petType])

  // 검색어 기반 사료 필터
  const searchedFoods = useMemo(() => {
    if (!searchQuery.trim()) return filteredFoods
    const q = searchQuery.toLowerCase()
    return filteredFoods.filter(pf =>
      (pf.brand || '').toLowerCase().includes(q) ||
      pf.name.toLowerCase().includes(q)
    )
  }, [filteredFoods, searchQuery])

  // 드롭다운 열릴 때 검색 입력에 포커스, 외부 클릭 시 닫기
  useEffect(() => {
    if (searchOpenIndex !== null) {
      setSearchQuery('')
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
  }, [searchOpenIndex])

  const handleClickOutside = useCallback((e: MouseEvent | TouchEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
      setSearchOpenIndex(null)
    }
  }, [])

  useEffect(() => {
    if (searchOpenIndex !== null) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('touchstart', handleClickOutside)
      }
    }
  }, [searchOpenIndex, handleClickOutside])

  const totalRatio = foods.reduce((sum, f) => sum + (f.ratio_percent || 0), 0)
  const isRatioValid = Math.abs(totalRatio - 100) < 0.01

  const updateFood = (index: number, updates: Partial<FeedingPlanFood>) => {
    const newFoods = foods.map((f, i) => i === index ? { ...f, ...updates } : f)
    onChange(newFoods)
  }

  const addFood = () => {
    if (foods.length >= MAX_FOODS) return
    const newFood = createEmptyFood()
    newFood.ratio_percent = 0
    const newFoods = [...foods, newFood]
    setDirectInputIndex(prev => new Set(prev).add(foods.length))
    onChange(newFoods)
  }

  const removeFood = (index: number) => {
    if (foods.length <= 1) return
    const newFoods = foods.filter((_, i) => i !== index)
    // 사료 1개만 남으면 비율 100% 고정
    if (newFoods.length === 1) {
      newFoods[0] = { ...newFoods[0], ratio_percent: 100 }
    }
    // directInputIndex 재조정
    const newDirect = new Set<number>()
    let j = 0
    for (let i = 0; i < foods.length; i++) {
      if (i === index) continue
      if (directInputIndex.has(i)) newDirect.add(j)
      j++
    }
    setDirectInputIndex(newDirect)
    // searchQueries 재조정
    const newQueries: Record<number, string> = {}
    j = 0
    for (let i = 0; i < foods.length; i++) {
      if (i === index) continue
      if (searchQueries[i]) newQueries[j] = searchQueries[i]
      j++
    }
    setSearchQueries(newQueries)
    onChange(newFoods)
  }

  const handleFoodSelect = (index: number, foodId: string) => {
    const food = filteredFoods.find(f => f.id === foodId)
    if (!food) return
    updateFood(index, {
      food_id: food.id,
      name: food.name,
      brand: food.brand,
      calorie_density: food.calorie_density,
      calorie_density_input: food.calorie_density,
      calorie_density_unit: 'kcal_per_g',
    })
    setDirectInputIndex(prev => {
      const next = new Set(prev)
      next.delete(index)
      return next
    })
    // 검색어 초기화
    setSearchQueries(prev => {
      const next = { ...prev }
      delete next[index]
      return next
    })
  }

  const switchToDirectInput = (index: number) => {
    setDirectInputIndex(prev => new Set(prev).add(index))
    updateFood(index, { food_id: null, brand: null })
  }

  const switchToSearch = (index: number) => {
    setDirectInputIndex(prev => {
      const next = new Set(prev)
      next.delete(index)
      return next
    })
    // 직접 입력 값은 유지
  }

  const handleCalorieDensityChange = (index: number, inputValue: string, unit: CalorieDensityUnit) => {
    const val = parseFloat(inputValue)
    if (isNaN(val) || val < 0) {
      updateFood(index, {
        calorie_density: 0,
        calorie_density_input: undefined,
        calorie_density_unit: unit,
      })
      return
    }
    const density = unit === 'kcal_per_100g' ? val / 100 : val
    updateFood(index, {
      calorie_density: density,
      calorie_density_input: val,
      calorie_density_unit: unit,
    })
  }

  const handleUnitChange = (index: number, newUnit: CalorieDensityUnit) => {
    const food = foods[index]
    const currentInput = food.calorie_density_input
    if (currentInput === undefined || currentInput === null) {
      updateFood(index, { calorie_density_unit: newUnit })
      return
    }
    // 동일 input 값에 대해 단위 변경에 따라 density 재계산
    const density = newUnit === 'kcal_per_100g' ? currentInput / 100 : currentInput
    updateFood(index, {
      calorie_density: density,
      calorie_density_unit: newUnit,
    })
  }

  // 검색어 기반 사료 필터
  const getFilteredFoodsForIndex = (index: number) => {
    const query = (searchQueries[index] || '').toLowerCase().trim()
    if (!query) return filteredFoods
    return filteredFoods.filter(pf =>
      (pf.brand || '').toLowerCase().includes(query) ||
      pf.name.toLowerCase().includes(query)
    )
  }

  return (
    <div className="space-y-4">
      {foods.map((food, index) => (
        <div key={index} className="border rounded-lg p-3 space-y-3 relative">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              사료 {index + 1}
            </span>
            {foods.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => removeFood(index)}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>

          {/* 사료 선택 / 직접 입력 */}
          {!directInputIndex.has(index) ? (
            <div className="space-y-2">
              <div className="relative" ref={searchOpenIndex === index ? dropdownRef : undefined}>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal text-left"
                  onClick={() => setSearchOpenIndex(searchOpenIndex === index ? null : index)}
                >
                  <span className="truncate">
                    {food.food_id
                      ? `${food.brand ? food.brand + ' ' : ''}${food.name}`
                      : '사료 검색...'}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>

                {searchOpenIndex === index && (
                  <div className="absolute z-50 w-full mt-1 rounded-md border bg-popover text-popover-foreground shadow-md">
                    <div className="flex items-center border-b px-3">
                      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                      <input
                        ref={searchInputRef}
                        placeholder="사료명 또는 브랜드 검색..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                      />
                    </div>
                    <div className="max-h-[200px] overflow-y-auto p-1">
                      {searchedFoods.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                          {foodsLoading ? '불러오는 중...' : '등록된 사료가 없습니다'}
                        </div>
                      ) : (
                        searchedFoods.map((pf) => (
                          <div
                            key={pf.id}
                            value={`${pf.brand || ''} ${pf.name}`}
                            onSelect={() => handleFoodSelect(index, pf)}
                            onPointerDown={(e) => {
                              e.preventDefault()
                              handleFoodSelect(index, pf)
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                food.food_id === pf.id ? 'opacity-100' : 'opacity-0'
                              }`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="truncate">
                                {pf.brand && (
                                  <span className="text-muted-foreground">{pf.brand} </span>
                                )}
                                {pf.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {pf.calorie_density} kcal/g · {pf.food_type}
                                {pf.target_animal !== '공통' && ` · ${pf.target_animal}`}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {food.food_id && (
                <p className="text-xs text-muted-foreground">
                  {food.calorie_density} kcal/g
                </p>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => switchToDirectInput(index)}
              >
                직접 입력하기
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* 사료명 */}
              <Input
                placeholder="사료명"
                value={food.name}
                onChange={(e) => updateFood(index, { name: e.target.value })}
              />

              {/* 칼로리 밀도 + 단위 선택 */}
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="칼로리 밀도"
                  value={food.calorie_density_input ?? ''}
                  onChange={(e) => handleCalorieDensityChange(
                    index,
                    e.target.value,
                    food.calorie_density_unit || 'kcal_per_g'
                  )}
                  className="flex-1"
                />
                <Select
                  value={food.calorie_density_unit || 'kcal_per_g'}
                  onValueChange={(val) => handleUnitChange(index, val as CalorieDensityUnit)}
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kcal_per_g">kcal/g</SelectItem>
                    <SelectItem value="kcal_per_100g">kcal/100g</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {food.calorie_density_unit === 'kcal_per_100g' && food.calorie_density > 0 && (
                <p className="text-xs text-muted-foreground">
                  = {food.calorie_density.toFixed(2)} kcal/g
                </p>
              )}

              {filteredFoods.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => switchToSearch(index)}
                >
                  <Search className="w-3 h-3 mr-1" />
                  사료 검색으로 전환
                </Button>
              )}
            </div>
          )}

          {/* 비율 입력 (사료 2개 이상일 때만 표시) */}
          {foods.length > 1 && (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">비율</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="1"
                value={food.ratio_percent}
                onChange={(e) => updateFood(index, { ratio_percent: parseFloat(e.target.value) || 0 })}
                className="w-20 text-center"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          )}
        </div>
      ))}

      {/* 사료 추가 버튼 */}
      {foods.length < MAX_FOODS && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={addFood}
        >
          <Plus className="w-4 h-4 mr-1" />
          사료 추가
        </Button>
      )}

      {/* 비율 합계 표시 */}
      {foods.length > 1 && (
        <div className={`text-sm text-center py-1 rounded ${
          isRatioValid
            ? 'text-green-600 bg-green-50'
            : 'text-red-600 bg-red-50'
        }`}>
          {isRatioValid
            ? `합계: ${totalRatio}% ✓`
            : `합계: ${totalRatio}% (100%가 되어야 합니다)`}
        </div>
      )}
    </div>
  )
}
