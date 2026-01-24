-- v2 필드 추가: test_results 테이블에 추적성 및 AI 매핑 정보 컬럼 추가
ALTER TABLE test_results
  ADD COLUMN IF NOT EXISTS source_filename VARCHAR,
  ADD COLUMN IF NOT EXISTS ocr_raw_name VARCHAR,
  ADD COLUMN IF NOT EXISTS mapping_confidence NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS user_verified BOOLEAN DEFAULT false;

-- v2 필드 추가: test_records 테이블에 배치 업로드 정보 컬럼 추가
ALTER TABLE test_records
  ADD COLUMN IF NOT EXISTS uploaded_files JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS file_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS batch_upload_id VARCHAR;

-- 성능 최적화를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_test_results_item_date
  ON test_results(standard_item_id, created_at);

CREATE INDEX IF NOT EXISTS idx_test_records_batch
  ON test_records(batch_upload_id);

-- 코멘트 추가
COMMENT ON COLUMN test_results.source_filename IS '이 결과가 추출된 원본 파일명';
COMMENT ON COLUMN test_results.ocr_raw_name IS 'OCR이 읽은 원본 항목명 (디버깅/감사 용도)';
COMMENT ON COLUMN test_results.mapping_confidence IS 'AI 매칭 신뢰도 (0-100)';
COMMENT ON COLUMN test_results.user_verified IS '사용자가 검수 완료 여부';

COMMENT ON COLUMN test_records.uploaded_files IS '업로드된 파일 메타데이터 (JSONB)';
COMMENT ON COLUMN test_records.file_count IS '업로드된 파일 개수';
COMMENT ON COLUMN test_records.batch_upload_id IS '배치 업로드 식별자';
