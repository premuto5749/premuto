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
 * key: 항목명 (대문자, 특수문자 제거)
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
  // ── 혈구 수 ───────────────────────────────────
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

  // ── 전해질 - Calcium ──────────────────────────
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

  // ── 전해질 - Phosphorus ───────────────────────
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

  // ── 전해질 - Potassium (1가 이온: mmol/L = mEq/L) ──
  'K': {
    standardUnit: 'mmol/L',
    conversions: [
      { fromUnit: 'mmol/L', multiplier: 1 },
      { fromUnit: 'mEq/L', multiplier: 1, formula: 'mEq/L = mmol/L (1가 이온)' },
    ]
  },
  'POTASSIUM': {
    standardUnit: 'mmol/L',
    conversions: [
      { fromUnit: 'mmol/L', multiplier: 1 },
      { fromUnit: 'mEq/L', multiplier: 1, formula: 'mEq/L = mmol/L (1가 이온)' },
    ]
  },

  // ── 전해질 - Sodium (1가 이온) ────────────────
  'NA': {
    standardUnit: 'mmol/L',
    conversions: [
      { fromUnit: 'mmol/L', multiplier: 1 },
      { fromUnit: 'mEq/L', multiplier: 1, formula: 'mEq/L = mmol/L (1가 이온)' },
    ]
  },
  'SODIUM': {
    standardUnit: 'mmol/L',
    conversions: [
      { fromUnit: 'mmol/L', multiplier: 1 },
      { fromUnit: 'mEq/L', multiplier: 1, formula: 'mEq/L = mmol/L (1가 이온)' },
    ]
  },

  // ── 전해질 - Chloride (1가 이온) ──────────────
  'CL': {
    standardUnit: 'mmol/L',
    conversions: [
      { fromUnit: 'mmol/L', multiplier: 1 },
      { fromUnit: 'mEq/L', multiplier: 1, formula: 'mEq/L = mmol/L (1가 이온)' },
    ]
  },
  'CHLORIDE': {
    standardUnit: 'mmol/L',
    conversions: [
      { fromUnit: 'mmol/L', multiplier: 1 },
      { fromUnit: 'mEq/L', multiplier: 1, formula: 'mEq/L = mmol/L (1가 이온)' },
    ]
  },

  // ── 전해질 - Magnesium ────────────────────────
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

  // ── 신장 기능 ──────────────────────────────────
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
    ]
  },
  'CREA': {
    standardUnit: 'mg/dL',
    conversions: [
      { fromUnit: 'mg/dL', multiplier: 1 },
      { fromUnit: 'μmol/L', multiplier: 0.0113, formula: 'μmol/L × 0.0113 = mg/dL' },
    ]
  },
  'SDMA': {
    standardUnit: 'μg/dL',
    conversions: [
      { fromUnit: 'μg/dL', multiplier: 1 },
      { fromUnit: 'μmol/L', multiplier: 20.225, formula: 'μmol/L × 20.225 = μg/dL' },
    ]
  },

  // ── 당 ─────────────────────────────────────────
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

  // ── 빌리루빈 ──────────────────────────────────
  'TBIL': {
    standardUnit: 'mg/dL',
    conversions: [
      { fromUnit: 'mg/dL', multiplier: 1 },
      { fromUnit: 'μmol/L', multiplier: 0.0585, formula: 'μmol/L × 0.0585 = mg/dL' },
    ]
  },
  'BILIRUBIN': {
    standardUnit: 'mg/dL',
    conversions: [
      { fromUnit: 'mg/dL', multiplier: 1 },
      { fromUnit: 'μmol/L', multiplier: 0.0585, formula: 'μmol/L × 0.0585 = mg/dL' },
    ]
  },

  // ── 콜레스테롤 ────────────────────────────────
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

  // ── 중성지방 ──────────────────────────────────
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

  // ── 단백질 ────────────────────────────────────
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

  // ── 헤모글로빈 ────────────────────────────────
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

  // ── 암모니아 ──────────────────────────────────
  'NH3': {
    standardUnit: 'μg/dL',
    conversions: [
      { fromUnit: 'μg/dL', multiplier: 1 },
      { fromUnit: 'μmol/L', multiplier: 1.7031, formula: 'μmol/L × 1.7031 = μg/dL' },
    ]
  },
  'AMMONIA': {
    standardUnit: 'μg/dL',
    conversions: [
      { fromUnit: 'μg/dL', multiplier: 1 },
      { fromUnit: 'μmol/L', multiplier: 1.7031, formula: 'μmol/L × 1.7031 = μg/dL' },
    ]
  },

  // ── 젖산 ──────────────────────────────────────
  'LACTATE': {
    standardUnit: 'mmol/L',
    conversions: [
      { fromUnit: 'mmol/L', multiplier: 1 },
      { fromUnit: 'mg/dL', multiplier: 0.1110, formula: 'mg/dL × 0.1110 = mmol/L' },
    ]
  },

  // ── CRP ───────────────────────────────────────
  'CRP': {
    standardUnit: 'mg/L',
    conversions: [
      { fromUnit: 'mg/L', multiplier: 1 },
      { fromUnit: 'mg/dL', multiplier: 10, formula: 'mg/dL × 10 = mg/L' },
    ]
  },

  // ── proBNP ────────────────────────────────────
  'PROBNP': {
    standardUnit: 'pmol/L',
    conversions: [
      { fromUnit: 'pmol/L', multiplier: 1 },
      { fromUnit: 'pg/mL', multiplier: 0.118, formula: 'pg/mL × 0.118 = pmol/L' },
    ]
  },

  // ── 피브리노겐 ────────────────────────────────
  'FIBRINOGEN': {
    standardUnit: 'mg/dL',
    conversions: [
      { fromUnit: 'mg/dL', multiplier: 1 },
      { fromUnit: 'g/L', multiplier: 100, formula: 'g/L × 100 = mg/dL' },
    ]
  },

  // ── D-dimer ───────────────────────────────────
  'DDIMER': {
    standardUnit: 'mg/L',
    conversions: [
      { fromUnit: 'mg/L', multiplier: 1 },
      { fromUnit: 'mg/L FEU', multiplier: 0.5, formula: 'mg/L FEU × 0.5 = mg/L DDU' },
      { fromUnit: 'ng/mL', multiplier: 0.001, formula: 'ng/mL × 0.001 = mg/L' },
      { fromUnit: 'μg/mL', multiplier: 1, formula: 'μg/mL = mg/L' },
    ]
  },

  // ── Blood Gas 압력 ────────────────────────────
  'PCO2': {
    standardUnit: 'mmHg',
    conversions: [
      { fromUnit: 'mmHg', multiplier: 1 },
      { fromUnit: 'kPa', multiplier: 7.5006, formula: 'kPa × 7.5006 = mmHg' },
    ]
  },
  'PO2': {
    standardUnit: 'mmHg',
    conversions: [
      { fromUnit: 'mmHg', multiplier: 1 },
      { fromUnit: 'kPa', multiplier: 7.5006, formula: 'kPa × 7.5006 = mmHg' },
    ]
  },

  // ── Blood Gas - Ca(BG) ────────────────────────
  'CABG': {
    standardUnit: 'mmol/L',
    conversions: [
      { fromUnit: 'mmol/L', multiplier: 1 },
      { fromUnit: 'mg/dL', multiplier: 0.25, formula: 'mg/dL × 0.25 = mmol/L' },
      { fromUnit: 'mEq/L', multiplier: 0.5, formula: 'mEq/L × 0.5 = mmol/L' },
    ]
  },

  // ── Blood Gas - tHb(BG) ───────────────────────
  'THBBG': {
    standardUnit: 'g/dL',
    conversions: [
      { fromUnit: 'g/dL', multiplier: 1 },
      { fromUnit: 'g/L', multiplier: 0.1, formula: 'g/L × 0.1 = g/dL' },
    ]
  },

  // ── Blood Gas - Glucose(BG) ───────────────────
  'GLUCOSEBG': {
    standardUnit: 'mg/dL',
    conversions: [
      { fromUnit: 'mg/dL', multiplier: 1 },
      { fromUnit: 'mmol/L', multiplier: 18.016, formula: 'mmol/L × 18.016 = mg/dL' },
    ]
  },

  // ── Blood Gas - Lactate(BG) ───────────────────
  'LACTATEBG': {
    standardUnit: 'mmol/L',
    conversions: [
      { fromUnit: 'mmol/L', multiplier: 1 },
      { fromUnit: 'mg/dL', multiplier: 0.1110, formula: 'mg/dL × 0.1110 = mmol/L' },
    ]
  },

  // ── WBC 감별 절대수 (WBC와 동일한 변환) ────────
  'NEU': {
    standardUnit: 'K/μL',
    conversions: [
      { fromUnit: 'K/μL', multiplier: 1 },
      { fromUnit: '/μL', multiplier: 0.001, formula: '/μL ÷ 1000 = K/μL' },
    ]
  },
  'LYM': {
    standardUnit: 'K/μL',
    conversions: [
      { fromUnit: 'K/μL', multiplier: 1 },
      { fromUnit: '/μL', multiplier: 0.001, formula: '/μL ÷ 1000 = K/μL' },
    ]
  },
  'MONO': {
    standardUnit: 'K/μL',
    conversions: [
      { fromUnit: 'K/μL', multiplier: 1 },
      { fromUnit: '/μL', multiplier: 0.001, formula: '/μL ÷ 1000 = K/μL' },
    ]
  },
  'EOS': {
    standardUnit: 'K/μL',
    conversions: [
      { fromUnit: 'K/μL', multiplier: 1 },
      { fromUnit: '/μL', multiplier: 0.001, formula: '/μL ÷ 1000 = K/μL' },
    ]
  },
  'BASO': {
    standardUnit: 'K/μL',
    conversions: [
      { fromUnit: 'K/μL', multiplier: 1 },
      { fromUnit: '/μL', multiplier: 0.001, formula: '/μL ÷ 1000 = K/μL' },
    ]
  },
  'BAND': {
    standardUnit: 'K/μL',
    conversions: [
      { fromUnit: 'K/μL', multiplier: 1 },
      { fromUnit: '/μL', multiplier: 0.001, formula: '/μL ÷ 1000 = K/μL' },
    ]
  },
  'RETIC': {
    standardUnit: 'K/μL',
    conversions: [
      { fromUnit: 'K/μL', multiplier: 1 },
      { fromUnit: '/μL', multiplier: 0.001, formula: '/μL ÷ 1000 = K/μL' },
    ]
  },
  'LUC': {
    standardUnit: 'K/μL',
    conversions: [
      { fromUnit: 'K/μL', multiplier: 1 },
      { fromUnit: '/μL', multiplier: 0.001, formula: '/μL ÷ 1000 = K/μL' },
    ]
  },

  // ── CBC 농도 항목 ─────────────────────────────
  'MCHC': {
    standardUnit: 'g/dL',
    conversions: [
      { fromUnit: 'g/dL', multiplier: 1 },
      { fromUnit: 'g/L', multiplier: 0.1, formula: 'g/L × 0.1 = g/dL' },
    ]
  },
  'CHCM': {
    standardUnit: 'g/dL',
    conversions: [
      { fromUnit: 'g/dL', multiplier: 1 },
      { fromUnit: 'g/L', multiplier: 0.1, formula: 'g/L × 0.1 = g/dL' },
    ]
  },
  'HDW': {
    standardUnit: 'g/dL',
    conversions: [
      { fromUnit: 'g/dL', multiplier: 1 },
      { fromUnit: 'g/L', multiplier: 0.1, formula: 'g/L × 0.1 = g/dL' },
    ]
  },
}

/**
 * 항목명 별칭 매핑
 * 정규화된 항목명이 CONVERSION_RULES에 직접 없는 경우 여기서 참조
 */
const ITEM_NAME_ALIASES: Record<string, string> = {
  // T.Bilirubin → TBILIRUBIN → TBIL 규칙 사용
  'TBILIRUBIN': 'TBIL',
  'TOTALBILIRUBIN': 'TBIL',
  // T.Cholesterol → TCHOLESTEROL → CHOL 규칙 사용
  'TCHOLESTEROL': 'CHOL',
  'TOTALCHOLESTEROL': 'CHOL',
  // Protein-Total → PROTEINTOTAL → TP 규칙 사용
  'PROTEINTOTAL': 'TP',
  'TOTALPROTEIN': 'TP',
  // Triglycerides (복수형)
  'TRIGLYCERIDES': 'TG',
  // Blood Gas 온도보정 변형 → 동일 변환
  'PCO2T': 'PCO2',
  'PO2T': 'PO2',
  // Ca(7.4)(BG) → Ca(BG)와 동일 변환
  'CA74BG': 'CABG',
  // Blood Gas 전해질 → 일반 전해질과 동일 변환 (1가 이온)
  'NABG': 'NA',
  'KBG': 'K',
  'CLBG': 'CL',
}

/**
 * CONVERSION_RULES에서 항목 규칙 조회 (직접 + 별칭 지원)
 */
function resolveRule(normalizedItemName: string): ConversionRule | undefined {
  const rule = CONVERSION_RULES[normalizedItemName]
  if (rule) return rule

  const canonical = ITEM_NAME_ALIASES[normalizedItemName]
  if (canonical) return CONVERSION_RULES[canonical]

  return undefined
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

  // 변환 규칙 찾기 (직접 + 별칭)
  const rule = resolveRule(normalizedItemName)

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
  const rule = resolveRule(normalizedItemName)
  return rule?.standardUnit || null
}

/**
 * 항목이 변환 가능한지 확인
 */
export function hasConversionRule(itemName: string): boolean {
  const normalizedItemName = itemName.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return resolveRule(normalizedItemName) !== undefined
}

/**
 * 항목의 지원되는 단위 목록 반환
 */
export function getSupportedUnits(itemName: string): string[] {
  const normalizedItemName = itemName.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const rule = resolveRule(normalizedItemName)

  if (!rule) return []

  return rule.conversions.map(c => c.fromUnit)
}

/**
 * 모든 변환 규칙이 있는 항목 목록 반환
 */
export function getAllConvertibleItems(): string[] {
  return [...Object.keys(CONVERSION_RULES), ...Object.keys(ITEM_NAME_ALIASES)]
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

  const rule = resolveRule(normalizedItemName)

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
