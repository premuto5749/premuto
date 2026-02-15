-- 035: daily_stats 뷰 재생성 (snack 집계 추가)
-- 034에서 추가된 'snack' enum 값을 별도 트랜잭션에서 사용

DROP VIEW IF EXISTS daily_stats;

CREATE VIEW daily_stats AS
SELECT
  user_id,
  pet_id,
  (logged_at AT TIME ZONE 'Asia/Seoul')::date AS log_date,
  COALESCE(SUM(CASE WHEN category = 'meal' THEN COALESCE(amount, 0) - COALESCE(leftover_amount, 0) END), 0) AS total_meal_amount,
  COUNT(CASE WHEN category = 'meal' THEN 1 END) AS meal_count,
  COALESCE(SUM(CASE WHEN category = 'water' THEN amount END), 0) AS total_water_amount,
  COUNT(CASE WHEN category = 'water' THEN 1 END) AS water_count,
  COUNT(CASE WHEN category = 'medicine' THEN 1 END) AS medicine_count,
  COUNT(CASE WHEN category = 'poop' THEN 1 END) AS poop_count,
  COUNT(CASE WHEN category = 'pee' THEN 1 END) AS pee_count,
  ROUND(AVG(CASE WHEN category = 'breathing' THEN amount END)::numeric, 1) AS avg_breathing_rate,
  COUNT(CASE WHEN category = 'breathing' THEN 1 END) AS breathing_count,
  COUNT(CASE WHEN category = 'snack' THEN 1 END) AS snack_count,
  COALESCE(SUM(CASE WHEN category = 'snack' THEN amount END), 0) AS total_snack_amount,
  COALESCE(SUM(CASE WHEN category = 'snack' THEN calories END), 0) AS total_snack_calories
FROM daily_logs
WHERE deleted_at IS NULL
GROUP BY user_id, pet_id, (logged_at AT TIME ZONE 'Asia/Seoul')::date;
