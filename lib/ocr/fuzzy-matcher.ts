/**
 * 퍼지 매칭 유틸리티
 * 레벤슈타인 거리 기반 유사도 계산
 */

/**
 * 레벤슈타인 거리 계산
 * 두 문자열 사이의 편집 거리 (삽입, 삭제, 치환)
 */
export function levenshteinDistance(a: string, b: string): number {
  const aLen = a.length
  const bLen = b.length

  // 빈 문자열 처리
  if (aLen === 0) return bLen
  if (bLen === 0) return aLen

  // DP 테이블
  const dp: number[][] = Array(aLen + 1)
    .fill(null)
    .map(() => Array(bLen + 1).fill(0))

  // 초기화
  for (let i = 0; i <= aLen; i++) dp[i][0] = i
  for (let j = 0; j <= bLen; j++) dp[0][j] = j

  // DP
  for (let i = 1; i <= aLen; i++) {
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // 삭제
        dp[i][j - 1] + 1,      // 삽입
        dp[i - 1][j - 1] + cost // 치환
      )
    }
  }

  return dp[aLen][bLen]
}

/**
 * 문자열 유사도 계산 (0.0 ~ 1.0)
 * 1.0 = 완전 일치, 0.0 = 완전 불일치
 */
export function similarity(a: string, b: string): number {
  if (a === b) return 1.0
  if (a.length === 0 || b.length === 0) return 0.0

  const distance = levenshteinDistance(a, b)
  const maxLength = Math.max(a.length, b.length)

  return 1.0 - distance / maxLength
}

/**
 * 문자열 정규화 (비교 전 전처리)
 * - 대소문자 통일
 * - 공백/특수문자 제거
 */
export function normalizeForComparison(str: string): string {
  return str
    .toUpperCase()
    .replace(/[*_\-\(\)\s\[\]\.\/]/g, '') // 특수문자 제거
    .replace(/\d+$/, '') // 끝에 붙은 숫자 제거 (예: cPL_V100 → cPL_V)
    .trim()
}

/**
 * 정규화된 유사도 계산
 */
export function normalizedSimilarity(a: string, b: string): number {
  const normalizedA = normalizeForComparison(a)
  const normalizedB = normalizeForComparison(b)
  return similarity(normalizedA, normalizedB)
}

/**
 * 후보 목록에서 가장 유사한 항목 찾기
 */
export interface FuzzyMatchResult {
  match: string | null
  similarity: number
  originalQuery: string
}

export function findBestMatch(
  query: string,
  candidates: string[],
  threshold: number = 0.7
): FuzzyMatchResult {
  if (candidates.length === 0) {
    return { match: null, similarity: 0, originalQuery: query }
  }

  const normalizedQuery = normalizeForComparison(query)

  let bestMatch: string | null = null
  let bestSimilarity = 0

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeForComparison(candidate)
    const sim = similarity(normalizedQuery, normalizedCandidate)

    if (sim > bestSimilarity) {
      bestSimilarity = sim
      bestMatch = candidate
    }
  }

  // 임계값 이하면 매칭 실패
  if (bestSimilarity < threshold) {
    return { match: null, similarity: bestSimilarity, originalQuery: query }
  }

  return {
    match: bestMatch,
    similarity: bestSimilarity,
    originalQuery: query
  }
}

/**
 * 여러 후보 중 임계값 이상인 모든 매칭 반환
 */
export function findAllMatches(
  query: string,
  candidates: string[],
  threshold: number = 0.7
): Array<{ candidate: string; similarity: number }> {
  const normalizedQuery = normalizeForComparison(query)
  const results: Array<{ candidate: string; similarity: number }> = []

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeForComparison(candidate)
    const sim = similarity(normalizedQuery, normalizedCandidate)

    if (sim >= threshold) {
      results.push({ candidate, similarity: sim })
    }
  }

  // 유사도 내림차순 정렬
  results.sort((a, b) => b.similarity - a.similarity)

  return results
}
