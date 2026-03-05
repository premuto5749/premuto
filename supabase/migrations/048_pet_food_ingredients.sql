-- 048: pet_food_ingredients - 사료/간식 성분 관리 확장

-- 1) nutrient_units 마스터 테이블
CREATE TABLE IF NOT EXISTS nutrient_units (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INT DEFAULT 0
);

INSERT INTO nutrient_units (symbol, label, sort_order) VALUES
  ('%', '퍼센트', 1),
  ('mg/kg', 'mg/kg', 2),
  ('IU/kg', 'IU/kg', 3),
  ('mg', 'mg', 4),
  ('ug', 'ug', 5),
  ('kcal/kg', 'kcal/kg', 6),
  ('g/kg', 'g/kg', 7),
  ('ppm', 'ppm', 8);

ALTER TABLE nutrient_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nutrient_units_select" ON nutrient_units FOR SELECT TO authenticated USING (true);

-- 2) pet_foods 테이블 확장
ALTER TABLE pet_foods ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE pet_foods ADD COLUMN IF NOT EXISTS pet_id UUID REFERENCES pets(id) ON DELETE SET NULL;
ALTER TABLE pet_foods ADD COLUMN IF NOT EXISTS food_category TEXT DEFAULT '건사료'
  CHECK (food_category IN ('건사료','습식','생식','간식','보충제/영양제'));
ALTER TABLE pet_foods ADD COLUMN IF NOT EXISTS ingredients_text TEXT;
ALTER TABLE pet_foods ADD COLUMN IF NOT EXISTS photo_urls TEXT[];
ALTER TABLE pet_foods ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 기존 food_type 데이터를 food_category로 이전
UPDATE pet_foods SET food_category = food_type WHERE food_type IS NOT NULL;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_pet_foods_user_id ON pet_foods (user_id);
CREATE INDEX IF NOT EXISTS idx_pet_foods_pet_id ON pet_foods (pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_foods_food_category ON pet_foods (food_category);

-- 3) RLS 정책 교체 (사용자 등록 허용)
DROP POLICY IF EXISTS "pet_foods_select" ON pet_foods;
CREATE POLICY "pet_foods_select" ON pet_foods FOR SELECT TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "pet_foods_user_insert" ON pet_foods FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "pet_foods_user_update" ON pet_foods FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "pet_foods_user_delete" ON pet_foods FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 4) pet_food_nutrients 테이블
CREATE TABLE IF NOT EXISTS pet_food_nutrients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_food_id UUID NOT NULL REFERENCES pet_foods(id) ON DELETE CASCADE,
  nutrient_name TEXT NOT NULL,
  value DECIMAL(10,4) NOT NULL,
  unit_id UUID REFERENCES nutrient_units(id),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pet_food_nutrients_food_id ON pet_food_nutrients (pet_food_id);

ALTER TABLE pet_food_nutrients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nutrients_select" ON pet_food_nutrients FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM pet_foods WHERE id = pet_food_id
    AND (user_id IS NULL OR user_id = auth.uid())
  ));
CREATE POLICY "nutrients_insert" ON pet_food_nutrients FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM pet_foods WHERE id = pet_food_id AND user_id = auth.uid()
  ));
CREATE POLICY "nutrients_update" ON pet_food_nutrients FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM pet_foods WHERE id = pet_food_id AND user_id = auth.uid()
  ));
CREATE POLICY "nutrients_delete" ON pet_food_nutrients FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM pet_foods WHERE id = pet_food_id AND user_id = auth.uid()
  ));

-- 5) Storage bucket for pet food photos
INSERT INTO storage.buckets (id, name, public) VALUES ('pet-food-photos', 'pet-food-photos', false)
  ON CONFLICT DO NOTHING;

CREATE POLICY "pet_food_photos_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pet-food-photos' AND (storage.foldername(name))[1] = 'uploads' AND (storage.foldername(name))[2] = auth.uid()::text);
CREATE POLICY "pet_food_photos_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pet-food-photos' AND (storage.foldername(name))[1] = 'uploads' AND (storage.foldername(name))[2] = auth.uid()::text);
CREATE POLICY "pet_food_photos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pet-food-photos' AND (storage.foldername(name))[1] = 'uploads' AND (storage.foldername(name))[2] = auth.uid()::text);
