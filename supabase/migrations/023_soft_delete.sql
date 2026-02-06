-- =====================================================
-- Migration: 023_soft_delete
-- Description: 소프트 삭제 (7일 보관 후 영구 삭제)
-- =====================================================

-- 1. test_records에 deleted_at 컬럼 추가
ALTER TABLE test_records ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_test_records_deleted ON test_records(deleted_at) WHERE deleted_at IS NOT NULL;

-- 2. daily_logs에 deleted_at 컬럼 추가
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_daily_logs_deleted ON daily_logs(deleted_at) WHERE deleted_at IS NOT NULL;

-- 3. 7일 지난 소프트 삭제 레코드를 영구 삭제하는 함수
CREATE OR REPLACE FUNCTION cleanup_soft_deleted_records()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  temp_count INTEGER;
BEGIN
  -- test_records (cascade로 test_results도 삭제됨)
  DELETE FROM test_records
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;

  -- daily_logs
  DELETE FROM daily_logs
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RLS 정책 업데이트: 삭제된 레코드는 일반 조회에서 제외
-- test_records: 기존 SELECT 정책 교체
DROP POLICY IF EXISTS "Users can view own test records" ON test_records;
CREATE POLICY "Users can view own test records"
  ON test_records FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- 삭제된 레코드 조회용 별도 정책 (복원 UI용)
CREATE POLICY "Users can view own deleted test records"
  ON test_records FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NOT NULL);

-- daily_logs: 기존 SELECT 정책 교체
DROP POLICY IF EXISTS "Users can view own daily_logs" ON daily_logs;
CREATE POLICY "Users can view own daily_logs"
  ON daily_logs FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "daily_logs_select" ON daily_logs;
CREATE POLICY "daily_logs_select"
  ON daily_logs FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- 삭제된 일일 기록 조회용
CREATE POLICY "Users can view own deleted daily_logs"
  ON daily_logs FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NOT NULL);

-- 코멘트
COMMENT ON COLUMN test_records.deleted_at IS '소프트 삭제 시각 (NULL=활성, NOT NULL=삭제됨, 7일 후 영구 삭제)';
COMMENT ON COLUMN daily_logs.deleted_at IS '소프트 삭제 시각 (NULL=활성, NOT NULL=삭제됨, 7일 후 영구 삭제)';
COMMENT ON FUNCTION cleanup_soft_deleted_records IS '7일 지난 소프트 삭제 레코드 영구 삭제 (Supabase cron 또는 수동 호출)';
