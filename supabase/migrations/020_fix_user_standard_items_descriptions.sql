-- ============================================
-- Migration 020: user_standard_items 테이블에 description 컬럼 추가
-- 마스터 테이블과 동일하게 3개 description 컬럼 구조로 변경
-- ============================================

-- 1. user_standard_items 테이블에 description 컬럼들 추가
ALTER TABLE user_standard_items
DROP COLUMN IF EXISTS description;

ALTER TABLE user_standard_items
ADD COLUMN IF NOT EXISTS description_common TEXT,
ADD COLUMN IF NOT EXISTS description_high TEXT,
ADD COLUMN IF NOT EXISTS description_low TEXT;

COMMENT ON COLUMN user_standard_items.description_common IS '검사 항목에 대한 일반적인 설명 (사용자 오버라이드)';
COMMENT ON COLUMN user_standard_items.description_high IS '수치가 높을 때의 의미와 원인 (사용자 오버라이드)';
COMMENT ON COLUMN user_standard_items.description_low IS '수치가 낮을 때의 의미와 원인 (사용자 오버라이드)';

-- 2. 기존 함수 삭제 (반환 타입 변경을 위해 필요)
DROP FUNCTION IF EXISTS get_user_standard_items(UUID);

-- 3. get_user_standard_items 함수 재생성 (3개 description 필드 반환)
CREATE OR REPLACE FUNCTION get_user_standard_items(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  display_name_ko VARCHAR,
  category VARCHAR,
  default_unit VARCHAR,
  description_common TEXT,
  description_high TEXT,
  description_low TEXT,
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
    COALESCE(u.description_common, m.description_common)::TEXT as description_common,
    COALESCE(u.description_high, m.description_high)::TEXT as description_high,
    COALESCE(u.description_low, m.description_low)::TEXT as description_low,
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
    u.description_common::TEXT,
    u.description_high::TEXT,
    u.description_low::TEXT,
    u.exam_type::VARCHAR,
    u.organ_tags,
    u.sort_order,
    true as is_custom,
    false as is_modified
  FROM user_standard_items u
  WHERE u.user_id = p_user_id AND u.master_item_id IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_standard_items IS '사용자의 표준 항목 목록 조회 (마스터 + 오버라이드 병합, description 3종 포함)';

-- ============================================
-- Migration Complete
-- ============================================
