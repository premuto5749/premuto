-- =====================================================
-- Migration: 022_tier_system
-- Description: 사용자 Tier 시스템 (일일 AI 사용 제한)
-- =====================================================

-- 1. user_profiles 테이블 (사용자별 tier 저장)
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'basic', 'premium')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_tier ON user_profiles(tier);

-- RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update profiles"
  ON user_profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Auto-create profile on first access"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can insert profiles"
  ON user_profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- updated_at 트리거
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profiles_updated_at();

-- 2. usage_logs 테이블 (사용량 추적)
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,        -- 'ocr_analysis', 'daily_log_photo'
  file_count INT DEFAULT 1,
  metadata JSONB DEFAULT '{}', -- 추가 정보 (파일명 등)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_logs_user_action ON usage_logs(user_id, action, created_at);

-- RLS
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
  ON usage_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage"
  ON usage_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all usage"
  ON usage_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- 3. tier_config를 app_settings에 추가
INSERT INTO app_settings (key, value, description) VALUES
  ('tier_config', '{
    "free": {
      "label": "무료",
      "daily_ocr_limit": 2,
      "max_files_per_ocr": 3,
      "daily_log_max_photos": 3,
      "daily_log_max_photo_size_mb": 5
    },
    "basic": {
      "label": "기본",
      "daily_ocr_limit": 5,
      "max_files_per_ocr": 5,
      "daily_log_max_photos": 5,
      "daily_log_max_photo_size_mb": 10
    },
    "premium": {
      "label": "프리미엄",
      "daily_ocr_limit": -1,
      "max_files_per_ocr": 10,
      "daily_log_max_photos": 10,
      "daily_log_max_photo_size_mb": 10
    }
  }', 'Tier별 사용 제한 설정 (-1 = 무제한)')
ON CONFLICT (key) DO NOTHING;

-- 코멘트
COMMENT ON TABLE user_profiles IS '사용자 프로필 (tier 정보)';
COMMENT ON TABLE usage_logs IS '사용량 기록 (일일 제한 체크용)';
