-- 033: feeding_plans 테이블 (급여 계획)
-- 다중 사료 믹싱, 날짜별 계획 관리, carry-forward 지원

CREATE TABLE IF NOT EXISTS feeding_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL,

  -- 설정 스냅샷
  weight_kg DECIMAL(6,2) NOT NULL,
  is_neutered BOOLEAN NOT NULL DEFAULT false,
  activity_level TEXT NOT NULL DEFAULT 'normal'
    CHECK (activity_level IN ('low', 'normal', 'high')),

  -- 계산 결과
  rer INTEGER NOT NULL,
  activity_factor DECIMAL(4,2) NOT NULL,
  der INTEGER NOT NULL,

  -- 사료 믹싱 (JSONB)
  -- 각 항목: { food_id, name, brand, calorie_density (kcal/g), calorie_density_input, calorie_density_unit, ratio_percent }
  foods JSONB NOT NULL DEFAULT '[]',

  feeding_frequency INTEGER NOT NULL DEFAULT 2,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_pet_plan_date UNIQUE (pet_id, plan_date)
);

CREATE INDEX idx_feeding_plans_user ON feeding_plans (user_id);
CREATE INDEX idx_feeding_plans_pet_date ON feeding_plans (pet_id, plan_date DESC);

ALTER TABLE feeding_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feeding_plans_select" ON feeding_plans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "feeding_plans_insert" ON feeding_plans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "feeding_plans_update" ON feeding_plans FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "feeding_plans_delete" ON feeding_plans FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trigger_feeding_plans_updated_at
  BEFORE UPDATE ON feeding_plans FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
