'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useToast } from '@/hooks/use-toast'
import { usePet } from '@/contexts/PetContext'
import { calculateRER, getActivityFactor } from '@/lib/calorie'
import { PetFood, Pet } from '@/types'
import { Loader2, ChevronsUpDown, Check, Save, Calculator, Weight, Search, Utensils } from 'lucide-react'

type ActivityLevel = 'low' | 'normal' | 'high'

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  low: '낮음',
  normal: '보통',
  high: '높음',
}

export default function CalorieCalculatorPage() {
  const { currentPet, updatePet } = usePet()
  const { toast } = useToast()

  // Form state
  const [weightKg, setWeightKg] = useState<string>('')
  const [weightSource, setWeightSource] = useState<string>('')
  const [calorieDensity, setCalorieDensity] = useState<string>('')
  const [isNeutered, setIsNeutered] = useState(false)
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('normal')
  const [frequency, setFrequency] = useState(2)

  // Food search state
  const [petFoods, setPetFoods] = useState<PetFood[]>([])
  const [foodsLoading, setFoodsLoading] = useState(false)
  const [selectedFood, setSelectedFood] = useState<PetFood | null>(null)
  const [foodSearchOpen, setFoodSearchOpen] = useState(false)
  const [useDirectInput, setUseDirectInput] = useState(false)

  // Weight loading state
  const [weightLoading, setWeightLoading] = useState(false)

  // Save state
  const [saving, setSaving] = useState(false)

  // Initialize form from currentPet
  useEffect(() => {
    if (!currentPet) return

    setIsNeutered(currentPet.is_neutered ?? false)
    setActivityLevel(currentPet.activity_level || 'normal')

    if (currentPet.weight_kg) {
      setWeightKg(String(currentPet.weight_kg))
      setWeightSource('프로필')
    } else {
      setWeightKg('')
      setWeightSource('')
    }

    if (currentPet.food_calorie_density) {
      setCalorieDensity(String(currentPet.food_calorie_density))
    } else {
      setCalorieDensity('')
    }

    setSelectedFood(null)
    setUseDirectInput(!currentPet.food_calorie_density ? false : true)
  }, [currentPet?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch pet foods
  useEffect(() => {
    const fetchFoods = async () => {
      setFoodsLoading(true)
      try {
        const res = await fetch('/api/pet-foods')
        const data = await res.json()
        if (data.success) {
          setPetFoods(data.data || [])
        }
      } catch (err) {
        console.error('Failed to fetch pet foods:', err)
      } finally {
        setFoodsLoading(false)
      }
    }
    fetchFoods()
  }, [])

  // Load latest weight from daily logs
  const loadLatestWeight = useCallback(async () => {
    if (!currentPet) return
    setWeightLoading(true)
    try {
      const res = await fetch(`/api/daily-logs?pet_id=${currentPet.id}&category=weight&limit=1`)
      const data = await res.json()
      if (data.success && data.data?.length > 0) {
        const log = data.data[0]
        setWeightKg(String(log.amount))
        const date = new Date(log.logged_at)
        setWeightSource(`${date.getMonth() + 1}/${date.getDate()} 기록`)
      } else {
        toast({ title: '체중 기록 없음', description: '일일 기록에 체중 데이터가 없습니다.' })
      }
    } catch {
      toast({ title: '오류', description: '체중 정보를 불러오지 못했습니다.', variant: 'destructive' })
    } finally {
      setWeightLoading(false)
    }
  }, [currentPet, toast])

  // Filter foods by pet type
  const filteredFoods = useMemo(() => {
    if (!currentPet?.type) return petFoods

    const petType = currentPet.type
    return petFoods.filter(food => {
      if (food.target_animal === '공통') return true
      if (petType === '고양이' && food.target_animal === '고양이') return true
      if (petType === '강아지' && food.target_animal === '강아지') return true
      return false
    })
  }, [petFoods, currentPet?.type])

  // Calculation
  const calculation = useMemo(() => {
    const weight = parseFloat(weightKg)
    const density = parseFloat(calorieDensity)

    if (!weight || weight <= 0) return null

    const rer = calculateRER(weight)
    const fakePet = { is_neutered: isNeutered, activity_level: activityLevel } as Pet
    const factor = getActivityFactor(fakePet)
    const der = Math.round(rer * factor)

    if (!density || density <= 0) {
      return { rer, factor, der, dailyGrams: null, perMealGrams: null }
    }

    const dailyGrams = Math.round(der / density)
    const perMealGrams = Math.round(dailyGrams / frequency)

    return { rer, factor, der, dailyGrams, perMealGrams }
  }, [weightKg, calorieDensity, isNeutered, activityLevel, frequency])

  // Handle food selection
  const handleFoodSelect = (food: PetFood) => {
    setSelectedFood(food)
    setCalorieDensity(String(food.calorie_density))
    setFoodSearchOpen(false)
    setUseDirectInput(false)
  }

  // Switch to direct input
  const handleDirectInput = () => {
    setUseDirectInput(true)
    setSelectedFood(null)
  }

  // Save to pet profile
  const handleSave = async () => {
    if (!currentPet || !calculation) return

    setSaving(true)
    try {
      const weight = parseFloat(weightKg)
      const density = parseFloat(calorieDensity)

      const updateBody: Record<string, unknown> = {
        id: currentPet.id,
        is_neutered: isNeutered,
        activity_level: activityLevel,
      }

      if (weight > 0) {
        updateBody.weight_kg = weight
      }

      if (density > 0) {
        updateBody.food_calorie_density = density
      }

      const res = await fetch('/api/pets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody),
      })

      const data = await res.json()

      if (data.success) {
        updatePet(data.data)
        toast({ title: '저장 완료', description: '반려동물 정보가 업데이트되었습니다.' })
      } else {
        throw new Error(data.error)
      }
    } catch {
      toast({ title: '저장 실패', description: '정보를 저장하지 못했습니다.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (!currentPet) {
    return (
      <div className="min-h-screen bg-muted">
        <AppHeader title="사료량 계산기" />
        <div className="container max-w-lg mx-auto py-10 px-4 text-center text-muted-foreground">
          반려동물을 먼저 등록해주세요.
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader title="사료량 계산기" />

      <div className="container max-w-lg mx-auto py-6 px-4 space-y-4">
        {/* 체중 섹션 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Weight className="w-4 h-4" />
              체중
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadLatestWeight}
                disabled={weightLoading}
              >
                {weightLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                최근 기록 불러오기
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.1"
                min="0"
                placeholder="체중 (kg)"
                value={weightKg}
                onChange={(e) => {
                  setWeightKg(e.target.value)
                  setWeightSource('직접 입력')
                }}
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">kg</span>
            </div>
            {weightSource && weightKg && (
              <p className="text-xs text-muted-foreground">
                {weightKg} kg ({weightSource})
              </p>
            )}
          </CardContent>
        </Card>

        {/* 사료 열량 섹션 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Utensils className="w-4 h-4" />
              사료 열량
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* 사료 검색 Combobox */}
            {!useDirectInput && (
              <div className="space-y-2">
                <Popover open={foodSearchOpen} onOpenChange={setFoodSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={foodSearchOpen}
                      className="w-full justify-between font-normal"
                    >
                      {selectedFood
                        ? `${selectedFood.brand ? selectedFood.brand + ' ' : ''}${selectedFood.name}`
                        : '사료 검색...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="사료명 또는 브랜드 검색..." />
                      <CommandList>
                        <CommandEmpty>
                          {foodsLoading ? '불러오는 중...' : '등록된 사료가 없습니다'}
                        </CommandEmpty>
                        <CommandGroup>
                          {filteredFoods.map((food) => (
                            <CommandItem
                              key={food.id}
                              value={`${food.brand || ''} ${food.name}`}
                              onSelect={() => handleFoodSelect(food)}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${
                                  selectedFood?.id === food.id ? 'opacity-100' : 'opacity-0'
                                }`}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="truncate">
                                  {food.brand && (
                                    <span className="text-muted-foreground">{food.brand} </span>
                                  )}
                                  {food.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {food.calorie_density} kcal/g · {food.food_type}
                                  {food.target_animal !== '공통' && ` · ${food.target_animal}`}
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {selectedFood && (
                  <p className="text-xs text-muted-foreground">
                    {selectedFood.calorie_density} kcal/g · {selectedFood.food_type}
                  </p>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={handleDirectInput}
                >
                  직접 입력하기
                </Button>
              </div>
            )}

            {/* 직접 입력 모드 */}
            {useDirectInput && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="칼로리 밀도 (kcal/g)"
                    value={calorieDensity}
                    onChange={(e) => setCalorieDensity(e.target.value)}
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">kcal/g</span>
                </div>
                {filteredFoods.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setUseDirectInput(false)
                      if (!selectedFood) setCalorieDensity('')
                    }}
                  >
                    <Search className="w-3 h-3 mr-1" />
                    사료 검색으로 전환
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 반려동물 정보 섹션 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">반려동물 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="neutered"
                checked={isNeutered}
                onCheckedChange={(checked) => setIsNeutered(checked === true)}
              />
              <Label htmlFor="neutered" className="text-sm cursor-pointer">중성화</Label>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">활동량</Label>
              <div className="flex gap-2">
                {(['low', 'normal', 'high'] as ActivityLevel[]).map((level) => (
                  <Button
                    key={level}
                    variant={activityLevel === level ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => setActivityLevel(level)}
                  >
                    {ACTIVITY_LABELS[level]}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 계산 결과 */}
        {calculation && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calculator className="w-4 h-4" />
                계산 결과
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">RER (기초 에너지)</span>
                  <span>{Math.round(calculation.rer)} kcal</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">활동 계수</span>
                  <span>&times;{calculation.factor.toFixed(2)}</span>
                </div>
                <hr />
                <div className="flex justify-between font-semibold text-base">
                  <span>일일 권장 칼로리</span>
                  <span className="text-primary">{calculation.der} kcal</span>
                </div>

                {calculation.dailyGrams != null && (
                  <>
                    <div className="flex justify-between font-semibold text-base">
                      <span>일일 사료량</span>
                      <span className="text-primary">{calculation.dailyGrams}g</span>
                    </div>

                    {/* 급여 횟수 */}
                    <div className="pt-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">급여 횟수</Label>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4].map((n) => (
                            <Button
                              key={n}
                              variant={frequency === n ? 'default' : 'outline'}
                              size="sm"
                              className="w-9 h-8"
                              onClick={() => setFrequency(n)}
                            >
                              {n}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div className="flex justify-between font-semibold text-base">
                        <span>1회 급여량</span>
                        <span className="text-primary">{calculation.perMealGrams}g</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* 적용 버튼 */}
              <Button
                className="w-full"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                적용하기
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                체중, 사료 열량, 중성화, 활동량을 프로필에 저장합니다
              </p>
            </CardContent>
          </Card>
        )}

        {/* 입력 안내 */}
        {!calculation && (
          <div className="text-center text-sm text-muted-foreground py-4">
            체중을 입력하면 계산 결과가 표시됩니다
          </div>
        )}
      </div>
    </div>
  )
}
