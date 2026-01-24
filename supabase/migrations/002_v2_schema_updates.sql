-- v2 Schema Updates: Multi-file upload, AI mapping, Equipment-specific reference ranges
-- Migration: 002_v2_schema_updates.sql

-- ============================================
-- 1. item_mappings 테이블 업데이트
-- ============================================
-- AI 학습 및 신뢰도 추적을 위한 필드 추가

ALTER TABLE item_mappings
ADD COLUMN IF NOT EXISTS confidence_score numeric(5,2),
ADD COLUMN IF NOT EXISTS mapping_source varchar CHECK (mapping_source IN ('ai', 'user', 'manual')),
ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS created_by varchar;

COMMENT ON COLUMN item_mappings.confidence_score IS 'AI 매칭 신뢰도 (0.00~100.00)';
COMMENT ON COLUMN item_mappings.mapping_source IS 'ai: AI 자동 매칭, user: 사용자가 AI 제안 승인, manual: 사용자가 직접 입력';

-- ============================================
-- 2. test_records 테이블 업데이트
-- ============================================
-- 다중 파일 업로드 메타데이터 지원

ALTER TABLE test_records
ADD COLUMN IF NOT EXISTS uploaded_files jsonb,
ADD COLUMN IF NOT EXISTS file_count integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS batch_upload_id varchar;

COMMENT ON COLUMN test_records.uploaded_files IS '업로드된 파일들의 메타데이터 배열. 예: [{"filename": "cbc.pdf", "size": 245120, "type": "application/pdf"}]';
COMMENT ON COLUMN test_records.file_count IS '업로드된 파일 개수';
COMMENT ON COLUMN test_records.batch_upload_id IS '같은 배치로 업로드된 파일들을 그룹화 (UUID 또는 타임스탬프)';

-- ============================================
-- 3. test_results 테이블 업데이트
-- ============================================
-- 추적성 및 AI 매칭 정보 필드 추가

ALTER TABLE test_results
ADD COLUMN IF NOT EXISTS source_filename varchar,
ADD COLUMN IF NOT EXISTS ocr_raw_name varchar,
ADD COLUMN IF NOT EXISTS mapping_confidence numeric(5,2),
ADD COLUMN IF NOT EXISTS user_verified boolean DEFAULT false;

COMMENT ON COLUMN test_results.source_filename IS '이 결과가 추출된 원본 파일명';
COMMENT ON COLUMN test_results.ocr_raw_name IS 'OCR이 읽은 원본 항목명 (디버깅/감사 용도)';
COMMENT ON COLUMN test_results.mapping_confidence IS 'AI 매칭 신뢰도 (item_mappings의 값 복사)';
COMMENT ON COLUMN test_results.user_verified IS '사용자가 검수 완료 여부';

-- ============================================
-- 4. 인덱스 추가 (성능 최적화)
-- ============================================

-- 참고치 변경 추적을 위한 인덱스 (같은 항목의 시계열 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_test_results_item_date
ON test_results(standard_item_id, created_at);

-- 배치 업로드 조회 최적화
CREATE INDEX IF NOT EXISTS idx_test_records_batch
ON test_records(batch_upload_id)
WHERE batch_upload_id IS NOT NULL;

-- AI 매핑 소스별 조회 최적화
CREATE INDEX IF NOT EXISTS idx_item_mappings_source
ON item_mappings(mapping_source)
WHERE mapping_source IS NOT NULL;

-- ============================================
-- 5. 기존 데이터 마이그레이션
-- ============================================
-- 기존 레코드에 기본값 설정

-- test_records: file_count 기본값 설정
UPDATE test_records
SET file_count = 1
WHERE file_count IS NULL;

-- item_mappings: 기존 매핑은 수동 입력으로 간주
UPDATE item_mappings
SET mapping_source = 'manual',
    confidence_score = 100.00
WHERE mapping_source IS NULL;

-- ============================================
-- 6. 제약조건 추가
-- ============================================

-- confidence_score는 0~100 범위만 허용
ALTER TABLE item_mappings
ADD CONSTRAINT check_confidence_range
CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100));

ALTER TABLE test_results
ADD CONSTRAINT check_mapping_confidence_range
CHECK (mapping_confidence IS NULL OR (mapping_confidence >= 0 AND mapping_confidence <= 100));

-- ============================================
-- 7. View 생성: 참고치 변경 추적
-- ============================================
-- 같은 항목의 참고치가 시간에 따라 어떻게 변했는지 추적

CREATE OR REPLACE VIEW reference_range_changes AS
SELECT
  tr1.standard_item_id,
  si.name as item_name,
  si.display_name_ko,
  tr1.id as result_id,
  tr1.created_at as test_date,
  tr1.ref_min as current_ref_min,
  tr1.ref_max as current_ref_max,
  tr1.ref_text as current_ref_text,
  tr2.ref_min as previous_ref_min,
  tr2.ref_max as previous_ref_max,
  tr2.ref_text as previous_ref_text,
  CASE
    WHEN tr1.ref_min != tr2.ref_min OR tr1.ref_max != tr2.ref_max THEN true
    ELSE false
  END as has_changed
FROM test_results tr1
LEFT JOIN LATERAL (
  SELECT ref_min, ref_max, ref_text
  FROM test_results tr2
  WHERE tr2.standard_item_id = tr1.standard_item_id
    AND tr2.created_at < tr1.created_at
  ORDER BY tr2.created_at DESC
  LIMIT 1
) tr2 ON true
JOIN standard_items si ON si.id = tr1.standard_item_id
WHERE tr2.ref_min IS NOT NULL; -- 이전 데이터가 있는 경우만

COMMENT ON VIEW reference_range_changes IS '참고치 변경 이력 추적 뷰. 장비 교체 등으로 참고치가 변경된 지점을 감지합니다.';

-- ============================================
-- 8. 함수 생성: 중복 항목 감지
-- ============================================
-- 같은 배치에서 중복된 항목 찾기

CREATE OR REPLACE FUNCTION find_duplicate_items_in_batch(
  p_batch_id varchar,
  p_items jsonb
) RETURNS TABLE (
  item_name varchar,
  occurrences bigint,
  values jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    item->>'name' as item_name,
    COUNT(*) as occurrences,
    jsonb_agg(item->'value') as values
  FROM jsonb_array_elements(p_items) as item
  GROUP BY item->>'name'
  HAVING COUNT(*) > 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION find_duplicate_items_in_batch IS '배치 업로드 시 여러 파일에서 같은 항목이 추출된 경우를 찾아냅니다.';

-- ============================================
-- Migration Complete
-- ============================================
