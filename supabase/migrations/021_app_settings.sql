-- 앱 전역 설정 테이블 (관리자 전용)
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(100) NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 업데이트 타임스탬프 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_app_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_app_settings_updated_at();

-- RLS 활성화
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 누구나 읽기 가능 (설정값 조회용)
CREATE POLICY "Anyone can read app_settings"
  ON app_settings FOR SELECT
  USING (true);

-- RLS 정책: 관리자만 수정 가능
CREATE POLICY "Only admins can update app_settings"
  ON app_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can insert app_settings"
  ON app_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can delete app_settings"
  ON app_settings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 기본 OCR 설정값 삽입
INSERT INTO app_settings (key, value, description) VALUES
  ('ocr_quick_upload', '{
    "maxSizeMB": 1,
    "initialQuality": 0.85,
    "maxFiles": 5,
    "maxTokens": 8000
  }', '간편 업로드 OCR 설정'),
  ('ocr_batch_upload', '{
    "maxSizeMB": 1,
    "initialQuality": 0.85,
    "maxFiles": 10,
    "maxTokens": 8000
  }', '일괄 업로드 OCR 설정')
ON CONFLICT (key) DO NOTHING;

-- 코멘트 추가
COMMENT ON TABLE app_settings IS '앱 전역 설정 (관리자 전용)';
COMMENT ON COLUMN app_settings.key IS '설정 키 (예: ocr_quick_upload, ocr_batch_upload)';
COMMENT ON COLUMN app_settings.value IS 'JSON 형태의 설정값';
