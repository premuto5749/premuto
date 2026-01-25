/**
 * 단위 값 변환 유틸리티
 *
 * 같은 항목이라도 장비에 따라 다른 단위로 측정될 수 있음
 * 이 모듈은 값을 표준 단위로 변환
 *
 * 예: Calcium 2.5 mmol/L → 10.02 mg/dL
 */

import { normalizeUnit } from './unit-normalizer'

/**
 * 단위 변환 규칙 정의
 * key: 항목명 (대문자)
 * value: { 표준단위, 변환규칙들 }
 */
interface ConversionRule {
  standardUnit: string
  conversions: {
    fromUnit: string      // 원본 단위
    multiplier: number    // 곱하면 표준 단위로 변환
    formula?: string      // 설명용 (선택)
  }[]
}

const CONVERSION_RULES: Record<string, ConversionRule> = {
  // 혈구 수
  'PLT': {
    standardUnit: 'K/μL',
    conversions: [
      { fromUnit: 'K/μL', multiplier: 1 },
      { fromUnit: '/μL', multiplier: 0.001, formula: '/μL ÷ 1000 = K/μL' },
      { fromUnit: '10^9/L', multiplier: 1, formula: '10^9/L = K/μL' },
    ]
  },
  'RBC': {
    standardUnit: 'M/μL',
    conversions: [
      { fromUnit: 'M/μL', multiplier: 1 },
      { fromUnit: '10^12/L', multiplier: 1, formula: '10^12/L = M/μL' },
      { fromUnit: '/μL', multiplier: 0.000001, formula: '/μL ÷ 10^6 = M/μL' },
    ]
  },
  'WBC': {
    standardUnit: 'K/μL',
    conversions: [
      { fromUnit: 'K/μL', multiplier: 1 },
      { fromUnit: '/μL', multiplier: 0.001, formula: '/μL ÷ 1000 = K/μL' },
      { fromUnit: '10^9/L', multiplier: 1, formula: '10^9/L = K/μL' },
    ]
  },

  // 전해질 - Calcium
  'CA': {
    standardUnit: 'mg/dL',
    conversions: [
      { fromUnit: 'mg/dL', multiplier: 1 },
      { fromUnit: 'mmol/L', multiplier: 4.008, formula: 'mmol/L × 4.008 = mg/dL' },
      { fromUnit: 'mEq/L', multiplier: 2.004, formula: 'mEq/L × 2.004 = mg/dL' },
    ]
  },
  'CALCIUM': {
    standardUnit: 'mg/dL',
    conversions: [
      { fromUnit: 'mg/dL', multiplier: 1 },
      { fromUnit: 'mmol/L', multiplier: 4.008, formula: 'mmol/L × 4.008 = mg/dL' },
      { fromUnit: 'mEq/L', multiplier: 2.004, formula: 'mEq/L × 2.004 = mg/dL' },
    ]
  },

  // 전해질 - Phosphorus
  'P': {
    standardUnit: 'mg/dL',
    conversions: [
      { fromUnit: 'mg/dL', multiplier: 1 },
      { fromUnit: 'mmol/L', multiplier: 3.097, formula: 'mmol/L × 3.097 = mg/dL' },
    ]
  },
  'PHOSPHORUS': {
    standardUnit: 'mg/dL',
    conversions: [
      { fromUnit: 'mg/dL', multiplier: 1 },
      { fromUnit: 'mmol/L', multiplier: 3.097, formula: 'mmol/L × 3.097 = mg/dL' },
    ]
  },

  // 전해질 - Potassium
  'K': {
    standardUnit: 'mEq/L',
    conversions: [
      { fromUnit: 'mEq/L', multiplier: 1 },
      { fromUnit: 'mmol/L', multiplier: 1, formula: 'mmol/L = mEq/L (1가 이온)' },
    ]
  },
  'POTASSIUM': {
    standardUnit: 'mEq/L',
    conversions: [
      { fromUnit: 'mEq/L', multiplier: 1 },
      { fromUnit: 'mmol/L', multiplier: 1, formula: 'mmol/L = mEq/L (1가 이온)' },
    ]
  },

  // 전해질 - Sodium
  'NA': {
    standardUnit: 'mEq/L',
    conversions: [
      { fromUnit: 'mEq/L', multiplier: 1 },
      { fromUnit: 'mmol/L', multiplier: 1, formula: 'mmol/L = mEq/L (1가 이온)' },
    ]
  },
  'SODIUM': {
    standardUnit: 'mEq/L',
    conversions: [
      { fromUnit: 'mEq/L', multiplier: 1 },
      { fromUnit: 'mmol/L', multiplier: 1, formula: 'mmol/L = mEq/L (1가 이온)' },
    ]
  },

  // 전해질 - Chloride
  'CL': {
    standardUnit: 'mEq/L',
    conversions: [
      { fromUnit: 'mEq/L', multiplier: 1 },
      { fromUnit: 'mmol/L', multiplier: 1, formula: 'mmol/L = mEq/L (1가 이온)' },
    ]
  },
  'CHLORIDE': {
    standardUnit: 'mEq/L',
    conversions: [
      { fromUnit: 'mEq/L', multiplier: 1 },
      { fromUnit: 'mmol/L', multiplier: 1, formula: 'mmol/L = mEq/L (1가 이온)' },
    ]
  },

  // 전해질 - Magnesium
  'MG': {
    standardUnit: 'mg/dL',
    conversions: [
      { fromUnit: 'mg/dL', multiplier: 1 },
      { fromUnit: 'mmol/L', multiplier: 2.43, formula: 'mmol/L × 2.43 = mg/dL' },
      { fromUnit: 'mEq/L', multiplier: 1.215, formula: 'mEq/L × 1.215 = mg/dL' },
    ]
  },
  'MAGNESIUM': {
    standardUnit: 'mg/dL',
    conversions: [
      { fromUnit: 'mg/dL', multiplier: 1 },
      { fromUnit: 'mmol/L', multiplier: 2.43, formula: 'mmol/L × 2.43 = mg/dL' },
      { fromUnit: 'mEq/L', multiplier: 1.215, formula: 'mEq/L × 1.215 = mg/dL' },
    ]
  },

  // 신장 기능
  'BUN': {
    standardUnit: 'mg/dL',
    conversions: [
      { fromUnit: 'mg/dL', multiplier: 1 },
      { fromUnit: 'mmol/L', multiplier: 2.801, formula: 'mmol/L × 2.801 = mg/dL' },
    ]
  },
  'CREATININE': {
    standardUnit: 'mg/dL',
    conversions: [
      { fromUnit: 'mg/dL', multiplier: 1 },
      { fromUnit: 'μmol/L', multiplier: 0.0113, formula: 'μmol/L × 0.0113 = mg/dL' },
      { fromUnit: 'umol/L', multiplier: 0.0113, formula: 'umol/L × 0.0113 = mg/dL' },
    ]
  },
  'CREA': {
    standardUnit: 'mg/dL',
    conversions: [
      { fromUnit: 'mg/dL', multiplier: 1 },
      { fromUnit: 'μmol/L', multiplier: 0.0113, formula: 'μmol/L × 0.0113 = mg/dL' },
      { fromUnit: 'umol/L', multiplier: 0.0113, formula: 'umol/L × 0.0113 = mg/dL' },
    ]
  },

  // 당
  'GLUCOSE': {
    standardUnit: 'mg/dL',
    conversions: [
      { fromUnit: 'mg/dL', multiplier: 1 },
      { fromUnit: 'mmol/L', multiplier: 18.02, formula: 'mmol/L × 18.02 = mg/dL' },
    ]
  },
  'GLU': {
    standardUnit: 'mg/dL',
    conversions: [
      { fromUnit: 'mg/dL', multiplier: 1 },
      { fromUnit: 'mmol/L', multiplier: 18.02, formula: 'mmol/L × 18.02 = mg/dL' },
    ]
  },

  // 빌리루빈
  'TBIL': {
    standardUnit: 'mg/dL',
    conversions: [
      { fromUnit: 'mg/dL', multiplier: 1 },
      { fromUnit: 'μmol/L', multiplier: 0.0585, formula: 'μmol/L × 0.0585 = mg/dL' },
      { fromUnit: 'umol/L', multiplier: 0.0585, formula: 'umol/L × 0.0585 = mg/dL' },
    ]
  },
  'BILIRUBIN': {
    standardUnit: 'mg/dL',
    conversions: [
      { fromUnit: 'mg/dL', multiplier: 1 },
      { fromUnit: 'μmol/L', multiplier: 0.0585, formula: 'μmol/L × 0.0585 = mg/dL' },
    ]
  },

  // 콜레스테롤
  'CHOLESTEROL': {
    standardUnit: 'mg/dL',
    conversions: [
      { fromUnit: 'mg/dL', multiplier: 1 },
      { fromUnit: 'mmol/L', multiplier: 38.67, formula: 'mmol/L × 38.67 = mg/dL' },
    ]
  },
  'CHOL': {
    standardUnit: 'mg/dL',
    conversions: [
      { fromUnit: 'mg/dL', multiplier: 1 },
      { fromUnit: 'mmol/L', multiplier: 38.67, formula: 'mmol/L × 38.67 = mg/dL' },
    ]
  },

  // 중성지방
  'TRIGLYCERIDE': {
    standardUnit: 'mg/dL',
    conversions: [
      { fromUnit: 'mg/dL', multiplier: 1 },
      { fromUnit: 'mmol/L', multiplier: 88.57, formula: 'mmol/L × 88.57 = mg/dL' },
    ]
  },
  'TG': {
    standardUnit: 'mg/dL',
    conversions: [
      { fromUnit: 'mg/dL', multiplier: 1 },
      { fromUnit: 'mmol/L', multiplier: 88.57, formula: 'mmol/L × 88.57 = mg/dL' },
    ]
  },

  // 단백질
  'TP': {
    standardUnit: 'g/dL',
    conversions: [
      { fromUnit: 'g/dL', multiplier: 1 },
      { fromUnit: 'g/L', multiplier: 0.1, formula: 'g/L × 0.1 = g/dL' },
    ]
  },
  'ALBUMIN': {
    standardUnit: 'g/dL',
    conversions: [
      { fromUnit: 'g/dL', multiplier: 1 },
      { fromUnit: 'g/L', multiplier: 0.1, formula: 'g/L × 0.1 = g/dL' },
    ]
  },
  'ALB': {
    standardUnit: 'g/dL',
    conversions: [
      { fromUnit: 'g/dL', multiplier: 1 },
      { fromUnit: 'g/L', multiplier: 0.1, formula: 'g/L × 0.1 = g/dL' },
    ]
  },
  'GLOBULIN': {
    standardUnit: 'g/dL',
    conversions: [
      { fromUnit: 'g/dL', multiplier: 1 },
      { fromUnit: 'g/L', multiplier: 0.1, formula: 'g/L × 0.1 = g/dL' },
    ]
  },

  // 헤모글로빈
  'HGB': {
    standardUnit: 'g/dL',
    conversions: [
      { fromUnit: 'g/dL', multiplier: 1 },
      { fromUnit: 'g/L', multiplier: 0.1, formula: 'g/L × 0.1 = g/dL' },
      { fromUnit: 'mmol/L', multiplier: 1.611, formula: 'mmol/L × 1.611 = g/dL' },
    ]
  },
  'HEMOGLOBIN': {
    standardUnit: 'g/dL',
    conversions: [
      { fromUnit: 'g/dL', multiplier: 1 },
      { fromUnit: 'g/L', multiplier: 0.1, formula: 'g/L × 0.1 = g/dL' },
      { fromUnit: 'mmol/L', multiplier: 1.611, formula: 'mmol/L × 1.611 = g/dL' },
    ]
  },
}

export interface ConversionResult {
  success: boolean
  originalValue: number
  originalUnit: string
  convertedValue: number | null
  standardUnit: string | null
  formula: string | null
  errorMessage: string | null
}

/**
 * 단위 변환 수행
 * @param itemName 항목명 (ALT, BUN, Ca 등)
 * @param value 원본 값
 * @param fromUnit 원본 단위
 * @returns 변환 결과
 */
export function convertUnit(
  itemName: string,
  value: number,
  fromUnit: string
): ConversionResult {
  const normalizedItemName = itemName.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const normalizedFromUnit = normalizeUnit(fromUnit)

  // 변환 규칙 찾기
  const rule = CONVERSION_RULES[normalizedItemName]

  if (!rule) {
    // 규칙이 없으면 변환 불가 (원본 그대로 사용)
    return {
      success: false,
      originalValue: value,
      originalUnit: fromUnit,
      convertedValue: null,
      standardUnit: null,
      formula: null,
      errorMessage: `No conversion rule for item: ${itemName}`
    }
  }

  // 이미 표준 단위인지 확인
  if (normalizeUnit(rule.standardUnit) === normalizedFromUnit) {
    return {
      success: true,
      originalValue: value,
      originalUnit: fromUnit,
      convertedValue: value,
      standardUnit: rule.standardUnit,
      formula: 'Already in standard unit',
      errorMessage: null
    }
  }

  // 변환 규칙 찾기
  const conversion = rule.conversions.find(c =>
    normalizeUnit(c.fromUnit) === normalizedFromUnit
  )

  if (!conversion) {
    return {
      success: false,
      originalValue: value,
      originalUnit: fromUnit,
      convertedValue: null,
      standardUnit: rule.standardUnit,
      formula: null,
      errorMessage: `No conversion from ${fromUnit} to ${rule.standardUnit} for ${itemName}`
    }
  }

  // 변환 수행
  const convertedValue = value * conversion.multiplier

  return {
    success: true,
    originalValue: value,
    originalUnit: fromUnit,
    convertedValue: Math.round(convertedValue * 1000) / 1000, // 소수점 3자리
    standardUnit: rule.standardUnit,
    formula: conversion.formula || `${value} × ${conversion.multiplier} = ${convertedValue}`,
    errorMessage: null
  }
}

/**
 * 항목의 표준 단위 조회
 */
export function getStandardUnit(itemName: string): string | null {
  const normalizedItemName = itemName.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const rule = CONVERSION_RULES[normalizedItemName]
  return rule?.standardUnit || null
}

/**
 * 항목이 변환 가능한지 확인
 */
export function hasConversionRule(itemName: string): boolean {
  const normalizedItemName = itemName.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return normalizedItemName in CONVERSION_RULES
}

/**
 * 항목의 지원되는 단위 목록 반환
 */
export function getSupportedUnits(itemName: string): string[] {
  const normalizedItemName = itemName.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const rule = CONVERSION_RULES[normalizedItemName]

  if (!rule) return []

  return rule.conversions.map(c => c.fromUnit)
}

/**
 * 모든 변환 규칙이 있는 항목 목록 반환
 */
export function getAllConvertibleItems(): string[] {
  return Object.keys(CONVERSION_RULES)
}

/**
 * 역변환 (표준 단위 → 다른 단위)
 * 참조범위 표시 등에 사용
 */
export function reverseConvertUnit(
  itemName: string,
  value: number,
  toUnit: string
): ConversionResult {
  const normalizedItemName = itemName.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const normalizedToUnit = normalizeUnit(toUnit)

  const rule = CONVERSION_RULES[normalizedItemName]

  if (!rule) {
    return {
      success: false,
      originalValue: value,
      originalUnit: 'unknown',
      convertedValue: null,
      standardUnit: null,
      formula: null,
      errorMessage: `No conversion rule for item: ${itemName}`
    }
  }

  // 이미 목표 단위와 같은 경우
  if (normalizeUnit(rule.standardUnit) === normalizedToUnit) {
    return {
      success: true,
      originalValue: value,
      originalUnit: rule.standardUnit,
      convertedValue: value,
      standardUnit: toUnit,
      formula: 'Same unit',
      errorMessage: null
    }
  }

  // 역변환 규칙 찾기
  const conversion = rule.conversions.find(c =>
    normalizeUnit(c.fromUnit) === normalizedToUnit
  )

  if (!conversion) {
    return {
      success: false,
      originalValue: value,
      originalUnit: rule.standardUnit,
      convertedValue: null,
      standardUnit: toUnit,
      formula: null,
      errorMessage: `No reverse conversion to ${toUnit} for ${itemName}`
    }
  }

  // 역변환 수행 (나누기)
  const convertedValue = value / conversion.multiplier

  return {
    success: true,
    originalValue: value,
    originalUnit: rule.standardUnit,
    convertedValue: Math.round(convertedValue * 1000) / 1000,
    standardUnit: toUnit,
    formula: `${value} ÷ ${conversion.multiplier} = ${convertedValue}`,
    errorMessage: null
  }
}
