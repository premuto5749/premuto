/**
 * 항목 정보 조회 유틸리티
 *
 * test_results.standard_item_id가 standard_items_master 또는 user_standard_items
 * 양쪽을 참조할 수 있으므로, 양쪽 테이블에서 항목 정보를 조회하는 공통 함수.
 *
 * DB의 resolve_standard_items RPC를 호출하여
 * - 마스터 항목: 사용자 오버라이드 적용
 * - 커스텀 항목: user_standard_items에서 직접 조회
 */

import { createClient as createServerClient } from '@/lib/supabase/server'

type SupabaseClientType = Awaited<ReturnType<typeof createServerClient>>

export interface ResolvedItem {
  item_id: string
  name: string
  display_name_ko: string | null
  category: string | null
  default_unit: string | null
  exam_type: string | null
  organ_tags: string[] | null
  description_common: string | null
  description_high: string | null
  description_low: string | null
  source_table: 'master' | 'user_custom'
}

/**
 * 주어진 standard_item_id 목록에 대해 항목 정보를 조회
 * standard_items_master + user_standard_items 양쪽에서 찾음
 *
 * @returns Map<item_id, ResolvedItem>
 */
export async function resolveStandardItems(
  itemIds: string[],
  userId: string,
  supabase?: SupabaseClientType
): Promise<Map<string, ResolvedItem>> {
  if (itemIds.length === 0) {
    return new Map()
  }

  const client = supabase || await createServerClient()

  // 중복 제거
  const uniqueIds = [...new Set(itemIds)]

  const { data, error } = await client.rpc('resolve_standard_items', {
    p_item_ids: uniqueIds,
    p_user_id: userId,
  })

  if (error) {
    console.error('Failed to resolve standard items:', error)
    throw new Error(`Failed to resolve standard items: ${error.message}`)
  }

  const result = new Map<string, ResolvedItem>()
  for (const item of (data || [])) {
    result.set(item.item_id, item as ResolvedItem)
  }

  return result
}

/**
 * test_results 배열에 항목 정보를 주입
 * PostgREST의 relation join을 대체
 *
 * 기존 형태: test_result.standard_items_master = { name, display_name_ko, ... }
 * 새 형태:   test_result.standard_items_master = { name, display_name_ko, ... } (동일)
 *
 * → 프론트엔드 변경 불필요
 */
export async function enrichTestResultsWithItems<
  T extends { standard_item_id: string | null }
>(
  testResults: T[],
  userId: string,
  supabase?: SupabaseClientType,
  fields?: (keyof ResolvedItem)[]
): Promise<(T & { standard_items_master: Partial<ResolvedItem> | null })[]> {
  // standard_item_id 수집
  const itemIds = testResults
    .map(r => r.standard_item_id)
    .filter((id): id is string => id !== null)

  if (itemIds.length === 0) {
    return testResults.map(r => ({ ...r, standard_items_master: null }))
  }

  const resolvedMap = await resolveStandardItems(itemIds, userId, supabase)

  return testResults.map(r => {
    if (!r.standard_item_id) {
      return { ...r, standard_items_master: null }
    }

    const resolved = resolvedMap.get(r.standard_item_id)
    if (!resolved) {
      return { ...r, standard_items_master: null }
    }

    // 요청된 필드만 추출 (기본: 모든 필드)
    if (fields) {
      const filtered: Partial<ResolvedItem> = {}
      for (const f of fields) {
        (filtered as Record<string, unknown>)[f as string] = resolved[f]
      }
      return { ...r, standard_items_master: filtered }
    }

    return { ...r, standard_items_master: resolved }
  })
}

/**
 * standard_item_id가 유효한지 확인 (양쪽 테이블에서)
 * test-results-batch의 FK 검증을 대체
 */
export async function validateStandardItemIds(
  itemIds: string[],
  userId: string,
  supabase?: SupabaseClientType
): Promise<{ validIds: Set<string>; invalidIds: string[] }> {
  const resolvedMap = await resolveStandardItems(itemIds, userId, supabase)

  const validIds = new Set(resolvedMap.keys())
  const invalidIds = itemIds.filter(id => !validIds.has(id))

  return { validIds, invalidIds }
}
