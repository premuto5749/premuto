-- 010: 반려동물 다중 지원 및 타임존 버그 수정
-- 1. pets 테이블 생성 (다중 반려동물 지원)
-- 2. daily_stats 뷰 타임존 수정 (UTC -> KST)
-- 3. daily_logs에 pet_id 추가

-- ============================================
-- 1. pets 테이블 생성
-- ============================================
CREATE TABLE IF NOT EXISTS pets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name VARCHAR(100) NOT NULL,
  type VARCHAR(50),                              -- 고양이, 강아지, 기타
  breed VARCHAR(100),                            -- 품종
  birth_date DATE,                               -- 생년월일
  weight_kg DECIMAL(5, 2),                       -- 체중 (kg)
  photo_url TEXT,                                -- 프로필 사진 URL

  is_default BOOLEAN DEFAULT FALSE,             -- 기본 반려동물 여부
  sort_order INTEGER DEFAULT 0,                 -- 정렬 순서

  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 인덱스 생성
CREATE INDEX idx_pets_user_id ON pets(user_id);
CREATE INDEX idx_pets_user_default ON pets(user_id, is_default);

-- RLS 활성화
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;

-- RLS 정책
CREATE POLICY "Users can view own pets"
  ON pets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pets"
  ON pets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pets"
  ON pets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pets"
  ON pets FOR DELETE
  USING (auth.uid() = user_id);

-- 업데이트 트리거
CREATE OR REPLACE FUNCTION update_pets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pets_updated_at
  BEFORE UPDATE ON pets
  FOR EACH ROW
  EXECUTE FUNCTION update_pets_updated_at();

-- ============================================
-- 2. daily_logs에 pet_id 추가
-- ============================================
ALTER TABLE daily_logs
ADD COLUMN IF NOT EXISTS pet_id UUID REFERENCES pets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_daily_logs_pet_id ON daily_logs(pet_id);

-- ============================================
-- 3. daily_stats 뷰 타임존 수정 (핵심 버그 수정)
-- 기존: (logged_at AT TIME ZONE 'UTC')::date -> UTC 기준으로 날짜 추출
-- 수정: (logged_at AT TIME ZONE 'Asia/Seoul')::date -> KST 기준으로 날짜 추출
-- ============================================
DROP VIEW IF EXISTS daily_stats;

CREATE VIEW daily_stats AS
SELECT
  user_id,
  pet_id,
  -- KST(UTC+9) 기준으로 날짜 추출 (핵심 수정!)
  (logged_at AT TIME ZONE 'Asia/Seoul')::date as log_date,
  SUM(CASE WHEN category = 'meal' THEN amount ELSE 0 END) as total_meal_amount,
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

-- ============================================
-- 4. 기존 user_settings의 반려동물 정보를 pets로 마이그레이션
-- ============================================

-- 기존 user_settings에서 pets 테이블로 데이터 이전 (기존 데이터가 있는 경우)
-- 이 작업은 별도로 실행하거나, 앱에서 처리할 수 있음
-- INSERT INTO pets (user_id, name, type, breed, birth_date, weight_kg, photo_url, is_default)
-- SELECT user_id, pet_name, pet_type, pet_breed, pet_birth_date, pet_weight_kg, pet_photo_url, TRUE
-- FROM user_settings
-- WHERE pet_name IS NOT NULL
-- ON CONFLICT DO NOTHING;

-- ============================================
-- 5. pet-photos 스토리지 버킷 RLS 정책
-- ============================================

-- 사용자별 폴더 구조: pets/{user_id}/filename
CREATE POLICY "Users can upload pet photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'pet-photos' AND
  (storage.foldername(name))[1] = 'pets' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Users can view pet photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'pet-photos' AND
  (storage.foldername(name))[1] = 'pets' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Users can delete pet photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'pet-photos' AND
  (storage.foldername(name))[1] = 'pets' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Public 접근 허용 (프로필 사진이므로)
CREATE POLICY "Public can view pet photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'pet-photos');

-- 코멘트 추가
COMMENT ON TABLE pets IS '반려동물 프로필 (다중 지원)';
COMMENT ON COLUMN pets.is_default IS '기본 선택된 반려동물 여부';
COMMENT ON COLUMN daily_logs.pet_id IS '해당 기록의 반려동물 ID';
