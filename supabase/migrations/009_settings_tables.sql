-- 사용자 설정 테이블
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 반려동물 프로필
  pet_name VARCHAR(100) DEFAULT '미모',
  pet_type VARCHAR(50),                    -- 예: 고양이, 강아지
  pet_breed VARCHAR(100),                  -- 품종
  pet_birth_date DATE,                     -- 생년월일
  pet_weight_kg DECIMAL(5, 2),             -- 체중 (kg)
  pet_photo_url TEXT,                      -- 프로필 사진 URL

  -- 테마 설정
  theme VARCHAR(20) DEFAULT 'system',      -- light, dark, system

  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),

  CONSTRAINT unique_user_settings UNIQUE (user_id)
);

-- 약 프리셋 테이블
CREATE TABLE IF NOT EXISTS medicine_presets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  preset_name VARCHAR(100) NOT NULL,        -- 프리셋 이름 (예: "아침 약", "저녁 약")
  medicines JSONB NOT NULL DEFAULT '[]',    -- 약물 목록
  -- [
  --   { "name": "타이레놀", "dosage": 500, "dosage_unit": "mg", "frequency": "bid" },
  --   { "name": "오메가3", "dosage": 1, "dosage_unit": "tablet", "frequency": "qd" }
  -- ]

  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 인덱스 생성
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX idx_medicine_presets_user_id ON medicine_presets(user_id);

-- 업데이트 타임스탬프 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_settings_updated_at();

CREATE OR REPLACE FUNCTION update_medicine_presets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER medicine_presets_updated_at
  BEFORE UPDATE ON medicine_presets
  FOR EACH ROW
  EXECUTE FUNCTION update_medicine_presets_updated_at();

-- RLS (Row Level Security) 활성화
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicine_presets ENABLE ROW LEVEL SECURITY;

-- hospitals 테이블에 RLS 활성화 및 user_id 추가
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;

-- user_settings RLS 정책
CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own settings"
  ON user_settings FOR DELETE
  USING (auth.uid() = user_id);

-- medicine_presets RLS 정책
CREATE POLICY "Users can view own presets"
  ON medicine_presets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own presets"
  ON medicine_presets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own presets"
  ON medicine_presets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own presets"
  ON medicine_presets FOR DELETE
  USING (auth.uid() = user_id);

-- hospitals RLS 정책
CREATE POLICY "Users can view own hospitals"
  ON hospitals FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert own hospitals"
  ON hospitals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own hospitals"
  ON hospitals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own hospitals"
  ON hospitals FOR DELETE
  USING (auth.uid() = user_id);

-- 코멘트 추가
COMMENT ON TABLE user_settings IS '사용자별 앱 설정';
COMMENT ON TABLE medicine_presets IS '약 프리셋 (자주 사용하는 약 조합)';
COMMENT ON COLUMN medicine_presets.medicines IS '약물 목록: [{name, dosage, dosage_unit, frequency}]';
