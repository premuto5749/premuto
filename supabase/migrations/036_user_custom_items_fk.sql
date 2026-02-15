-- ============================================
-- Migration 036: 유저 커스텀 항목이 마스터에 섞이는 문제 수정
--
-- 문제: test_results.standard_item_id FK가 standard_items_master만 참조
--       → 유저 커스텀 항목(user_standard_items)을 test_results에서 참조 불가
--       → 코드에서 어쩔 수 없이 마스터에 항목을 삽입하는 workaround 사용
--
-- 해결:
--   1. FK 제약 해제 → standard_item_id가 양쪽 테이블 모두 참조 가능
--   2. resolve_standard_items RPC → 양쪽 테이블에서 항목 정보 조회
--   3. 트리거 → user_standard_items 삭제 시 orphan 방지
-- ============================================

-- ============================================
-- 1. FK 제약 해제
--    standard_item_id가 standard_items_master 또는 user_standard_items 양쪽 참조 가능하도록
-- ============================================
ALTER TABLE test_results
DROP CONSTRAINT IF EXISTS test_results_standard_item_id_fkey;

-- user_item_aliases: 유저 커스텀 항목의 별칭도 저장 가능하도록
ALTER TABLE user_item_aliases
DROP CONSTRAINT IF EXISTS user_item_aliases_standard_item_id_fkey;

-- user_item_mappings: 유저 커스텀 항목의 매핑도 저장 가능하도록
ALTER TABLE user_item_mappings
DROP CONSTRAINT IF EXISTS user_item_mappings_standard_item_id_fkey;

-- ============================================
-- 2. resolve_standard_items RPC 함수
--    주어진 item_id 목록에 대해 양쪽 테이블에서 항목 정보를 조회
-- ============================================
CREATE OR REPLACE FUNCTION resolve_standard_items(
  p_item_ids UUID[],
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  item_id UUID,
  name VARCHAR,
  display_name_ko VARCHAR,
  category VARCHAR,
  default_unit VARCHAR,
  exam_type VARCHAR,
  organ_tags JSONB,
  description_common TEXT,
  description_high TEXT,
  description_low TEXT,
  source_table TEXT  -- 'master' 또는 'user_custom'
) AS $$
BEGIN
  RETURN QUERY
  -- 1차: standard_items_master에서 조회 (사용자 오버라이드 적용)
  SELECT
    m.id AS item_id,
    COALESCE(u.name, m.name)::VARCHAR AS name,
    COALESCE(u.display_name_ko, m.display_name_ko)::VARCHAR AS display_name_ko,
    COALESCE(u.category, m.category)::VARCHAR AS category,
    COALESCE(u.default_unit, m.default_unit)::VARCHAR AS default_unit,
    COALESCE(u.exam_type, m.exam_type)::VARCHAR AS exam_type,
    COALESCE(u.organ_tags, m.organ_tags) AS organ_tags,
    COALESCE(u.description_common, m.description_common)::TEXT AS description_common,
    COALESCE(u.description_high, m.description_high)::TEXT AS description_high,
    COALESCE(u.description_low, m.description_low)::TEXT AS description_low,
    'master'::TEXT AS source_table
  FROM standard_items_master m
  LEFT JOIN user_standard_items u
    ON u.master_item_id = m.id AND u.user_id = p_user_id
  WHERE m.id = ANY(p_item_ids)

  UNION ALL

  -- 2차: user_standard_items에서 커스텀 항목 조회
  -- (master에서 못 찾은 ID만 — 커스텀 항목은 master_item_id IS NULL)
  SELECT
    uc.id AS item_id,
    uc.name::VARCHAR,
    uc.display_name_ko::VARCHAR,
    uc.category::VARCHAR,
    uc.default_unit::VARCHAR,
    uc.exam_type::VARCHAR,
    uc.organ_tags,
    uc.description_common::TEXT,
    uc.description_high::TEXT,
    uc.description_low::TEXT,
    'user_custom'::TEXT AS source_table
  FROM user_standard_items uc
  WHERE uc.id = ANY(p_item_ids)
    AND uc.master_item_id IS NULL
    AND uc.user_id = p_user_id
    -- master에서 이미 찾은 ID는 제외
    AND uc.id NOT IN (SELECT sm.id FROM standard_items_master sm WHERE sm.id = ANY(p_item_ids));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION resolve_standard_items IS '주어진 item_id 목록에 대해 standard_items_master + user_standard_items 양쪽에서 항목 정보를 조회. 사용자 오버라이드 적용.';

-- ============================================
-- 3. 트리거: user_standard_items 삭제 시 orphan 방지
--    해당 항목을 참조하는 test_results.standard_item_id를 NULL로 설정
-- ============================================
CREATE OR REPLACE FUNCTION on_user_standard_item_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- 삭제되는 커스텀 항목(master_item_id IS NULL)을 참조하는 레코드 정리
  IF OLD.master_item_id IS NULL THEN
    UPDATE test_results
    SET standard_item_id = NULL
    WHERE standard_item_id = OLD.id;

    -- 관련 별칭/매핑도 정리
    DELETE FROM user_item_aliases
    WHERE standard_item_id = OLD.id AND user_id = OLD.user_id;

    DELETE FROM user_item_mappings
    WHERE standard_item_id = OLD.id AND user_id = OLD.user_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_user_standard_item_delete ON user_standard_items;
CREATE TRIGGER trg_user_standard_item_delete
  BEFORE DELETE ON user_standard_items
  FOR EACH ROW
  EXECUTE FUNCTION on_user_standard_item_delete();

COMMENT ON TRIGGER trg_user_standard_item_delete ON user_standard_items
  IS 'user_standard_items 커스텀 항목 삭제 시 관련 test_results.standard_item_id를 NULL로 설정';

-- ============================================
-- Migration Complete
-- ============================================
