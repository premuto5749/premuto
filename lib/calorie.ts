import type { Pet } from '@/types'

// RER (Resting Energy Requirement) 계산: 70 * (체중kg)^0.75
export function calculateRER(weightKg: number): number {
  return 70 * Math.pow(weightKg, 0.75)
}

// 활동 계수 (DER = RER * factor)
export function getActivityFactor(pet: Pet): number {
  const isNeutered = pet.is_neutered ?? false
  const activity = pet.activity_level || 'normal'

  // 기본 계수 (중성화 여부 기반)
  let baseFactor = isNeutered ? 1.2 : 1.4

  // 활동량 보정
  switch (activity) {
    case 'low':
      baseFactor *= 0.85
      break
    case 'normal':
      // 기본값 유지
      break
    case 'high':
      baseFactor *= 1.2
      break
  }

  return baseFactor
}

// 일일 권장 칼로리 (DER) 계산
export function calculateCalories(pet: Pet, weightKg: number): number {
  const rer = calculateRER(weightKg)
  const factor = getActivityFactor(pet)
  return Math.round(rer * factor)
}

// 섭취 칼로리 계산 (식사량 * 사료 칼로리 밀도)
export function calculateIntake(totalMealGrams: number, caloriePerGram: number | null): number {
  if (!caloriePerGram || caloriePerGram <= 0) return 0
  return Math.round(totalMealGrams * caloriePerGram)
}
