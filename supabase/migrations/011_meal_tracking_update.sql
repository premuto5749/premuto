-- 011: 식사 기록 개선 및 pet_id 매핑
-- 1. 기존 null pet_id를 특정 반려동물에 매핑
-- 2. daily_logs에 leftover_amount 컬럼 추가
-- 3. daily_stats 뷰 수정 (식사량 = 급여량 - 남긴양)

-- ============================================
-- 1. 기존 기록의 pet_id 매핑
-- ============================================
UPDATE daily_logs
SET pet_id = '4810c7fb-ae98-4c07-a59e-b5f25c46d9f5'
WHERE pet_id IS NULL;

-- ============================================
-- 2. leftover_amount 컬럼 추가
-- ============================================
ALTER TABLE daily_logs
ADD COLUMN IF NOT EXISTS leftover_amount DECIMAL(10, 2) DEFAULT 0;

COMMENT ON COLUMN daily_logs.leftover_amount IS '남긴 양 (식사 카테고리에서 사용)';

-- ============================================
-- 3. daily_stats 뷰 수정
-- 식사량 = amount(급여량) - leftover_amount(남긴양)
-- ============================================
DROP VIEW IF EXISTS daily_stats;

CREATE VIEW daily_stats AS
SELECT
  user_id,
  pet_id,
  -- KST(UTC+9) 기준으로 날짜 추출
  (logged_at AT TIME ZONE 'Asia/Seoul')::date as log_date,
  -- 식사량 = 급여량 - 남긴양 (meal 카테고리만)
  SUM(CASE WHEN category = 'meal' THEN COALESCE(amount, 0) - COALESCE(leftover_amount, 0) ELSE 0 END) as total_meal_amount,
  COUNT(CASE WHEN category = 'meal' THEN 1 END) as meal_count,
  SUM(CASE WHEN category = 'water' THEN amount ELSE 0 END) as total_water_amount,
  COUNT(CASE WHEN category = 'water' THEN 1 END) as water_count,
  COUNT(CASE WHEN category = 'medicine' THEN 1 END) as medicine_count,
  COUNT(CASE WHEN category = 'poop' THEN 1 END) as poop_count,
  COUNT(CASE WHEN category = 'pee' THEN 1 END) as pee_count,
  AVG(CASE WHEN category = 'breathing' THEN amount END) as avg_breathing_rate,
  COUNT(CASE WHEN category = 'breathing' THEN 1 END) as breathing_count
FROM daily_logs
GROUP BY user_id, pet_id, (logged_at AT TIME ZONE 'Asia/Seoul')::date;

-- 코멘트 추가
COMMENT ON VIEW daily_stats IS '일일 통계 뷰 - 식사량은 급여량에서 남긴양을 뺀 값으로 계산';
