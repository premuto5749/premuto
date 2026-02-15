-- 034: 간식(snack) 카테고리 추가 및 snack_presets 테이블 생성

-- 1) log_category enum에 'snack' 추가
ALTER TYPE log_category ADD VALUE IF NOT EXISTS 'snack';

-- 2) daily_logs에 snack_name, calories 컬럼 추가
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS snack_name VARCHAR(100);
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS calories DECIMAL(8, 2);

-- 3) snack_presets 테이블 생성
CREATE TABLE IF NOT EXISTS snack_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id UUID REFERENCES pets(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  default_amount DECIMAL(10, 2),
  calories_per_unit DECIMAL(8, 2),
  unit VARCHAR(20) DEFAULT 'g',
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE snack_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own snack presets" ON snack_presets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4) daily_stats 뷰 재생성 (snack_count, total_snack_calories 추가)
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
