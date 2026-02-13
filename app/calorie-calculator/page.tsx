'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { FoodMixingInput } from '@/components/calorie-calculator/FoodMixingInput'
import { FeedingPlanHistory } from '@/components/calorie-calculator/FeedingPlanHistory'
import { useToast } from '@/hooks/use-toast'
import { usePet } from '@/contexts/PetContext'
import { calculateRER, getActivityFactor, calculateMixedCalorieDensity } from '@/lib/calorie'
import type { PetFood, Pet, FeedingPlan, FeedingPlanFood } from '@/types'
import { Loader2, Save, Calculator, Weight } from 'lucide-react'

type ActivityLevel = 'low' | 'normal' | 'high'

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  low: '낮음',
  normal: '보통',
  high: '높음',
}

function createDefaultFood(): FeedingPlanFood {
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

export default function CalorieCalculatorPage() {
  const { currentPet, updatePet } = usePet()
  const { toast } = useToast()

  // Form state
  const [weightKg, setWeightKg] = useState<string>('')
  const [weightSource, setWeightSource] = useState<string>('')
  const [isNeutered, setIsNeutered] = useState(false)
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('normal')
  const [frequency, setFrequency] = useState(2)
  const [foods, setFoods] = useState<FeedingPlanFood[]>([createDefaultFood()])
  const [foodInputKey, setFoodInputKey] = useState(0)

  // Pet foods DB
  const [petFoods, setPetFoods] = useState<PetFood[]>([])
  const [foodsLoading, setFoodsLoading] = useState(false)

  // Weight loading state
  const [weightLoading, setWeightLoading] = useState(false)

  // Save state
  const [saving, setSaving] = useState(false)

  // History
  const [plans, setPlans] = useState<FeedingPlan[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Initialize form from currentPet + active plan
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

    // Load active plan for today
    loadActivePlan(currentPet.id)
  }, [currentPet?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch pet foods DB
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

  // Fetch history
  const fetchHistory = useCallback(async () => {
    if (!currentPet) return
    setHistoryLoading(true)
    try {
      const res = await fetch(`/api/feeding-plans?pet_id=${currentPet.id}&history=true`)
      const data = await res.json()
      if (data.success) {
        setPlans(data.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch feeding plans:', err)
    } finally {
      setHistoryLoading(false)
    }
  }, [currentPet?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // Load active plan and restore form
  const loadActivePlan = async (petId: string) => {
    try {
      const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
      const res = await fetch(`/api/feeding-plans?pet_id=${petId}&date=${today}`)
      const data = await res.json()
      if (data.success && data.data) {
        restoreFromPlan(data.data)
      } else {
        // No active plan - use pet profile fallback
        if (currentPet?.food_calorie_density) {
          setFoods([{
            food_id: null,
            name: '',
            brand: null,
            calorie_density: currentPet.food_calorie_density,
            calorie_density_input: currentPet.food_calorie_density,
            calorie_density_unit: 'kcal_per_g',
            ratio_percent: 100,
          }])
        } else {
          setFoods([createDefaultFood()])
        }
        setFoodInputKey(prev => prev + 1)
      }
    } catch {
      // Fallback
      setFoods([createDefaultFood()])
      setFoodInputKey(prev => prev + 1)
    }
  }

  // Restore form from a saved plan
  const restoreFromPlan = (plan: FeedingPlan) => {
    setWeightKg(String(plan.weight_kg))
    setWeightSource('급여 계획')
    setIsNeutered(plan.is_neutered)
    setActivityLevel(plan.activity_level)
    setFrequency(plan.feeding_frequency)
    setFoods(plan.foods.length > 0 ? plan.foods : [createDefaultFood()])
    setFoodInputKey(prev => prev + 1) // FoodMixingInput 리마운트 → directInputIndex 재초기화
  }

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

  // Calculation
  const calculation = useMemo(() => {
    const weight = parseFloat(weightKg)
    if (!weight || weight <= 0) return null

    const rer = calculateRER(weight)
    const fakePet = { is_neutered: isNeutered, activity_level: activityLevel } as Pet
    const factor = getActivityFactor(fakePet)
    const der = Math.round(rer * factor)

    const mixedDensity = calculateMixedCalorieDensity(foods)
    if (!mixedDensity || mixedDensity <= 0) {
      return { rer, factor, der, dailyGrams: null, perMealGrams: null, mixedDensity: 0 }
    }

    const dailyGrams = Math.round(der / mixedDensity)
    const perMealGrams = Math.round(dailyGrams / frequency)

    return { rer, factor, der, dailyGrams, perMealGrams, mixedDensity }
  }, [weightKg, foods, isNeutered, activityLevel, frequency])

  // Ratio validation
  const totalRatio = foods.reduce((sum, f) => sum + (f.ratio_percent || 0), 0)
  const isRatioValid = foods.length === 1 || Math.abs(totalRatio - 100) < 0.01

  // Save feeding plan
  const handleSave = async () => {
    if (!currentPet || !calculation) return

    if (!isRatioValid) {
      toast({ title: '비율 오류', description: '사료 비율 합계가 100%여야 합니다.', variant: 'destructive' })
      return
    }

    // Check all foods have calorie density
    const invalidFoods = foods.filter(f => !f.calorie_density || f.calorie_density <= 0)
    if (invalidFoods.length > 0) {
      toast({ title: '입력 오류', description: '모든 사료에 칼로리 밀도를 입력해주세요.', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const weight = parseFloat(weightKg)
      const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })

      // Save feeding plan
      const planRes = await fetch('/api/feeding-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pet_id: currentPet.id,
          plan_date: today,
          weight_kg: weight,
          is_neutered: isNeutered,
          activity_level: activityLevel,
          foods,
          feeding_frequency: frequency,
        }),
      })

      const planData = await planRes.json()

      if (!planData.success) {
        throw new Error(planData.error || 'Failed to save')
      }

      // Also update pet profile (weight, neutered, activity)
      const updateBody: Record<string, unknown> = {
        id: currentPet.id,
        is_neutered: isNeutered,
        activity_level: activityLevel,
      }
      if (weight > 0) updateBody.weight_kg = weight

      // Use mixed density for fallback compatibility
      const mixedDensity = calculateMixedCalorieDensity(foods)
      if (mixedDensity > 0) updateBody.food_calorie_density = mixedDensity

      const petRes = await fetch('/api/pets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody),
      })
      const petData = await petRes.json()
      if (petData.success) {
        updatePet(petData.data)
      }

      toast({ title: '저장 완료', description: '급여 계획이 저장되었습니다.' })
      fetchHistory()
    } catch {
      toast({ title: '저장 실패', description: '급여 계획을 저장하지 못했습니다.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // Delete plan
  const handleDeletePlan = async (id: string) => {
    try {
      const res = await fetch(`/api/feeding-plans?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        toast({ title: '삭제 완료', description: '급여 계획이 삭제되었습니다.' })
        fetchHistory()
      } else {
        throw new Error(data.error)
      }
    } catch {
      toast({ title: '삭제 실패', description: '급여 계획을 삭제하지 못했습니다.', variant: 'destructive' })
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

        {/* 사료 열량 섹션 (다중 사료) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">사료 열량</CardTitle>
          </CardHeader>
          <CardContent>
            <FoodMixingInput
              key={foodInputKey}
              foods={foods}
              onChange={setFoods}
              petFoods={petFoods}
              foodsLoading={foodsLoading}
              petType={currentPet?.type}
            />
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
                    {/* 가중 평균 밀도 (다중 사료 시 표시) */}
                    {foods.length > 1 && (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>가중 평균 칼로리 밀도</span>
                        <span>{calculation.mixedDensity.toFixed(2)} kcal/g</span>
                      </div>
                    )}

                    <div className="flex justify-between font-semibold text-base">
                      <span>일일 사료량</span>
                      <span className="text-primary">{calculation.dailyGrams}g</span>
                    </div>

                    {/* 사료별 급여량 (다중 사료 시) */}
                    {foods.length > 1 && calculation.dailyGrams && (
                      <div className="bg-muted/50 rounded-lg p-2 space-y-1">
                        {foods.map((f, i) => {
                          const grams = Math.round(calculation.dailyGrams! * f.ratio_percent / 100)
                          return (
                            <div key={i} className="flex justify-between text-xs">
                              <span className="text-muted-foreground truncate mr-2">
                                {f.name || `사료 ${i + 1}`} ({f.ratio_percent}%)
                              </span>
                              <span className="font-medium whitespace-nowrap">{grams}g</span>
                            </div>
                          )
                        })}
                      </div>
                    )}

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

              {/* 저장 버튼 */}
              <Button
                className="w-full"
                onClick={handleSave}
                disabled={saving || !isRatioValid}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                급여 계획 저장
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                오늘 날짜로 급여 계획을 저장합니다
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

        {/* 급여 계획 기록 */}
        <FeedingPlanHistory
          plans={plans}
          onSelect={restoreFromPlan}
          onDelete={handleDeletePlan}
          isLoading={historyLoading}
        />
      </div>
    </div>
  )
}
