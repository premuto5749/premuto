/**
 * 항목 매칭 유틸리티
 * 4단계 매칭 전략:
 * 1. 완전 일치 (대소문자 무시) → 신뢰도 100%
 * 2. 별칭 테이블 조회 → 신뢰도 95%
 * 3. 정규식 패턴 매칭 → 신뢰도 90%
 * 4. 퍼지 매칭 (70%+ 유사도) → 신뢰도 70-89%
 */

import { findBestMatch } from './fuzzy-matcher'
import mappingConfig from '@/config/item_mapping.json'

export type MatchMethod = 'exact' | 'alias' | 'pattern' | 'fuzzy' | 'none'

export interface MatchResult {
  standardItemName: string | null
  displayNameKo: string | null
  category: string | null
  confidence: number
  method: MatchMethod
  matchedAgainst?: string  // 어떤 값과 매칭되었는지
}

interface MappingItem {
  category: string
  display_name_ko: string
  aliases: string[]
  patterns: string[]
  default_unit: string
  default_reference: string
}

interface MappingConfig {
  version: string
  mappings: Record<string, MappingItem>
  categories: Record<string, { order: number; color: string; description: string }>
}

// 전역 매핑 설정 캐시
let cachedMappings: Map<string, { standardName: string; item: MappingItem }> | null = null
let cachedAliasIndex: Map<string, string> | null = null
let cachedPatterns: Array<{ regex: RegExp; standardName: string }> | null = null

/**
 * 매핑 설정 초기화 (lazy loading)
 */
function initializeMappings() {
  if (cachedMappings !== null) return

  const config = mappingConfig as MappingConfig

  // 1. 표준 항목 맵 생성
  cachedMappings = new Map()
  for (const [standardName, item] of Object.entries(config.mappings)) {
    cachedMappings.set(standardName.toUpperCase(), { standardName, item })
  }

  // 2. 별칭 인덱스 생성 (별칭 → 표준 항목명)
  cachedAliasIndex = new Map()
  for (const [standardName, item] of Object.entries(config.mappings)) {
    for (const alias of item.aliases) {
      cachedAliasIndex.set(alias.toUpperCase(), standardName)
    }
  }

  // 3. 패턴 목록 컴파일
  cachedPatterns = []
  for (const [standardName, item] of Object.entries(config.mappings)) {
    for (const pattern of item.patterns) {
      try {
        cachedPatterns.push({
          regex: new RegExp(pattern, 'i'),
          standardName
        })
      } catch (e) {
        console.warn(`Invalid regex pattern for ${standardName}: ${pattern}`, e)
      }
    }
  }
}

/**
 * 항목명 매칭
 */
export function matchItem(rawName: string): MatchResult {
  initializeMappings()

  if (!rawName || !cachedMappings || !cachedAliasIndex || !cachedPatterns) {
    return {
      standardItemName: null,
      displayNameKo: null,
      category: null,
      confidence: 0,
      method: 'none'
    }
  }

  const normalizedRaw = rawName.toUpperCase().trim()

  // 1단계: 완전 일치 (표준 항목명 직접 매칭)
  const exactMatch = cachedMappings.get(normalizedRaw)
  if (exactMatch) {
    return {
      standardItemName: exactMatch.standardName,
      displayNameKo: exactMatch.item.display_name_ko,
      category: exactMatch.item.category,
      confidence: 100,
      method: 'exact',
      matchedAgainst: exactMatch.standardName
    }
  }

  // 2단계: 별칭 매칭
  const aliasMatch = cachedAliasIndex.get(normalizedRaw)
  if (aliasMatch) {
    const item = cachedMappings.get(aliasMatch.toUpperCase())
    if (item) {
      return {
        standardItemName: aliasMatch,
        displayNameKo: item.item.display_name_ko,
        category: item.item.category,
        confidence: 95,
        method: 'alias',
        matchedAgainst: rawName
      }
    }
  }

  // 3단계: 패턴 매칭
  for (const { regex, standardName } of cachedPatterns) {
    if (regex.test(rawName)) {
      const item = cachedMappings.get(standardName.toUpperCase())
      if (item) {
        return {
          standardItemName: standardName,
          displayNameKo: item.item.display_name_ko,
          category: item.item.category,
          confidence: 90,
          method: 'pattern',
          matchedAgainst: regex.source
        }
      }
    }
  }

  // 4단계: 퍼지 매칭
  const allAliases: string[] = []
  const aliasToStandard: Map<string, string> = new Map()

  for (const [standardName, item] of Object.entries((mappingConfig as MappingConfig).mappings)) {
    for (const alias of item.aliases) {
      allAliases.push(alias)
      aliasToStandard.set(alias, standardName)
    }
  }

  const fuzzyResult = findBestMatch(rawName, allAliases, 0.7)

  if (fuzzyResult.match) {
    const standardName = aliasToStandard.get(fuzzyResult.match)
    if (standardName) {
      const item = cachedMappings.get(standardName.toUpperCase())
      if (item) {
        // 유사도를 신뢰도로 변환 (70-100% → 70-89%)
        const confidence = Math.round(70 + (fuzzyResult.similarity - 0.7) * 63.33)

        return {
          standardItemName: standardName,
          displayNameKo: item.item.display_name_ko,
          category: item.item.category,
          confidence: Math.min(confidence, 89), // 최대 89%
          method: 'fuzzy',
          matchedAgainst: fuzzyResult.match
        }
      }
    }
  }

  // 매칭 실패
  return {
    standardItemName: null,
    displayNameKo: null,
    category: null,
    confidence: 0,
    method: 'none'
  }
}

/**
 * 여러 항목 일괄 매칭
 */
export function matchItems(rawNames: string[]): MatchResult[] {
  return rawNames.map(name => matchItem(name))
}

/**
 * 표준 항목 정보 조회
 */
export function getStandardItem(standardName: string): MappingItem | null {
  initializeMappings()

  if (!cachedMappings) return null

  const item = cachedMappings.get(standardName.toUpperCase())
  return item?.item || null
}

/**
 * 모든 표준 항목 목록 반환
 */
export function getAllStandardItemNames(): string[] {
  initializeMappings()

  if (!cachedMappings) return []

  return Array.from(cachedMappings.values()).map(v => v.standardName)
}

/**
 * 카테고리 정보 조회
 */
export function getCategoryInfo(categoryName: string): { order: number; color: string; description: string } | null {
  const config = mappingConfig as MappingConfig
  return config.categories[categoryName] || null
}

/**
 * 모든 카테고리 목록 반환 (정렬된)
 */
export function getAllCategories(): Array<{ name: string; order: number; color: string; description: string }> {
  const config = mappingConfig as MappingConfig

  return Object.entries(config.categories)
    .map(([name, info]) => ({ name, ...info }))
    .sort((a, b) => a.order - b.order)
}

/**
 * 캐시 초기화 (테스트용)
 */
export function clearCache() {
  cachedMappings = null
  cachedAliasIndex = null
  cachedPatterns = null
}
