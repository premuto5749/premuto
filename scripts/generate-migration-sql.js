const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '../docs/standard_items_master.json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

const escapeSQL = (str) => {
  if (str === null || str === undefined) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
};

const jsonToSQL = (arr) => {
  if (!arr || arr.length === 0) return "'[]'::jsonb";
  return `'${JSON.stringify(arr)}'::jsonb`;
};

let sql = `-- =====================================================
-- Premuto 검사항목 마스터 데이터 전면 교체 마이그레이션
-- 생성일: ${new Date().toISOString().split('T')[0]}
-- 버전: ${data.version}
-- 항목 수: ${data.stats.test_items}개 표준항목, ${data.stats.aliases}개 별칭
-- =====================================================

-- =====================================================
-- 1단계: 기존 데이터 삭제 (의존성 순서대로)
-- =====================================================

-- test_results 삭제 (test_records에 CASCADE되어 있으므로 test_records도 함께 삭제됨)
TRUNCATE TABLE test_results CASCADE;

-- item_aliases_master 삭제
TRUNCATE TABLE item_aliases_master CASCADE;

-- standard_items_master 삭제
TRUNCATE TABLE standard_items_master CASCADE;

-- =====================================================
-- 2단계: 새 컬럼 추가 (없으면)
-- =====================================================

-- description_common 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'standard_items_master' AND column_name = 'description_common'
  ) THEN
    ALTER TABLE standard_items_master ADD COLUMN description_common TEXT;
  END IF;
END $$;

-- description_high 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'standard_items_master' AND column_name = 'description_high'
  ) THEN
    ALTER TABLE standard_items_master ADD COLUMN description_high TEXT;
  END IF;
END $$;

-- description_low 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'standard_items_master' AND column_name = 'description_low'
  ) THEN
    ALTER TABLE standard_items_master ADD COLUMN description_low TEXT;
  END IF;
END $$;

-- =====================================================
-- 3단계: standard_items_master INSERT (${data.stats.test_items}개)
-- =====================================================

INSERT INTO standard_items_master (
  id, category, name, display_name_ko, default_unit,
  exam_type, organ_tags, description_common, description_high, description_low
) VALUES
`;

// Generate INSERT for test_items
const itemValues = data.test_items.map((item, index) => {
  const id = `gen_random_uuid()`;
  return `(${id}, ${escapeSQL(item.exam_type)}, ${escapeSQL(item.name)}, ${escapeSQL(item.display_name_ko)}, ${escapeSQL(item.unit)}, ${escapeSQL(item.exam_type)}, ${jsonToSQL(item.organ_tags)}, ${escapeSQL(item.description_common)}, ${escapeSQL(item.description_high)}, ${escapeSQL(item.description_low)})`;
});

sql += itemValues.join(',\n') + ';\n\n';

sql += `-- =====================================================
-- 4단계: item_aliases_master INSERT (${data.stats.aliases}개)
-- canonical_name으로 standard_item_id 조회하여 연결
-- =====================================================

INSERT INTO item_aliases_master (
  id, alias, canonical_name, source_hint, standard_item_id, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  v.alias,
  v.canonical_name,
  NULLIF(v.source_hint, ''),
  s.id,
  NOW(),
  NOW()
FROM (VALUES
`;

// Generate VALUES for aliases
const aliasValues = data.aliases.map((alias) => {
  return `  (${escapeSQL(alias.alias)}, ${escapeSQL(alias.canonical)}, ${escapeSQL(alias.source_hint || '')})`;
});

sql += aliasValues.join(',\n');

sql += `
) AS v(alias, canonical_name, source_hint)
LEFT JOIN standard_items_master s ON LOWER(s.name) = LOWER(v.canonical_name);

-- =====================================================
-- 5단계: 검증 쿼리
-- =====================================================

-- 삽입된 standard_items_master 개수 확인
SELECT 'standard_items_master' as table_name, COUNT(*) as count FROM standard_items_master;

-- 삽입된 item_aliases_master 개수 확인
SELECT 'item_aliases_master' as table_name, COUNT(*) as count FROM item_aliases_master;

-- standard_item_id가 NULL인 alias 확인 (매칭 실패한 항목)
SELECT alias, canonical_name, source_hint
FROM item_aliases_master
WHERE standard_item_id IS NULL;

-- =====================================================
-- 완료
-- =====================================================
`;

const outputPath = path.join(__dirname, '../migrations/001_replace_master_data.sql');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, sql, 'utf-8');

console.log(`Migration SQL generated: ${outputPath}`);
console.log(`- ${data.stats.test_items} standard items`);
console.log(`- ${data.stats.aliases} aliases`);
