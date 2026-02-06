-- =====================================================
-- Migration: 024_fix_daily_stats_view
-- Description: daily_stats 뷰 재생성 (deleted_at IS NULL 필터 보장)
-- Note: 023에서 이미 정의했으나, 적용 여부 불확실하여 확실히 재생성
-- =====================================================

DROP VIEW IF EXISTS daily_stats;

CREATE VIEW daily_stats AS
SELECT
  user_id,
  pet_id,
  (logged_at AT TIME ZONE 'Asia/Seoul')::date as log_date,
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
WHERE deleted_at IS NULL
GROUP BY user_id, pet_id, (logged_at AT TIME ZONE 'Asia/Seoul')::date;

COMMENT ON VIEW daily_stats IS '일일 통계 뷰 - 소프트 삭제된 기록 제외, 식사량은 급여량에서 남긴양을 뺀 값으로 계산';
