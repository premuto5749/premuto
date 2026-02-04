/**
 * 항목 매칭 유틸리티 v3
 * 하이브리드 4단계 매칭 전략 (DB 기반):
 *
 * Step 0: 가비지 필터링 → 항목이 아닌 것 버림
 * Step 1: 정규 항목 exact match (DB standard_items) → 신뢰도 100%
 * Step 2: Alias 테이블 exact match (DB item_aliases) → 신뢰도 95% + source_hint
 * Step 3: AI 판단 (Claude API) → match(기존 변형) 또는 new(신규)
 *         → confidence < 0.7이면 Unmapped로 저장
 */

import { createClient as createServerClient } from '@/lib/supabase/server';

// Supabase client type (awaited)
type SupabaseClientType = Awaited<ReturnType<typeof createServerClient>>;

export type MatchMethodV3 =
  | 'garbage'        // Step 0: 가비지로 필터링됨
  | 'exact'          // Step 1: 정규 항목 직접 매칭
  | 'alias'          // Step 2: Alias 테이블 매칭
  | 'ai_match'       // Step 3: AI가 기존 항목 변형으로 판단
  | 'ai_new'         // Step 3: AI가 신규 항목으로 판단
  | 'none';          // 매칭 실패 (Unmapped)

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
  isGarbage?: boolean;         // Step 0에서 가비지로 판정됨
  garbageReason?: string;      // 가비지 판정 이유
  hasTruncatedBracket?: boolean; // 닫히지 않은 괄호 감지
  // 신규 항목 추천 (method === 'ai_new'일 때)
  suggestedNewItem?: {
    name: string;
    displayNameKo: string;
    unit: string;
    examType: string;
    organTags: string[];
    descriptionCommon: string;
    descriptionHigh: string;
    descriptionLow: string;
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

// ============================================
// Step 0: 가비지 필터링 유틸리티
// ============================================

// 가비지로 판정되는 카테고리 라벨들
const GARBAGE_LABELS = [
  '기타', '결과', '항목', '단위', '참고치', '검사항목', '검사결과', '정상범위',
  'Result', 'Unit', 'Reference', 'Normal', 'Range', 'Value', 'Test',
];

// 숫자/범위 패턴 (항목이 아닌 값)
const GARBAGE_NUMERIC_PATTERNS = [
  /^[<>≤≥±]\s*\d/,                    // < 0.25, > 2.0, ≤ 10, ± 0.5
  /^\d+[.,]?\d*\s*[-~]\s*\d+[.,]?\d*/, // 0.26 - 0.5, 1~10, 0,5-1,0
  /^\d+[.,]?\d*$/,                     // 순수 숫자: 0.25, 123, 0,5
  /^\d+[.,]?\d*\s*%$/,                 // 퍼센트: 12.5%
  /^[-+]?\d+[.,]?\d*$/,                // 부호 있는 숫자: -0.5, +1.2
];

// 단위 잘림 보정 맵
const UNIT_CORRECTIONS: Record<string, string> = {
  'mmH': 'mmHg',
  'mg/d': 'mg/dL',
  'g/d': 'g/dL',
  'U/': 'U/L',
  'K/u': 'K/μL',
  'K/μ': 'K/μL',
  '10x9/': '10x9/L',
  '10x12/': '10x12/L',
  'mmol/': 'mmol/L',
  'ug/d': 'ug/dL',
  'ng/m': 'ng/ml',
  'pmol/': 'pmol/L',
};

export interface GarbageFilterResult {
  isGarbage: boolean;
  reason?: string;
  hasTruncatedBracket: boolean;
}

/**
 * Step 0: 가비지 필터링
 * OCR에서 항목이 아닌 값이 잘못 인식되는 패턴을 걸러냄
 */
export function filterGarbage(rawName: string): GarbageFilterResult {
  const trimmed = rawName.trim();

  // 빈 문자열
  if (!trimmed) {
    return { isGarbage: true, reason: '빈 문자열', hasTruncatedBracket: false };
  }

  // 1. 숫자/범위 패턴 체크
  for (const pattern of GARBAGE_NUMERIC_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { isGarbage: true, reason: '숫자/범위 패턴', hasTruncatedBracket: false };
    }
  }

  // 2. 카테고리 라벨 체크
  const upperTrimmed = trimmed.toUpperCase();
  for (const label of GARBAGE_LABELS) {
    if (upperTrimmed === label.toUpperCase()) {
      return { isGarbage: true, reason: '카테고리 라벨', hasTruncatedBracket: false };
    }
  }

  // 3. 너무 짧은 문자열 (1글자)
  if (trimmed.length === 1 && !/[A-Za-z]/.test(trimmed)) {
    return { isGarbage: true, reason: '단일 문자', hasTruncatedBracket: false };
  }

  // 4. 닫히지 않은 괄호 감지
  const openParens = (trimmed.match(/\(/g) || []).length;
  const closeParens = (trimmed.match(/\)/g) || []).length;
  const hasTruncatedBracket = openParens > closeParens;

  return { isGarbage: false, hasTruncatedBracket };
}

/**
 * 단위 잘림 보정
 */
export function correctTruncatedUnit(unit: string): string {
  if (!unit) return unit;

  const trimmed = unit.trim();

  // 정확히 일치하는 잘린 단위 보정
  if (UNIT_CORRECTIONS[trimmed]) {
    return UNIT_CORRECTIONS[trimmed];
  }

  // 부분 일치 보정
  for (const [truncated, corrected] of Object.entries(UNIT_CORRECTIONS)) {
    if (trimmed.endsWith(truncated) && trimmed.length <= truncated.length + 2) {
      return trimmed.replace(truncated, corrected);
    }
  }

  return trimmed;
}

/**
 * 캐시 초기화 (DB에서 로드, 사용자 오버라이드 병합)
 */
async function initializeCache(supabase: SupabaseClientType, userId?: string) {
  const now = Date.now();

  // undefined를 null로 정규화 (비교 일관성)
  const normalizedUserId = userId ?? null;

  // 캐시가 유효하고 같은 사용자면 재사용
  if (cachedStandardItems && cachedAliases &&
      (now - cacheTimestamp) < CACHE_TTL &&
      cachedUserId === normalizedUserId) {
    return;
  }

  // 사용자가 있으면 오버라이드 병합 데이터 사용
  if (normalizedUserId) {
    // get_user_standard_items 함수 호출
    const { data: items, error: itemsError } = await supabase
      .rpc('get_user_standard_items', { p_user_id: normalizedUserId });

    if (!itemsError && items) {
      cachedStandardItems = new Map();
      for (const item of items) {
        cachedStandardItems.set(item.name.toLowerCase(), item as StandardItem);
      }
    }

    // get_user_item_aliases 함수 호출
    const { data: aliases, error: aliasesError } = await supabase
      .rpc('get_user_item_aliases', { p_user_id: normalizedUserId });

    if (!aliasesError && aliases) {
      cachedAliases = new Map();
      for (const alias of aliases) {
        cachedAliases.set(alias.alias.toLowerCase(), alias as ItemAlias);
      }
    }

    cachedUserId = normalizedUserId;
    cacheTimestamp = now;
    return;
  }

  // 비로그인 시 마스터 테이블만 사용
  const { data: items } = await supabase
    .from('standard_items_master')
    .select('id, name, display_name_ko, exam_type, organ_tags, category, default_unit');

  cachedStandardItems = new Map();
  for (const item of items || []) {
    cachedStandardItems.set(item.name.toLowerCase(), item as StandardItem);
  }

  const { data: aliases } = await supabase
    .from('item_aliases_master')
    .select('id, alias, canonical_name, source_hint, standard_item_id');

  cachedAliases = new Map();
  for (const alias of aliases || []) {
    cachedAliases.set(alias.alias.toLowerCase(), alias as ItemAlias);
  }

  cachedUserId = null;
  cacheTimestamp = now;
}

/**
 * 하이브리드 4단계 매칭 (Step 0-2: 로컬/DB 기반)
 * AI 판단(Step 3)은 별도 API에서 처리
 */
export async function matchItemV3(
  rawName: string,
  options: {
    supabase?: SupabaseClientType;
    userId?: string;
  } = {}
): Promise<MatchResultV3> {
  const supabase = options.supabase || (await createServerClient());

  // ============================================
  // Step 0: 가비지 필터링
  // ============================================
  const garbageResult = filterGarbage(rawName);
  if (garbageResult.isGarbage) {
    return {
      ...createEmptyResult(),
      method: 'garbage',
      isGarbage: true,
      garbageReason: garbageResult.reason,
    };
  }

  await initializeCache(supabase, options.userId);

  if (!rawName || !cachedStandardItems || !cachedAliases) {
    return createEmptyResult();
  }

  const normalizedRaw = rawName.toLowerCase().trim();

  // ============================================
  // Step 1: 정규 항목 exact match (case-insensitive)
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
  // Step 2: Alias 테이블 exact match (case-insensitive)
  // ============================================
  const aliasMatch = cachedAliases.get(normalizedRaw);
  if (aliasMatch) {
    const standardItem = cachedStandardItems.get(aliasMatch.canonical_name.toLowerCase());
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

  // Step 1, 2 모두 실패 → Step 3 (AI 판단) 필요
  // 닫히지 않은 괄호 정보 포함하여 반환
  return {
    ...createEmptyResult(),
    hasTruncatedBracket: garbageResult.hasTruncatedBracket,
  };
}

/**
 * 여러 항목 일괄 매칭 (Step 0-2만)
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
    rawNames.map(name => matchItemV3(name, { supabase, userId: options.userId }))
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
    descriptionCommon?: string;
    descriptionHigh?: string;
    descriptionLow?: string;
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
        description_common: item.descriptionCommon,
        description_high: item.descriptionHigh,
        description_low: item.descriptionLow,
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
      description_common: item.descriptionCommon,
      description_high: item.descriptionHigh,
      description_low: item.descriptionLow,
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
