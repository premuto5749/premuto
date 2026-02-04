-- Migration 018: test_records에 pet_id 컬럼 추가
-- 검사 기록을 반려동물별로 분리하기 위한 마이그레이션

-- 1. test_records 테이블에 pet_id 컬럼 추가
ALTER TABLE test_records
ADD COLUMN IF NOT EXISTS pet_id UUID REFERENCES pets(id) ON DELETE SET NULL;

-- 2. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_test_records_pet ON test_records(pet_id);
CREATE INDEX IF NOT EXISTS idx_test_records_user_pet ON test_records(user_id, pet_id);
CREATE INDEX IF NOT EXISTS idx_test_records_user_pet_date ON test_records(user_id, pet_id, test_date DESC);

-- 3. 기존 데이터에 기본 반려동물 할당 (각 사용자의 is_default=true인 펫 또는 가장 먼저 등록된 펫)
UPDATE test_records tr
SET pet_id = (
  SELECT p.id FROM pets p
  WHERE p.user_id = tr.user_id
  ORDER BY p.is_default DESC NULLS LAST, p.created_at ASC
  LIMIT 1
)
WHERE tr.pet_id IS NULL AND tr.user_id IS NOT NULL;

-- 4. RLS 정책 업데이트 - 펫 기반 접근 제어 강화
-- 기존 정책 삭제 후 재생성
DROP POLICY IF EXISTS "Users can view own test records" ON test_records;
DROP POLICY IF EXISTS "Users can insert own test records" ON test_records;
DROP POLICY IF EXISTS "Users can update own test records" ON test_records;
DROP POLICY IF EXISTS "Users can delete own test records" ON test_records;

-- 새 정책: 본인 데이터만 접근 가능 (user_id 기반)
CREATE POLICY "Users can view own test records" ON test_records
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own test records" ON test_records
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own test records" ON test_records
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own test records" ON test_records
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 5. test_results도 RLS 정책 확인 (test_records를 통한 간접 보호)
DROP POLICY IF EXISTS "Users can view own test results" ON test_results;
DROP POLICY IF EXISTS "Users can insert own test results" ON test_results;
DROP POLICY IF EXISTS "Users can update own test results" ON test_results;
DROP POLICY IF EXISTS "Users can delete own test results" ON test_results;

CREATE POLICY "Users can view own test results" ON test_results
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM test_records tr
    WHERE tr.id = test_results.record_id AND tr.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own test results" ON test_results
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM test_records tr
    WHERE tr.id = test_results.record_id AND tr.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own test results" ON test_results
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM test_records tr
    WHERE tr.id = test_results.record_id AND tr.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM test_records tr
    WHERE tr.id = test_results.record_id AND tr.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own test results" ON test_results
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM test_records tr
    WHERE tr.id = test_results.record_id AND tr.user_id = auth.uid()
  ));

-- 6. 코멘트 추가
COMMENT ON COLUMN test_records.pet_id IS '검사 기록이 속한 반려동물 ID';
