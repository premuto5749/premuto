/**
 * 단위 문자열 정규화 유틸리티
 *
 * 같은 단위의 다양한 표기를 표준 형식으로 통일
 * 예: mg/100mL, mg %, mg/dl → mg/dL
 */

// 표준 단위 매핑 (동의어 → 표준)
const UNIT_ALIASES: Record<string, string[]> = {
  // 농도 단위
  'mg/dL': ['mg/dL', 'mg/dl', 'mg/100mL', 'mg/100ml', 'mg %', 'mg%'],
  'g/dL': ['g/dL', 'g/dl', 'g/100mL', 'g/100ml', 'g %', 'g%', 'gm/dl'],
  'μg/dL': ['μg/dL', 'ug/dL', 'mcg/dL', 'μg/dl', 'ug/dl', 'mcg/dl'],
  'ng/mL': ['ng/mL', 'ng/ml'],
  'pg/mL': ['pg/mL', 'pg/ml'],
  'μg/mL': ['μg/mL', 'ug/mL', 'mcg/mL', 'μg/ml', 'ug/ml', 'mcg/ml'],

  // 효소 활성도
  'U/L': ['U/L', 'U/l', 'IU/L', 'IU/l', 'u/L', 'u/l'],
  'mU/L': ['mU/L', 'mU/l', 'mIU/L'],

  // 혈구 수
  'K/μL': ['K/μL', 'K/uL', 'K/ul', '10^3/μL', '10^3/uL', 'x10^3/μL', 'x10^3/uL', '10³/μL', 'thou/uL', 'K/µL'],
  'M/μL': ['M/μL', 'M/uL', 'M/ul', '10^6/μL', '10^6/uL', 'x10^6/μL', 'x10^6/uL', '10⁶/μL', 'mil/uL', 'M/µL'],
  '/μL': ['/μL', '/uL', '/ul', '/µL', 'cells/uL', 'cells/μL'],

  // 백분율
  '%': ['%', 'percent', 'pct'],

  // 부피/시간
  'fL': ['fL', 'fl', 'femtoliter', 'femtoliters'],
  'pg': ['pg', 'picogram', 'picograms'],

  // 삼투압
  'mOsm/kg': ['mOsm/kg', 'mosm/kg', 'mOsm/Kg', 'mosmol/kg'],
  'mOsm/L': ['mOsm/L', 'mosm/L', 'mosm/l'],

  // 전해질
  'mEq/L': ['mEq/L', 'meq/L', 'mEq/l', 'meq/l', 'mmol/L'],
  'mmol/L': ['mmol/L', 'mmol/l', 'mM'],

  // 시간
  'sec': ['sec', 's', 'seconds', 'secs'],
  'min': ['min', 'minutes', 'mins'],

  // 기타
  'g/L': ['g/L', 'g/l'],
  'mg/L': ['mg/L', 'mg/l'],
  'ratio': ['ratio', 'Ratio'],
  'index': ['index', 'Index'],
}

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
  | 'time'           // 시간 (sec, min)
  | 'other'          // 기타

const UNIT_CATEGORIES: Record<UnitCategory, string[]> = {
  concentration: ['mg/dL', 'g/dL', 'μg/dL', 'ng/mL', 'pg/mL', 'μg/mL', 'g/L', 'mg/L'],
  enzyme: ['U/L', 'mU/L'],
  cell_count: ['K/μL', 'M/μL', '/μL'],
  percentage: ['%'],
  volume: ['fL'],
  mass: ['pg'],
  electrolyte: ['mEq/L', 'mmol/L'],
  time: ['sec', 'min'],
  other: ['mOsm/kg', 'mOsm/L', 'ratio', 'index']
}

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
