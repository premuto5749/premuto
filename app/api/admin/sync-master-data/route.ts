import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import masterData from '@/config/master_data_v3.json';

interface SyncResult {
  success: boolean;
  items: {
    total: number;
    inserted: number;
    updated: number;
    failed: number;
  };
  aliases: {
    total: number;
    inserted: number;
    skipped: number;
    failed: number;
  };
  migratedMappings: number;
  errors: string[];
}

/**
 * POST /api/admin/sync-master-data
 * v3 마스터 데이터를 DB에 동기화
 *
 * 작업:
 * 1. 106개 test_items → standard_items 업서트
 * 2. 60개 aliases → item_aliases 삽입
 * 3. 기존 item_mappings → item_aliases 이전 (선택적)
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const result: SyncResult = {
    success: false,
    items: { total: 0, inserted: 0, updated: 0, failed: 0 },
    aliases: { total: 0, inserted: 0, skipped: 0, failed: 0 },
    migratedMappings: 0,
    errors: []
  };

  try {
    // 옵션 파싱
    const body = await request.json().catch(() => ({}));
    const { migrateOldMappings = false } = body;

    // ============================================
    // 1. standard_items 동기화 (106개 항목)
    // ============================================
    const testItems = masterData.test_items;
    result.items.total = testItems.length;

    for (const item of testItems) {
      try {
        // 기존 항목 확인 (name으로 검색)
        const { data: existing } = await supabase
          .from('standard_items')
          .select('id')
          .ilike('name', item.name)
          .single();

        if (existing) {
          // 업데이트
          const { error } = await supabase
            .from('standard_items')
            .update({
              display_name_ko: item.display_name_ko,
              default_unit: item.unit,
              exam_type: item.exam_type,
              organ_tags: item.organ_tags,
            })
            .eq('id', existing.id);

          if (error) {
            result.items.failed++;
            result.errors.push(`Update failed for ${item.name}: ${error.message}`);
          } else {
            result.items.updated++;
          }
        } else {
          // 신규 삽입
          const { error } = await supabase
            .from('standard_items')
            .insert({
              name: item.name,
              display_name_ko: item.display_name_ko,
              default_unit: item.unit,
              category: item.exam_type, // 하위 호환성
              exam_type: item.exam_type,
              organ_tags: item.organ_tags,
            });

          if (error) {
            result.items.failed++;
            result.errors.push(`Insert failed for ${item.name}: ${error.message}`);
          } else {
            result.items.inserted++;
          }
        }
      } catch (err) {
        result.items.failed++;
        result.errors.push(`Error processing ${item.name}: ${err}`);
      }
    }

    // ============================================
    // 2. item_aliases 동기화 (60개 별칭)
    // ============================================
    const aliases = masterData.aliases;
    result.aliases.total = aliases.length;

    // 먼저 standard_items 맵 구축
    const { data: allItems } = await supabase
      .from('standard_items')
      .select('id, name');

    const itemNameToId = new Map(
      (allItems || []).map(item => [item.name.toLowerCase(), item.id])
    );

    for (const alias of aliases) {
      try {
        const standardItemId = itemNameToId.get(alias.canonical.toLowerCase());

        if (!standardItemId) {
          result.aliases.skipped++;
          result.errors.push(`Skipped alias ${alias.alias}: canonical ${alias.canonical} not found`);
          continue;
        }

        const { error } = await supabase
          .from('item_aliases')
          .upsert({
            alias: alias.alias,
            canonical_name: alias.canonical,
            source_hint: alias.source_hint || null,
            standard_item_id: standardItemId,
          }, {
            onConflict: 'alias'
          });

        if (error) {
          if (error.code === '23505') { // unique violation
            result.aliases.skipped++;
          } else {
            result.aliases.failed++;
            result.errors.push(`Alias insert failed for ${alias.alias}: ${error.message}`);
          }
        } else {
          result.aliases.inserted++;
        }
      } catch (err) {
        result.aliases.failed++;
        result.errors.push(`Error processing alias ${alias.alias}: ${err}`);
      }
    }

    // ============================================
    // 3. 기존 item_mappings → item_aliases 이전 (선택적)
    // ============================================
    if (migrateOldMappings) {
      const { data: oldMappings } = await supabase
        .from('item_mappings')
        .select('raw_name, standard_item_id, standard_items(name)');

      for (const mapping of oldMappings || []) {
        try {
          // 이미 item_aliases에 있는지 확인
          const { data: existingAlias } = await supabase
            .from('item_aliases')
            .select('id')
            .ilike('alias', mapping.raw_name)
            .single();

          if (existingAlias) {
            continue; // 이미 존재하면 건너뜀
          }

          const standardItem = mapping.standard_items as { name?: string } | null;
          const canonicalName = standardItem?.name || '';

          const { error } = await supabase
            .from('item_aliases')
            .insert({
              alias: mapping.raw_name,
              canonical_name: canonicalName,
              source_hint: null, // 기존에는 source_hint 없음
              standard_item_id: mapping.standard_item_id,
            });

          if (!error) {
            result.migratedMappings++;
          }
        } catch {
          // 개별 실패는 무시
        }
      }
    }

    result.success = true;
  } catch (error) {
    result.success = false;
    result.errors.push(`Fatal error: ${error}`);
  }

  return NextResponse.json(result);
}

/**
 * GET /api/admin/sync-master-data
 * 현재 동기화 상태 조회
 */
export async function GET() {
  const supabase = await createClient();

  // 현재 DB 상태 조회
  const [itemsResult, aliasesResult, mappingsResult] = await Promise.all([
    supabase.from('standard_items').select('id, name, exam_type, organ_tags', { count: 'exact' }),
    supabase.from('item_aliases').select('id', { count: 'exact' }),
    supabase.from('item_mappings').select('id', { count: 'exact' }),
  ]);

  // exam_type 분포
  const examTypeDistribution: Record<string, number> = {};
  for (const item of itemsResult.data || []) {
    const type = item.exam_type || 'Unknown';
    examTypeDistribution[type] = (examTypeDistribution[type] || 0) + 1;
  }

  // v3와의 차이점 분석
  const masterItemNames = new Set(masterData.test_items.map(i => i.name.toLowerCase()));
  const dbItemNames = new Set((itemsResult.data || []).map(i => i.name.toLowerCase()));

  const missingInDb = masterData.test_items
    .filter(i => !dbItemNames.has(i.name.toLowerCase()))
    .map(i => i.name);

  const extraInDb = (itemsResult.data || [])
    .filter(i => !masterItemNames.has(i.name.toLowerCase()))
    .map(i => i.name);

  return NextResponse.json({
    current: {
      standardItems: itemsResult.count || 0,
      itemAliases: aliasesResult.count || 0,
      itemMappings: mappingsResult.count || 0,
    },
    masterData: {
      testItems: masterData.test_items.length,
      aliases: masterData.aliases.length,
    },
    examTypeDistribution,
    comparison: {
      missingInDb,
      extraInDb,
      missingCount: missingInDb.length,
      extraCount: extraInDb.length,
    }
  });
}
