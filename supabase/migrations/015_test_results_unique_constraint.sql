-- test_results 테이블에 UNIQUE 제약 조건 추가
-- 동일 검사 기록(record_id)에 같은 항목(standard_item_id)이 중복 저장되는 것을 방지

-- ============================================
-- 1. 기존 중복 데이터 정리
-- 동일 (record_id, standard_item_id) 조합에서 마지막으로 생성된 레코드만 유지
-- (value가 0이 아닌 것 우선, 그 다음 최신 생성일 기준)
-- ============================================

-- 중복 중 유지할 레코드 ID를 선택하는 임시 테이블
WITH ranked_results AS (
  SELECT
    id,
    record_id,
    standard_item_id,
    value,
    ROW_NUMBER() OVER (
      PARTITION BY record_id, standard_item_id
      ORDER BY
        CASE WHEN value != 0 THEN 0 ELSE 1 END,  -- 0이 아닌 값 우선
        created_at DESC  -- 최신 생성일 우선
    ) as rn
  FROM test_results
),
ids_to_delete AS (
  SELECT id FROM ranked_results WHERE rn > 1
)
DELETE FROM test_results
WHERE id IN (SELECT id FROM ids_to_delete);

-- ============================================
-- 2. UNIQUE 제약 조건 추가
-- ============================================
ALTER TABLE test_results
ADD CONSTRAINT test_results_record_item_unique
UNIQUE (record_id, standard_item_id);

-- ============================================
-- 3. 인덱스 추가 (UNIQUE 제약이 자동으로 인덱스 생성하지만 명시적으로)
-- ============================================
-- 이미 UNIQUE 제약이 인덱스 역할을 하므로 별도 인덱스 불필요
