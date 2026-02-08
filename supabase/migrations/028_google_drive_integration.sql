-- Google Drive 연동 테이블
-- google_drive_connections: 사용자별 Google Drive 연결 정보
-- google_drive_sync_log: 파일 동기화 기록

-- =====================================================
-- 1. Google Drive 연결 정보
-- =====================================================
CREATE TABLE IF NOT EXISTS google_drive_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  google_email TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  root_folder_id TEXT,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_gdc_user_id ON google_drive_connections(user_id);

-- RLS 활성화
ALTER TABLE google_drive_connections ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 본인 데이터만 접근
CREATE POLICY "Users can view own drive connections"
  ON google_drive_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own drive connections"
  ON google_drive_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own drive connections"
  ON google_drive_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own drive connections"
  ON google_drive_connections FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- 2. Google Drive 동기화 로그
-- =====================================================
CREATE TABLE IF NOT EXISTS google_drive_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('daily_log_photo', 'ocr_source')),
  source_id TEXT,
  file_name TEXT NOT NULL,
  drive_file_id TEXT,
  drive_folder_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'uploading', 'success', 'failed')),
  error_message TEXT,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_gdsl_user_id ON google_drive_sync_log(user_id);
CREATE INDEX IF NOT EXISTS idx_gdsl_status ON google_drive_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_gdsl_created_at ON google_drive_sync_log(created_at DESC);

-- RLS 활성화
ALTER TABLE google_drive_sync_log ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 본인 데이터만 접근
CREATE POLICY "Users can view own sync logs"
  ON google_drive_sync_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sync logs"
  ON google_drive_sync_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sync logs"
  ON google_drive_sync_log FOR UPDATE
  USING (auth.uid() = user_id);

-- service_role을 위한 정책 (서버사이드에서 sync log 기록 시)
-- Note: service_role은 RLS를 우회하므로 별도 정책 불필요
