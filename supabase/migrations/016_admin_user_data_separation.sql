-- ============================================
-- Migration 016: 관리자/사용자 데이터 분리
-- 마스터 데이터와 사용자 오버라이드 구조
-- ============================================

-- ============================================
-- 1. 기존 테이블 → 마스터 테이블로 이름 변경
-- ============================================

-- 외래키 제약 조건 먼저 삭제
ALTER TABLE item_mappings DROP CONSTRAINT IF EXISTS item_mappings_standard_item_id_fkey;
ALTER TABLE item_aliases DROP CONSTRAINT IF EXISTS item_aliases_standard_item_id_fkey;
ALTER TABLE test_results DROP CONSTRAINT IF EXISTS test_results_standard_item_id_fkey;

-- 뷰 삭제 (테이블 이름 변경 전)
DROP VIEW IF EXISTS items_by_exam_type;
DROP VIEW IF EXISTS reference_range_changes;

-- 테이블 이름 변경
ALTER TABLE standard_items RENAME TO standard_items_master;
ALTER TABLE item_aliases RENAME TO item_aliases_master;
ALTER TABLE item_mappings RENAME TO item_mappings_master;

-- 외래키 재생성 (마스터 테이블 참조)
ALTER TABLE item_aliases_master
ADD CONSTRAINT item_aliases_master_standard_item_id_fkey
FOREIGN KEY (standard_item_id) REFERENCES standard_items_master(id) ON DELETE CASCADE;

ALTER TABLE item_mappings_master
ADD CONSTRAINT item_mappings_master_standard_item_id_fkey
FOREIGN KEY (standard_item_id) REFERENCES standard_items_master(id) ON DELETE CASCADE;

ALTER TABLE test_results
ADD CONSTRAINT test_results_standard_item_id_fkey
FOREIGN KEY (standard_item_id) REFERENCES standard_items_master(id) ON DELETE SET NULL;

-- 인덱스 이름도 변경 (선택사항, 기능에는 영향 없음)
ALTER INDEX IF EXISTS idx_item_mappings_raw RENAME TO idx_item_mappings_master_raw;
ALTER INDEX IF EXISTS idx_item_mappings_source RENAME TO idx_item_mappings_master_source;
ALTER INDEX IF EXISTS idx_aliases_alias_lower RENAME TO idx_aliases_master_alias_lower;
ALTER INDEX IF EXISTS idx_aliases_canonical RENAME TO idx_aliases_master_canonical;
ALTER INDEX IF EXISTS idx_aliases_standard_item RENAME TO idx_aliases_master_standard_item;

-- ============================================
-- 2. 사용자 오버라이드 테이블 생성
-- ============================================

-- 2-1. user_standard_items (표준 항목 오버라이드/추가)
CREATE TABLE user_standard_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 마스터 항목 수정 시: master_item_id 설정
  -- 새 항목 추가 시: master_item_id = NULL
  master_item_id UUID REFERENCES standard_items_master(id) ON DELETE CASCADE,

  -- 오버라이드 가능한 필드들 (NULL이면 마스터 값 사용)
  category VARCHAR(50),
  name VARCHAR(100),
  display_name_ko VARCHAR(100),
  default_unit VARCHAR(20),
  description TEXT,
  exam_type VARCHAR(50),
  organ_tags JSONB,
  sort_order INTEGER,

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 같은 사용자가 같은 마스터 항목을 중복 수정 방지
  CONSTRAINT unique_user_master_item UNIQUE(user_id, master_item_id)
);

COMMENT ON TABLE user_standard_items IS '사용자별 표준 항목 오버라이드/추가 테이블';
COMMENT ON COLUMN user_standard_items.master_item_id IS 'NULL이면 사용자가 새로 추가한 항목, 값이 있으면 마스터 항목 수정';

-- 인덱스
CREATE INDEX idx_user_standard_items_user ON user_standard_items(user_id);
CREATE INDEX idx_user_standard_items_master ON user_standard_items(master_item_id) WHERE master_item_id IS NOT NULL;

-- 2-2. user_item_aliases (별칭 오버라이드/추가)
CREATE TABLE user_item_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 마스터 별칭 수정 시: master_alias_id 설정
  -- 새 별칭 추가 시: master_alias_id = NULL
  master_alias_id UUID REFERENCES item_aliases_master(id) ON DELETE CASCADE,

  -- 오버라이드 가능한 필드들
  alias VARCHAR(100),
  canonical_name VARCHAR(100),
  source_hint VARCHAR(100),
  standard_item_id UUID REFERENCES standard_items_master(id) ON DELETE CASCADE,

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_user_master_alias UNIQUE(user_id, master_alias_id),
  -- 사용자별로 같은 alias 중복 방지
  CONSTRAINT unique_user_alias UNIQUE(user_id, alias)
);

COMMENT ON TABLE user_item_aliases IS '사용자별 별칭 오버라이드/추가 테이블';

-- 인덱스
CREATE INDEX idx_user_item_aliases_user ON user_item_aliases(user_id);
CREATE INDEX idx_user_item_aliases_alias ON user_item_aliases(LOWER(alias));

-- 2-3. user_item_mappings (매핑 사전 오버라이드/추가)
CREATE TABLE user_item_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 마스터 매핑 수정 시: master_mapping_id 설정
  -- 새 매핑 추가 시: master_mapping_id = NULL
  master_mapping_id UUID REFERENCES item_mappings_master(id) ON DELETE CASCADE,

  -- 오버라이드 가능한 필드들
  raw_name VARCHAR(100),
  standard_item_id UUID REFERENCES standard_items_master(id) ON DELETE CASCADE,
  confidence_score NUMERIC(5,2),
  mapping_source VARCHAR CHECK (mapping_source IN ('ai', 'user', 'manual')),

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_user_master_mapping UNIQUE(user_id, master_mapping_id),
  -- 사용자별로 같은 raw_name 중복 방지
  CONSTRAINT unique_user_raw_name UNIQUE(user_id, raw_name)
);

COMMENT ON TABLE user_item_mappings IS '사용자별 매핑 사전 오버라이드/추가 테이블';

-- 인덱스
CREATE INDEX idx_user_item_mappings_user ON user_item_mappings(user_id);
CREATE INDEX idx_user_item_mappings_raw ON user_item_mappings(raw_name);

-- ============================================
-- 3. test_records에 user_id 추가
-- ============================================

ALTER TABLE test_records
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_test_records_user ON test_records(user_id);
CREATE INDEX IF NOT EXISTS idx_test_records_user_date ON test_records(user_id, test_date DESC);

COMMENT ON COLUMN test_records.user_id IS '검사 기록 소유자';

-- ============================================
-- 4. RLS 정책 설정
-- ============================================

-- 4-1. 마스터 테이블: 모든 사용자 읽기만, 쓰기는 서비스 역할만
-- (기존 "Allow all access" 정책 삭제 후 새 정책 생성)

DROP POLICY IF EXISTS "Allow all access" ON standard_items_master;
DROP POLICY IF EXISTS "Allow all access" ON item_aliases_master;
DROP POLICY IF EXISTS "Allow all access" ON item_mappings_master;

-- 마스터 읽기: 모든 인증된 사용자
CREATE POLICY "Master read for authenticated" ON standard_items_master
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Master read for authenticated" ON item_aliases_master
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Master read for authenticated" ON item_mappings_master
  FOR SELECT TO authenticated USING (true);

-- 마스터 쓰기: service_role만 (슈퍼어드민 API에서 사용)
CREATE POLICY "Master write for service role" ON standard_items_master
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Master write for service role" ON item_aliases_master
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Master write for service role" ON item_mappings_master
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4-2. 사용자 오버라이드 테이블: 본인 데이터만

ALTER TABLE user_standard_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_item_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_item_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User owns their standard items" ON user_standard_items
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "User owns their aliases" ON user_item_aliases
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "User owns their mappings" ON user_item_mappings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4-3. test_records: 기존 정책 삭제 후 user_id 기반 정책

DROP POLICY IF EXISTS "Allow all access" ON test_records;
DROP POLICY IF EXISTS "Allow all access" ON test_results;

CREATE POLICY "User owns their test records" ON test_records
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- test_results는 test_records를 통해 간접 보호
CREATE POLICY "User owns their test results" ON test_results
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM test_records tr
      WHERE tr.id = test_results.record_id
      AND tr.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM test_records tr
      WHERE tr.id = test_results.record_id
      AND tr.user_id = auth.uid()
    )
  );

-- ============================================
-- 5. 병합 조회용 함수
-- ============================================

-- 5-1. 사용자의 표준 항목 목록 조회 (마스터 + 오버라이드 병합)
CREATE OR REPLACE FUNCTION get_user_standard_items(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  display_name_ko VARCHAR,
  category VARCHAR,
  default_unit VARCHAR,
  description TEXT,
  exam_type VARCHAR,
  organ_tags JSONB,
  sort_order INTEGER,
  is_custom BOOLEAN,
  is_modified BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  -- 마스터 항목 (오버라이드 적용)
  SELECT
    m.id,
    COALESCE(u.name, m.name)::VARCHAR as name,
    COALESCE(u.display_name_ko, m.display_name_ko)::VARCHAR as display_name_ko,
    COALESCE(u.category, m.category)::VARCHAR as category,
    COALESCE(u.default_unit, m.default_unit)::VARCHAR as default_unit,
    COALESCE(u.description, m.description)::TEXT as description,
    COALESCE(u.exam_type, m.exam_type)::VARCHAR as exam_type,
    COALESCE(u.organ_tags, m.organ_tags) as organ_tags,
    COALESCE(u.sort_order, m.sort_order) as sort_order,
    false as is_custom,
    (u.id IS NOT NULL) as is_modified
  FROM standard_items_master m
  LEFT JOIN user_standard_items u
    ON u.master_item_id = m.id AND u.user_id = p_user_id

  UNION ALL

  -- 사용자가 추가한 커스텀 항목
  SELECT
    u.id,
    u.name::VARCHAR,
    u.display_name_ko::VARCHAR,
    u.category::VARCHAR,
    u.default_unit::VARCHAR,
    u.description::TEXT,
    u.exam_type::VARCHAR,
    u.organ_tags,
    u.sort_order,
    true as is_custom,
    false as is_modified
  FROM user_standard_items u
  WHERE u.user_id = p_user_id AND u.master_item_id IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5-2. 사용자의 별칭 목록 조회
CREATE OR REPLACE FUNCTION get_user_item_aliases(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  alias VARCHAR,
  canonical_name VARCHAR,
  source_hint VARCHAR,
  standard_item_id UUID,
  is_custom BOOLEAN,
  is_modified BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  -- 마스터 별칭 (오버라이드 적용)
  SELECT
    m.id,
    COALESCE(u.alias, m.alias)::VARCHAR as alias,
    COALESCE(u.canonical_name, m.canonical_name)::VARCHAR as canonical_name,
    COALESCE(u.source_hint, m.source_hint)::VARCHAR as source_hint,
    COALESCE(u.standard_item_id, m.standard_item_id) as standard_item_id,
    false as is_custom,
    (u.id IS NOT NULL) as is_modified
  FROM item_aliases_master m
  LEFT JOIN user_item_aliases u
    ON u.master_alias_id = m.id AND u.user_id = p_user_id

  UNION ALL

  -- 사용자가 추가한 커스텀 별칭
  SELECT
    u.id,
    u.alias::VARCHAR,
    u.canonical_name::VARCHAR,
    u.source_hint::VARCHAR,
    u.standard_item_id,
    true as is_custom,
    false as is_modified
  FROM user_item_aliases u
  WHERE u.user_id = p_user_id AND u.master_alias_id IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5-3. 사용자의 매핑 사전 조회
CREATE OR REPLACE FUNCTION get_user_item_mappings(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  raw_name VARCHAR,
  standard_item_id UUID,
  confidence_score NUMERIC,
  mapping_source VARCHAR,
  is_custom BOOLEAN,
  is_modified BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  -- 마스터 매핑 (오버라이드 적용)
  SELECT
    m.id,
    COALESCE(u.raw_name, m.raw_name)::VARCHAR as raw_name,
    COALESCE(u.standard_item_id, m.standard_item_id) as standard_item_id,
    COALESCE(u.confidence_score, m.confidence_score) as confidence_score,
    COALESCE(u.mapping_source, m.mapping_source)::VARCHAR as mapping_source,
    false as is_custom,
    (u.id IS NOT NULL) as is_modified
  FROM item_mappings_master m
  LEFT JOIN user_item_mappings u
    ON u.master_mapping_id = m.id AND u.user_id = p_user_id

  UNION ALL

  -- 사용자가 추가한 커스텀 매핑
  SELECT
    u.id,
    u.raw_name::VARCHAR,
    u.standard_item_id,
    u.confidence_score,
    u.mapping_source::VARCHAR,
    true as is_custom,
    false as is_modified
  FROM user_item_mappings u
  WHERE u.user_id = p_user_id AND u.master_mapping_id IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. 초기화 함수 (사용자 오버라이드 삭제)
-- ============================================

CREATE OR REPLACE FUNCTION reset_user_master_data(p_user_id UUID)
RETURNS void AS $$
BEGIN
  -- 사용자의 모든 오버라이드/커스텀 데이터 삭제
  DELETE FROM user_standard_items WHERE user_id = p_user_id;
  DELETE FROM user_item_aliases WHERE user_id = p_user_id;
  DELETE FROM user_item_mappings WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION reset_user_master_data IS '사용자의 마스터 데이터를 초기 상태로 리셋 (모든 오버라이드/커스텀 삭제)';

-- ============================================
-- 7. updated_at 트리거
-- ============================================

CREATE TRIGGER update_user_standard_items_updated_at
  BEFORE UPDATE ON user_standard_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_item_aliases_updated_at
  BEFORE UPDATE ON user_item_aliases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_item_mappings_updated_at
  BEFORE UPDATE ON user_item_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. View 재생성 (마스터 테이블 참조)
-- ============================================

CREATE OR REPLACE VIEW items_by_exam_type AS
SELECT
  si.*,
  COALESCE(si.exam_type, si.category) as effective_exam_type
FROM standard_items_master si
ORDER BY
  CASE COALESCE(si.exam_type, si.category)
    WHEN 'Vital' THEN 1
    WHEN 'CBC' THEN 2
    WHEN 'Chemistry' THEN 3
    WHEN 'Special' THEN 4
    WHEN 'Blood Gas' THEN 5
    WHEN 'Coagulation' THEN 6
    WHEN '뇨검사' THEN 7
    WHEN '안과검사' THEN 8
    WHEN 'Echo' THEN 9
    ELSE 10
  END,
  si.sort_order,
  si.name;

-- ============================================
-- Migration Complete
-- ============================================
