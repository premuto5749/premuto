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
