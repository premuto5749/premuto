/**
 * 참조범위 파싱 유틸리티
 * OCR로 추출된 참조범위 문자열을 min/max 숫자값으로 변환
 *
 * 지원 형식:
 * - 범위: "5.65-8.87", "-2~3", "-7 ~ 2.9"
 * - 단측(상한만): "<14", "≤100", "< 9"
 * - 단측(하한만): ">5", "≥0", "> 100"
 * - 특수: "-", "", "음성(-)", "Negative"
 */

export interface ReferenceRange {
  min: number | null
  max: number | null
  original: string
  isValid: boolean
  isNegative?: boolean  // "음성(-)", "Negative" 등
}

// 참조범위 파싱 패턴들
const PATTERNS = {
  // "5.65-8.87", "-2~3", "-7 ~ 2.9", "0.5 - 1.8"
  range: /^(-?\d+\.?\d*)\s*[-~]\s*(-?\d+\.?\d*)$/,

  // "<14", "≤100", "< 9", "＜500"
  upperOnly: /^[<≤＜]\s*(\d+\.?\d*)$/,

  // ">5", "≥0", "> 100", "＞0"
  lowerOnly: /^[>≥＞]\s*(\d+\.?\d*)$/,

  // "음성(-)", "Negative", "음성", "(-)"
  negative: /^(음성|negative|陰性|\([-−]\))/i,
}

/**
 * 참조범위 문자열 파싱
 */
export function parseReferenceRange(refStr: string | null | undefined): ReferenceRange {
  const original = refStr ?? ''
  const trimmed = original.trim()

  // 빈 값 또는 "-" 만 있는 경우
  if (!trimmed || trimmed === '-' || trimmed === '−') {
    return {
      min: null,
      max: null,
      original,
      isValid: false
    }
  }

  // 음성/Negative 체크
  if (PATTERNS.negative.test(trimmed)) {
    return {
      min: null,
      max: null,
      original,
      isValid: true,
      isNegative: true
    }
  }

  // 범위 형식: "5.65-8.87"
  const rangeMatch = trimmed.match(PATTERNS.range)
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1])
    const max = parseFloat(rangeMatch[2])
    return {
      min: isNaN(min) ? null : min,
      max: isNaN(max) ? null : max,
      original,
      isValid: !isNaN(min) && !isNaN(max)
    }
  }

  // 상한만: "<14"
  const upperMatch = trimmed.match(PATTERNS.upperOnly)
  if (upperMatch) {
    const max = parseFloat(upperMatch[1])
    return {
      min: null,
      max: isNaN(max) ? null : max,
      original,
      isValid: !isNaN(max)
    }
  }

  // 하한만: ">5"
  const lowerMatch = trimmed.match(PATTERNS.lowerOnly)
  if (lowerMatch) {
    const min = parseFloat(lowerMatch[1])
    return {
      min: isNaN(min) ? null : min,
      max: null,
      original,
      isValid: !isNaN(min)
    }
  }

  // 파싱 실패 - 원본 텍스트만 보존
  return {
    min: null,
    max: null,
    original,
    isValid: false
  }
}

/**
 * 값이 참조범위 내에 있는지 확인
 * @returns 'low' | 'normal' | 'high' | 'unknown'
 */
export function checkValueInRange(
  value: number | null,
  range: ReferenceRange
): 'low' | 'normal' | 'high' | 'unknown' {
  if (value === null) return 'unknown'
  if (!range.isValid) return 'unknown'
  if (range.min === null && range.max === null) return 'unknown'

  // 하한만 있는 경우
  if (range.min !== null && range.max === null) {
    return value < range.min ? 'low' : 'normal'
  }

  // 상한만 있는 경우
  if (range.min === null && range.max !== null) {
    return value > range.max ? 'high' : 'normal'
  }

  // 둘 다 있는 경우
  if (range.min !== null && range.max !== null) {
    if (value < range.min) return 'low'
    if (value > range.max) return 'high'
    return 'normal'
  }

  return 'unknown'
}

/**
 * 참조범위를 표시용 문자열로 포맷
 */
export function formatReferenceRange(range: ReferenceRange): string {
  if (!range.isValid) return range.original || '-'

  if (range.isNegative) return '음성'

  if (range.min !== null && range.max !== null) {
    return `${range.min}-${range.max}`
  }

  if (range.min !== null) {
    return `>${range.min}`
  }

  if (range.max !== null) {
    return `<${range.max}`
  }

  return range.original || '-'
}

/**
 * GPT 응답에서 추출된 reference 문자열을 ref_min, ref_max로 변환
 * 기존 코드와의 호환성을 위한 헬퍼 함수
 */
export function extractRefMinMax(reference: string | null | undefined): {
  ref_min: number | null
  ref_max: number | null
  ref_text: string | null
} {
  const parsed = parseReferenceRange(reference)
  return {
    ref_min: parsed.min,
    ref_max: parsed.max,
    ref_text: parsed.original || null
  }
}
