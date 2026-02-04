/**
 * 항목 매칭 유틸리티 v3
 * 하이브리드 5단계 매칭 전략 (DB 기반):
 *
 * 1. 정규 항목 exact match (DB standard_items) → 신뢰도 100%
 * 2. Alias 테이블 exact match (DB item_aliases) → 신뢰도 95% + source_hint
 * 3. 퍼지 매칭 (Levenshtein 70%+) → 신뢰도 70-89%
 * 4. AI 판단 (Claude API) → AI가 반환한 신뢰도
 * 5. 신규 항목 등록 요청 → 신뢰도 0 (사용자 확인 필요)
 */

import { createClient as createServerClient } from '@/lib/supabase/server';
import { findBestMatch } from './fuzzy-matcher';

// Supabase client type (awaited)
type SupabaseClientType = Awaited<ReturnType<typeof createServerClient>>;

export type MatchMethodV3 =
  | 'exact'          // Step 1: 정규 항목 직접 매칭
  | 'alias'          // Step 2: Alias 테이블 매칭
  | 'fuzzy'          // Step 3: 퍼지 매칭
  | 'ai_match'       // Step 4: AI가 기존 항목 변형으로 판단
  | 'ai_new'         // Step 5: AI가 신규 항목으로 판단
  | 'none';          // 매칭 실패

export interface MatchResultV3 {
  standardItemId: string | null;
  standardItemName: string | null;
  displayNameKo: string | null;
  examType: string | null;
  organTags: string[] | null;
  confidence: number;
  method: MatchMethodV3;
  matchedAgainst?: string;
  sourceHint?: string | null;  // 장비/병원 힌트
  // 신규 항목 추천 (method === 'ai_new'일 때)
  suggestedNewItem?: {
    name: string;
    displayNameKo: string;
    examType: string;
    organTags: string[];
    reasoning: string;
  };
}

export interface StandardItem {
  id: string;
  name: string;
  display_name_ko: string | null;
  exam_type: string | null;
  organ_tags: string[] | null;
  category: string | null;
  default_unit: string | null;
}

export interface ItemAlias {
  id: string;
  alias: string;
  canonical_name: string;
  source_hint: string | null;
  standard_item_id: string;
  standard_item?: StandardItem;
}

// 캐시 (서버 사이드에서 재사용, 사용자별로 구분)
let cachedStandardItems: Map<string, StandardItem> | null = null;
let cachedAliases: Map<string, ItemAlias> | null = null;
let cacheTimestamp: number = 0;
let cachedUserId: string | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5분

/**
 * 캐시 초기화 (DB에서 로드, 사용자 오버라이드 병합)
 */
async function initializeCache(supabase: SupabaseClientType, userId?: string) {
  const now = Date.now();

  // 캐시가 유효하고 같은 사용자면 재사용
  if (cachedStandardItems && cachedAliases &&
      (now - cacheTimestamp) < CACHE_TTL &&
      cachedUserId === userId) {
    return;
  }

  // 사용자가 있으면 오버라이드 병합 데이터 사용
  if (userId) {
    // get_user_standard_items 함수 호출
    const { data: items, error: itemsError } = await supabase
      .rpc('get_user_standard_items', { p_user_id: userId });

    if (!itemsError && items) {
      cachedStandardItems = new Map();
      for (const item of items) {
        cachedStandardItems.set(item.name.toUpperCase(), item as StandardItem);
      }
    }

    // get_user_item_aliases 함수 호출
    const { data: aliases, error: aliasesError } = await supabase
      .rpc('get_user_item_aliases', { p_user_id: userId });

    if (!aliasesError && aliases) {
      cachedAliases = new Map();
      for (const alias of aliases) {
        cachedAliases.set(alias.alias.toUpperCase(), alias as ItemAlias);
      }
    }

    cachedUserId = userId;
    cacheTimestamp = now;
    return;
  }

  // 비로그인 시 마스터 테이블만 사용
  const { data: items } = await supabase
    .from('standard_items_master')
    .select('id, name, display_name_ko, exam_type, organ_tags, category, default_unit');

  cachedStandardItems = new Map();
  for (const item of items || []) {
    cachedStandardItems.set(item.name.toUpperCase(), item as StandardItem);
  }

  const { data: aliases } = await supabase
    .from('item_aliases_master')
    .select('id, alias, canonical_name, source_hint, standard_item_id');

  cachedAliases = new Map();
  for (const alias of aliases || []) {
    cachedAliases.set(alias.alias.toUpperCase(), alias as ItemAlias);
  }

  cachedUserId = null;
  cacheTimestamp = now;
}

/**
 * 하이브리드 5단계 매칭 (Step 1-3: DB 기반)
 * AI 판단(Step 4-5)은 별도 함수로 분리
 */
export async function matchItemV3(
  rawName: string,
  options: {
    supabase?: SupabaseClientType;
    skipFuzzy?: boolean;
    userId?: string;
  } = {}
): Promise<MatchResultV3> {
  const supabase = options.supabase || (await createServerClient());

  await initializeCache(supabase, options.userId);

  if (!rawName || !cachedStandardItems || !cachedAliases) {
    return createEmptyResult();
  }

  const normalizedRaw = rawName.toUpperCase().trim();

  // ============================================
  // Step 1: 정규 항목 exact match
  // ============================================
  const exactMatch = cachedStandardItems.get(normalizedRaw);
  if (exactMatch) {
    return {
      standardItemId: exactMatch.id,
      standardItemName: exactMatch.name,
      displayNameKo: exactMatch.display_name_ko,
      examType: exactMatch.exam_type || exactMatch.category,
      organTags: exactMatch.organ_tags,
      confidence: 100,
      method: 'exact',
      matchedAgainst: exactMatch.name,
    };
  }

  // ============================================
  // Step 2: Alias 테이블 exact match
  // ============================================
  const aliasMatch = cachedAliases.get(normalizedRaw);
  if (aliasMatch) {
    const standardItem = cachedStandardItems.get(aliasMatch.canonical_name.toUpperCase());
    if (standardItem) {
      return {
        standardItemId: standardItem.id,
        standardItemName: standardItem.name,
        displayNameKo: standardItem.display_name_ko,
        examType: standardItem.exam_type || standardItem.category,
        organTags: standardItem.organ_tags,
        confidence: 95,
        method: 'alias',
        matchedAgainst: aliasMatch.alias,
        sourceHint: aliasMatch.source_hint,
      };
    }
  }

  // ============================================
  // Step 3: 퍼지 매칭
  // ============================================
  if (!options.skipFuzzy) {
    // 모든 항목명과 별칭을 후보로
    const candidates: Array<{ name: string; standardName: string }> = [];

    for (const [, item] of cachedStandardItems) {
      candidates.push({ name: item.name, standardName: item.name });
    }
    for (const [, alias] of cachedAliases) {
      candidates.push({ name: alias.alias, standardName: alias.canonical_name });
    }

    const candidateNames = candidates.map(c => c.name);
    const fuzzyResult = findBestMatch(rawName, candidateNames, 0.7);

    if (fuzzyResult.match) {
      const matched = candidates.find(c => c.name === fuzzyResult.match);
      if (matched) {
        const standardItem = cachedStandardItems.get(matched.standardName.toUpperCase());
        if (standardItem) {
          // 유사도를 신뢰도로 변환 (70-100% → 70-89%)
          const confidence = Math.round(70 + (fuzzyResult.similarity - 0.7) * 63.33);

          return {
            standardItemId: standardItem.id,
            standardItemName: standardItem.name,
            displayNameKo: standardItem.display_name_ko,
            examType: standardItem.exam_type || standardItem.category,
            organTags: standardItem.organ_tags,
            confidence: Math.min(confidence, 89),
            method: 'fuzzy',
            matchedAgainst: fuzzyResult.match,
          };
        }
      }
    }
  }

  // 매칭 실패 (Step 4-5는 AI 호출 필요)
  return createEmptyResult();
}

/**
 * 여러 항목 일괄 매칭 (Step 1-3만)
 */
export async function matchItemsV3(
  rawNames: string[],
  options: {
    supabase?: SupabaseClientType;
    userId?: string;
  } = {}
): Promise<MatchResultV3[]> {
  const supabase = options.supabase || (await createServerClient());

  // 캐시 한 번만 초기화 (사용자 오버라이드 반영)
  await initializeCache(supabase, options.userId);

  return Promise.all(
    rawNames.map(name => matchItemV3(name, { supabase, skipFuzzy: false, userId: options.userId }))
  );
}

/**
 * 새 별칭 등록 (AI 매칭 후 자동 학습, 사용자별 저장)
 */
export async function registerNewAlias(
  alias: string,
  canonicalName: string,
  sourceHint: string | null,
  supabase?: SupabaseClientType,
  userId?: string
): Promise<boolean> {
  const client = supabase || (await createServerClient());

  // standard_item_id 조회 (마스터 테이블에서)
  const { data: item } = await client
    .from('standard_items_master')
    .select('id')
    .ilike('name', canonicalName)
    .single();

  if (!item) {
    console.error(`Cannot register alias: standard item ${canonicalName} not found`);
    return false;
  }

  // 사용자가 있으면 사용자 테이블에 저장
  if (userId) {
    const { error } = await client
      .from('user_item_aliases')
      .upsert({
        user_id: userId,
        master_alias_id: null,
        alias,
        canonical_name: canonicalName,
        source_hint: sourceHint,
        standard_item_id: item.id,
      }, {
        onConflict: 'user_id,alias',
      });

    if (error) {
      console.error('Failed to register user alias:', error);
      return false;
    }
  } else {
    // 사용자 없으면 마스터 테이블에 저장 (관리자용)
    const { error } = await client
      .from('item_aliases_master')
      .upsert({
        alias,
        canonical_name: canonicalName,
        source_hint: sourceHint,
        standard_item_id: item.id,
      }, {
        onConflict: 'alias',
      });

    if (error) {
      console.error('Failed to register alias:', error);
      return false;
    }
  }

  // 캐시 무효화
  clearCacheV3();
  return true;
}

/**
 * 신규 항목 등록 (사용자 확인 후, 사용자별 저장)
 */
export async function registerNewStandardItem(
  item: {
    name: string;
    displayNameKo: string;
    unit: string;
    examType: string;
    organTags: string[];
  },
  supabase?: SupabaseClientType,
  userId?: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const client = supabase || (await createServerClient());

  // 사용자가 있으면 사용자 테이블에 저장
  if (userId) {
    const { data, error } = await client
      .from('user_standard_items')
      .insert({
        user_id: userId,
        master_item_id: null,
        name: item.name,
        display_name_ko: item.displayNameKo,
        default_unit: item.unit,
        category: item.examType,
        exam_type: item.examType,
        organ_tags: item.organTags,
      })
      .select('id')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    clearCacheV3();
    return { success: true, id: data.id };
  }

  // 사용자 없으면 마스터 테이블에 저장 (관리자용)
  const { data, error } = await client
    .from('standard_items_master')
    .insert({
      name: item.name,
      display_name_ko: item.displayNameKo,
      default_unit: item.unit,
      category: item.examType,
      exam_type: item.examType,
      organ_tags: item.organTags,
    })
    .select('id')
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  // 캐시 무효화
  clearCacheV3();
  return { success: true, id: data.id };
}

/**
 * 모든 표준 항목 조회 (정렬 포함, 사용자 오버라이드 병합)
 */
export async function getAllStandardItemsV3(
  sortBy: 'exam_type' | 'name' = 'exam_type',
  supabase?: SupabaseClientType,
  userId?: string
): Promise<StandardItem[]> {
  const client = supabase || (await createServerClient());

  const examTypeOrder = [
    'Vital', 'CBC', 'Chemistry', 'Special', 'Blood Gas',
    'Coagulation', '뇨검사', '안과검사', 'Echo'
  ];

  let data: StandardItem[] | null = null;

  // 사용자가 있으면 오버라이드 병합 데이터 사용
  if (userId) {
    const { data: mergedData } = await client
      .rpc('get_user_standard_items', { p_user_id: userId });
    data = mergedData;
  } else {
    const { data: masterData } = await client
      .from('standard_items_master')
      .select('id, name, display_name_ko, exam_type, organ_tags, category, default_unit')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    data = masterData;
  }

  if (!data) return [];

  if (sortBy === 'exam_type') {
    return data.sort((a, b) => {
      const aType = a.exam_type || a.category || '';
      const bType = b.exam_type || b.category || '';
      const aOrder = examTypeOrder.indexOf(aType);
      const bOrder = examTypeOrder.indexOf(bType);
      if (aOrder !== bOrder) {
        return (aOrder === -1 ? 999 : aOrder) - (bOrder === -1 ? 999 : bOrder);
      }
      return a.name.localeCompare(b.name);
    });
  }

  return data as StandardItem[];
}

/**
 * 장기별 항목 조회
 */
export async function getItemsByOrgan(
  organ: string,
  supabase?: SupabaseClientType
): Promise<StandardItem[]> {
  const client = supabase || (await createServerClient());

  const { data } = await client
    .from('standard_items_master')
    .select('id, name, display_name_ko, exam_type, organ_tags, category, default_unit')
    .contains('organ_tags', [organ]);

  return (data || []) as StandardItem[];
}

/**
 * 정렬 설정 조회
 */
export async function getSortOrderConfig(
  sortType: string,
  supabase?: SupabaseClientType
): Promise<Record<string, unknown> | null> {
  const client = supabase || (await createServerClient());

  const { data } = await client
    .from('sort_order_configs')
    .select('config')
    .eq('sort_type', sortType)
    .single();

  return data?.config || null;
}

/**
 * 빈 결과 생성
 */
function createEmptyResult(): MatchResultV3 {
  return {
    standardItemId: null,
    standardItemName: null,
    displayNameKo: null,
    examType: null,
    organTags: null,
    confidence: 0,
    method: 'none',
  };
}

/**
 * 캐시 초기화
 */
export function clearCacheV3() {
  cachedStandardItems = null;
  cachedAliases = null;
  cacheTimestamp = 0;
}
