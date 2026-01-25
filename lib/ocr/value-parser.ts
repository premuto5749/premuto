/**
 * 특수값 파싱 유틸리티
 * - 천단위 구분자 제거: "1,390" → 1390
 * - 미만값 파싱: "<500" → { numeric: 500, type: 'less_than' }
 * - 초과값 파싱: ">1000" → { numeric: 1000, type: 'greater_than' }
 * - 장비 오류 표시: "*14" → { numeric: 14, type: 'special', hasError: true }
 * - 텍스트 값: "Low", "Negative" → { numeric: null, type: 'text' }
 */

export type ValueType = 'numeric' | 'less_than' | 'greater_than' | 'special' | 'text'

export interface ParsedValue {
  numeric: number | null
  display: string
  type: ValueType
  hasError: boolean  // 장비 오류 표시 (*14 등)
}

/**
 * 천단위 구분자 제거
 * "1,390" → "1390"
 * "12,345.67" → "12345.67"
 */
export function removeThousandsSeparator(value: string): string {
  if (!value) return value
  // 쉼표가 천단위 구분자로 사용된 경우만 제거
  // 소수점 구분자로 쉼표를 사용하는 경우 (유럽식)는 고려하지 않음 (한국 검사지 기준)
  return value.replace(/,/g, '')
}

/**
 * 특수값 파싱
 * OCR 결과에서 추출된 값을 분석하여 숫자와 타입 정보를 반환
 */
export function parseValue(raw: string | number | null | undefined): ParsedValue {
  // null/undefined 처리
  if (raw === null || raw === undefined) {
    return {
      numeric: null,
      display: '',
      type: 'text',
      hasError: false
    }
  }

  // 이미 숫자인 경우
  if (typeof raw === 'number') {
    return {
      numeric: raw,
      display: String(raw),
      type: 'numeric',
      hasError: false
    }
  }

  const value = String(raw).trim()

  if (!value) {
    return {
      numeric: null,
      display: '',
      type: 'text',
      hasError: false
    }
  }

  // 천단위 구분자 제거
  const cleanedValue = removeThousandsSeparator(value)

  // 1. 장비 오류 표시 (*숫자)
  const errorMatch = cleanedValue.match(/^\*\s*(-?\d+\.?\d*)$/)
  if (errorMatch) {
    const num = parseFloat(errorMatch[1])
    return {
      numeric: isNaN(num) ? null : num,
      display: value, // 원본 유지
      type: 'special',
      hasError: true
    }
  }

  // 2. 미만값 (<숫자, ≤숫자)
  const lessThanMatch = cleanedValue.match(/^[<≤]\s*(-?\d+\.?\d*)$/)
  if (lessThanMatch) {
    const num = parseFloat(lessThanMatch[1])
    return {
      numeric: isNaN(num) ? null : num,
      display: value,
      type: 'less_than',
      hasError: false
    }
  }

  // 3. 초과값 (>숫자, ≥숫자)
  const greaterThanMatch = cleanedValue.match(/^[>≥]\s*(-?\d+\.?\d*)$/)
  if (greaterThanMatch) {
    const num = parseFloat(greaterThanMatch[1])
    return {
      numeric: isNaN(num) ? null : num,
      display: value,
      type: 'greater_than',
      hasError: false
    }
  }

  // 4. 일반 숫자
  const numericMatch = cleanedValue.match(/^-?\d+\.?\d*$/)
  if (numericMatch) {
    const num = parseFloat(cleanedValue)
    return {
      numeric: isNaN(num) ? null : num,
      display: value,
      type: 'numeric',
      hasError: false
    }
  }

  // 5. 텍스트 값 (Low, High, Negative, 음성 등)
  return {
    numeric: null,
    display: value,
    type: 'text',
    hasError: false
  }
}

/**
 * 파싱된 값을 표시용 문자열로 변환
 * 이상 여부 표시 포함: "7.20 (H)", "6.1 (L)"
 */
export function formatValueWithStatus(
  value: ParsedValue,
  isAbnormal?: boolean,
  direction?: 'high' | 'low' | null
): string {
  if (!value.display) return '-'

  let formatted = value.display

  if (isAbnormal && direction) {
    const marker = direction === 'high' ? '(H)' : '(L)'
    formatted = `${formatted} ${marker}`
  }

  return formatted
}

/**
 * 값이 유효한 숫자인지 확인
 */
export function isNumericValue(parsed: ParsedValue): boolean {
  return parsed.numeric !== null &&
         (parsed.type === 'numeric' || parsed.type === 'less_than' || parsed.type === 'greater_than')
}
