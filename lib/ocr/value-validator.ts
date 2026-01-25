/**
 * 검사 결과 값 검증 유틸리티
 *
 * OCR 추출 값의 유효성을 검증하고 이상치를 탐지
 * 생물학적으로 가능한 범위(biological range) 기반 검증
 */

export interface ValidationResult {
  isValid: boolean
  value: number | string
  warnings: ValidationWarning[]
  errors: ValidationError[]
  suggestions: string[]
}

export interface ValidationWarning {
  type: 'out_of_biological_range' | 'unusual_value' | 'possible_ocr_error' | 'unit_mismatch'
  message: string
  severity: 'low' | 'medium' | 'high'
}

export interface ValidationError {
  type: 'invalid_value' | 'missing_required' | 'impossible_value'
  message: string
}

/**
 * 항목별 생물학적 가능 범위 (Biological Plausible Range)
 * 이 범위를 벗어나면 OCR 오류 가능성이 높음
 */
interface BiologicalRange {
  min: number
  max: number
  unit: string
  criticalLow?: number   // 생명 위험 저값
  criticalHigh?: number  // 생명 위험 고값
}

const BIOLOGICAL_RANGES: Record<string, BiologicalRange> = {
  // CBC
  'WBC': { min: 0.1, max: 200, unit: 'K/μL', criticalLow: 1, criticalHigh: 50 },
  'RBC': { min: 1, max: 15, unit: 'M/μL', criticalLow: 3, criticalHigh: 10 },
  'HGB': { min: 1, max: 25, unit: 'g/dL', criticalLow: 5, criticalHigh: 20 },
  'HCT': { min: 5, max: 80, unit: '%', criticalLow: 15, criticalHigh: 65 },
  'MCV': { min: 30, max: 150, unit: 'fL' },
  'MCH': { min: 10, max: 50, unit: 'pg' },
  'MCHC': { min: 20, max: 45, unit: 'g/dL' },
  'PLT': { min: 5, max: 2000, unit: 'K/μL', criticalLow: 20, criticalHigh: 1000 },
  'RDW': { min: 8, max: 30, unit: '%' },

  // WBC Differential (%)
  'NEU': { min: 0, max: 100, unit: '%' },
  'LYM': { min: 0, max: 100, unit: '%' },
  'MONO': { min: 0, max: 100, unit: '%' },
  'EOS': { min: 0, max: 100, unit: '%' },
  'BASO': { min: 0, max: 100, unit: '%' },

  // Chemistry - Kidney
  'BUN': { min: 0, max: 300, unit: 'mg/dL', criticalHigh: 150 },
  'CREA': { min: 0, max: 30, unit: 'mg/dL', criticalHigh: 15 },
  'CREATININE': { min: 0, max: 30, unit: 'mg/dL', criticalHigh: 15 },
  'SDMA': { min: 0, max: 100, unit: 'μg/dL' },

  // Chemistry - Liver
  'ALT': { min: 0, max: 5000, unit: 'U/L', criticalHigh: 2000 },
  'AST': { min: 0, max: 5000, unit: 'U/L', criticalHigh: 2000 },
  'ALP': { min: 0, max: 5000, unit: 'U/L' },
  'ALKP': { min: 0, max: 5000, unit: 'U/L' },
  'GGT': { min: 0, max: 500, unit: 'U/L' },
  'TBIL': { min: 0, max: 30, unit: 'mg/dL', criticalHigh: 15 },

  // Chemistry - Protein
  'TP': { min: 1, max: 15, unit: 'g/dL' },
  'ALB': { min: 0.5, max: 8, unit: 'g/dL', criticalLow: 1.5 },
  'GLOB': { min: 0.5, max: 10, unit: 'g/dL' },

  // Chemistry - Glucose
  'GLU': { min: 10, max: 1000, unit: 'mg/dL', criticalLow: 40, criticalHigh: 500 },
  'GLUCOSE': { min: 10, max: 1000, unit: 'mg/dL', criticalLow: 40, criticalHigh: 500 },

  // Chemistry - Lipids
  'CHOL': { min: 50, max: 1000, unit: 'mg/dL' },
  'TG': { min: 10, max: 2000, unit: 'mg/dL' },
  'TRIGLYCERIDE': { min: 10, max: 2000, unit: 'mg/dL' },

  // Electrolytes
  'NA': { min: 100, max: 200, unit: 'mEq/L', criticalLow: 120, criticalHigh: 160 },
  'SODIUM': { min: 100, max: 200, unit: 'mEq/L', criticalLow: 120, criticalHigh: 160 },
  'K': { min: 1, max: 10, unit: 'mEq/L', criticalLow: 2.5, criticalHigh: 7 },
  'POTASSIUM': { min: 1, max: 10, unit: 'mEq/L', criticalLow: 2.5, criticalHigh: 7 },
  'CL': { min: 70, max: 150, unit: 'mEq/L' },
  'CHLORIDE': { min: 70, max: 150, unit: 'mEq/L' },
  'CA': { min: 4, max: 20, unit: 'mg/dL', criticalLow: 6, criticalHigh: 14 },
  'CALCIUM': { min: 4, max: 20, unit: 'mg/dL', criticalLow: 6, criticalHigh: 14 },
  'P': { min: 1, max: 20, unit: 'mg/dL' },
  'PHOSPHORUS': { min: 1, max: 20, unit: 'mg/dL' },
  'MG': { min: 0.5, max: 5, unit: 'mg/dL' },
  'MAGNESIUM': { min: 0.5, max: 5, unit: 'mg/dL' },

  // Special Tests
  'LIPASE': { min: 0, max: 5000, unit: 'U/L' },
  'AMYLASE': { min: 0, max: 5000, unit: 'U/L' },
  'CPL': { min: 0, max: 2000, unit: 'μg/L' },
  'SPEC_CPL': { min: 0, max: 2000, unit: 'μg/L' },

  // Coagulation
  'PT': { min: 5, max: 60, unit: 'sec' },
  'APTT': { min: 10, max: 120, unit: 'sec' },
  'FIB': { min: 50, max: 1000, unit: 'mg/dL' },

  // Urinalysis
  'USG': { min: 1.000, max: 1.100, unit: '' },
  'URINE_PH': { min: 4, max: 10, unit: '' },
}

/**
 * 값 검증 수행
 */
export function validateValue(
  itemName: string,
  value: number | string,
  unit?: string
): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    value,
    warnings: [],
    errors: [],
    suggestions: []
  }

  // 문자열 값 처리 (특수값)
  if (typeof value === 'string') {
    const specialResult = validateSpecialValue(value)
    if (!specialResult.isValid) {
      result.isValid = false
      result.errors.push(...specialResult.errors)
    }
    result.warnings.push(...specialResult.warnings)
    return result
  }

  // 숫자 값 검증
  const normalizedName = itemName.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const range = BIOLOGICAL_RANGES[normalizedName]

  if (!range) {
    // 알려진 항목이 아닌 경우 기본 검증만
    if (value < 0) {
      result.warnings.push({
        type: 'unusual_value',
        message: `음수 값(${value})은 일반적으로 비정상입니다`,
        severity: 'medium'
      })
    }
    return result
  }

  // 생물학적 범위 검증
  if (value < range.min || value > range.max) {
    result.warnings.push({
      type: 'out_of_biological_range',
      message: `${itemName} 값(${value})이 생물학적 가능 범위(${range.min}-${range.max})를 벗어났습니다. OCR 오류일 수 있습니다.`,
      severity: 'high'
    })
    result.suggestions.push(`값을 다시 확인해 주세요: ${value} ${unit || range.unit}`)
  }

  // 위험 수치 경고
  if (range.criticalLow !== undefined && value < range.criticalLow) {
    result.warnings.push({
      type: 'unusual_value',
      message: `${itemName} 값(${value})이 위험 저값(${range.criticalLow}) 미만입니다`,
      severity: 'high'
    })
  }

  if (range.criticalHigh !== undefined && value > range.criticalHigh) {
    result.warnings.push({
      type: 'unusual_value',
      message: `${itemName} 값(${value})이 위험 고값(${range.criticalHigh}) 초과입니다`,
      severity: 'high'
    })
  }

  // OCR 오류 패턴 감지
  const ocrErrors = detectOcrErrors(value, normalizedName)
  result.warnings.push(...ocrErrors)

  return result
}

/**
 * 특수값 검증 (<500, *14, >1000 등)
 */
function validateSpecialValue(value: string): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    value,
    warnings: [],
    errors: [],
    suggestions: []
  }

  // 빈 값
  if (!value || value.trim() === '') {
    result.isValid = false
    result.errors.push({
      type: 'missing_required',
      message: '값이 비어 있습니다'
    })
    return result
  }

  // 특수 패턴 검증
  const patterns = [
    /^[<>]?\s*\d+\.?\d*$/,           // <500, >1000, 14.5
    /^\*\d+\.?\d*$/,                  // *14 (플래그 값)
    /^\d+\.?\d*\s*[<>]\s*\d+\.?\d*$/, // 범위 값
    /^(양성|음성|Positive|Negative)$/i,  // 정성 결과
    /^N\/A$/i,                        // N/A
    /^[-–—]$/,                        // 대시 (측정 불가)
  ]

  const isValidPattern = patterns.some(p => p.test(value.trim()))

  if (!isValidPattern) {
    result.warnings.push({
      type: 'possible_ocr_error',
      message: `인식할 수 없는 값 형식입니다: "${value}"`,
      severity: 'medium'
    })
  }

  return result
}

/**
 * OCR 오류 패턴 감지
 */
function detectOcrErrors(value: number, itemName: string): ValidationWarning[] {
  const warnings: ValidationWarning[] = []

  // 소수점 누락 의심 (값이 10배 이상 클 때)
  const range = BIOLOGICAL_RANGES[itemName]
  if (range && value > range.max * 10) {
    warnings.push({
      type: 'possible_ocr_error',
      message: `값(${value})이 너무 큽니다. 소수점이 누락되었을 수 있습니다 (예: ${value / 10}, ${value / 100})`,
      severity: 'medium'
    })
  }

  // 0과 O 혼동 의심 (정수부가 0인 경우)
  if (value === 0 && itemName !== 'BASO' && itemName !== 'EOS') {
    warnings.push({
      type: 'possible_ocr_error',
      message: '값이 0입니다. O(알파벳)가 0(숫자)으로 잘못 인식되었을 수 있습니다',
      severity: 'low'
    })
  }

  // 1과 l/I 혼동 의심
  const valueStr = String(value)
  if (valueStr.includes('1') && value < 2 && !['USG'].includes(itemName)) {
    // 일반적인 검사에서 1 이하의 값은 드묾
    if (range && value < range.min) {
      warnings.push({
        type: 'possible_ocr_error',
        message: `값(${value})이 너무 작습니다. 1이 l(엘) 또는 I로 잘못 인식되었을 수 있습니다`,
        severity: 'low'
      })
    }
  }

  return warnings
}

/**
 * 배치 검증 (여러 항목 한번에)
 */
export interface BatchValidationResult {
  totalItems: number
  validItems: number
  warningItems: number
  errorItems: number
  results: Map<string, ValidationResult>
}

export function validateBatch(
  items: Array<{ name: string; value: number | string; unit?: string }>
): BatchValidationResult {
  const results = new Map<string, ValidationResult>()
  let validItems = 0
  let warningItems = 0
  let errorItems = 0

  for (const item of items) {
    const result = validateValue(item.name, item.value, item.unit)
    results.set(item.name, result)

    if (result.errors.length > 0) {
      errorItems++
    } else if (result.warnings.length > 0) {
      warningItems++
    } else {
      validItems++
    }
  }

  return {
    totalItems: items.length,
    validItems,
    warningItems,
    errorItems,
    results
  }
}

/**
 * WBC Differential 합계 검증 (총합이 100% 근처여야 함)
 */
export function validateWbcDifferential(
  neu?: number,
  lym?: number,
  mono?: number,
  eos?: number,
  baso?: number
): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    value: 0,
    warnings: [],
    errors: [],
    suggestions: []
  }

  const values = [neu, lym, mono, eos, baso].filter(v => v !== undefined) as number[]

  if (values.length === 0) {
    return result
  }

  const sum = values.reduce((a, b) => a + b, 0)
  result.value = sum

  // 합계가 95-105% 범위 밖이면 경고
  if (sum < 95 || sum > 105) {
    result.warnings.push({
      type: 'unusual_value',
      message: `WBC Differential 합계(${sum.toFixed(1)}%)가 100%에서 벗어났습니다`,
      severity: sum < 90 || sum > 110 ? 'high' : 'medium'
    })
  }

  return result
}

/**
 * A/G Ratio 검증
 */
export function validateAGRatio(albumin?: number, globulin?: number): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    value: 0,
    warnings: [],
    errors: [],
    suggestions: []
  }

  if (albumin === undefined || globulin === undefined) {
    return result
  }

  if (globulin === 0) {
    result.errors.push({
      type: 'impossible_value',
      message: 'Globulin이 0이어서 A/G Ratio를 계산할 수 없습니다'
    })
    result.isValid = false
    return result
  }

  const ratio = albumin / globulin
  result.value = Math.round(ratio * 100) / 100

  // 일반적인 A/G Ratio 범위: 0.5-2.0
  if (ratio < 0.3 || ratio > 3.0) {
    result.warnings.push({
      type: 'unusual_value',
      message: `A/G Ratio(${ratio.toFixed(2)})가 비정상 범위입니다`,
      severity: 'medium'
    })
  }

  return result
}

/**
 * 생물학적 범위 조회
 */
export function getBiologicalRange(itemName: string): BiologicalRange | null {
  const normalizedName = itemName.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return BIOLOGICAL_RANGES[normalizedName] || null
}

/**
 * 모든 지원 항목 목록
 */
export function getAllValidatableItems(): string[] {
  return Object.keys(BIOLOGICAL_RANGES)
}
