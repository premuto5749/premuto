/**
 * 단위 문자열 정규화 유틸리티
 *
 * 같은 단위의 다양한 표기를 표준 형식으로 통일
 * 예: mg/100mL, mg %, mg/dl → mg/dL
 *
 * config/unit_mappings.json에서 별칭 및 보정 규칙을 로드합니다.
 */

import unitConfig from '@/config/unit_mappings.json'

// config에서 flat aliases 맵 생성 (카테고리 구조를 평탄화)
function buildUnitAliases(): Record<string, string[]> {
  const flat: Record<string, string[]> = {}
  const categories = unitConfig.unit_aliases as Record<string, Record<string, string[]>>
  for (const category of Object.values(categories)) {
    for (const [standard, aliases] of Object.entries(category)) {
      flat[standard] = aliases
    }
  }
  return flat
}

const UNIT_ALIASES = buildUnitAliases()

// 역방향 맵 생성 (별칭 → 표준)
const aliasToStandard: Map<string, string> = new Map()

function initializeAliasMap() {
  if (aliasToStandard.size > 0) return

  for (const [standard, aliases] of Object.entries(UNIT_ALIASES)) {
    for (const alias of aliases) {
      aliasToStandard.set(alias.toLowerCase(), standard)
    }
  }
}

/**
 * 단위 문자열 정규화
 * @param rawUnit 원본 단위 문자열
 * @returns 표준화된 단위 문자열
 */
export function normalizeUnit(rawUnit: string | null | undefined): string {
  if (!rawUnit) return ''

  initializeAliasMap()

  // 공백 및 특수문자 정리
  const cleaned = rawUnit
    .trim()
    .replace(/\s+/g, '')  // 모든 공백 제거

  // 대소문자 무시 검색
  const standard = aliasToStandard.get(cleaned.toLowerCase())
  if (standard) {
    return standard
  }

  // 매핑에 없으면 원본 그대로 반환 (첫글자 대문자화 등 시도)
  return cleaned
}

/**
 * 두 단위가 동일한지 비교 (정규화 후 비교)
 */
export function unitsAreEquivalent(unit1: string, unit2: string): boolean {
  const normalized1 = normalizeUnit(unit1)
  const normalized2 = normalizeUnit(unit2)
  return normalized1.toLowerCase() === normalized2.toLowerCase()
}

/**
 * 특정 단위의 모든 별칭 반환
 */
export function getUnitAliases(standardUnit: string): string[] {
  return UNIT_ALIASES[standardUnit] || [standardUnit]
}

/**
 * 표준 단위 목록 반환
 */
export function getAllStandardUnits(): string[] {
  return Object.keys(UNIT_ALIASES)
}

/**
 * 단위가 특정 카테고리에 속하는지 확인
 */
export type UnitCategory =
  | 'concentration'  // 농도 (mg/dL, g/dL 등)
  | 'enzyme'         // 효소 활성도 (U/L)
  | 'cell_count'     // 혈구 수 (K/μL, M/μL)
  | 'percentage'     // 백분율 (%)
  | 'volume'         // 부피 (fL)
  | 'mass'           // 질량 (pg)
  | 'electrolyte'    // 전해질 (mEq/L, mmol/L)
  | 'pressure'       // 압력 (mmHg, kPa)
  | 'time'           // 시간 (sec, min)
  | 'other'          // 기타

// config에서 카테고리별 표준 단위 맵 생성
function buildUnitCategories(): Record<UnitCategory, string[]> {
  const result: Record<string, string[]> = {}
  const categories = unitConfig.unit_aliases as Record<string, Record<string, string[]>>
  for (const [categoryName, units] of Object.entries(categories)) {
    result[categoryName] = Object.keys(units)
  }
  return result as Record<UnitCategory, string[]>
}

const UNIT_CATEGORIES = buildUnitCategories()

export function getUnitCategory(unit: string): UnitCategory {
  const normalized = normalizeUnit(unit)

  for (const [category, units] of Object.entries(UNIT_CATEGORIES)) {
    if (units.includes(normalized)) {
      return category as UnitCategory
    }
  }

  return 'other'
}

/**
 * 단위 표시 포맷팅 (UI용)
 */
export function formatUnitDisplay(unit: string): string {
  const normalized = normalizeUnit(unit)

  // 특수 문자 변환 (HTML 친화적)
  return normalized
    .replace(/μ/g, 'μ')  // 이미 유니코드
    .replace(/\^(\d+)/g, '<sup>$1</sup>')  // 지수 표기
}
