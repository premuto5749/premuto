-- 진료 녹음 기록 기능: vet_visits + consent_logs 테이블

-- 1. vet_visits 테이블
CREATE TABLE IF NOT EXISTS vet_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL,
  hospital_name TEXT,
  vet_name TEXT,
  diagnosis TEXT[] DEFAULT '{}',
  prescriptions JSONB DEFAULT '[]',
  procedures TEXT,
  next_visit_date DATE,
  vet_instructions TEXT,
  cost INTEGER,
  transcript TEXT,
  audio_file_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- RLS
ALTER TABLE vet_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vet_visits_select_own" ON vet_visits
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "vet_visits_insert_own" ON vet_visits
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "vet_visits_update_own" ON vet_visits
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "vet_visits_delete_own" ON vet_visits
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Admin SELECT (user_roles 테이블 기반)
CREATE POLICY "vet_visits_admin_select" ON vet_visits
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin')
    )
  );

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_vet_visits_user_id ON vet_visits (user_id);
CREATE INDEX IF NOT EXISTS idx_vet_visits_pet_id ON vet_visits (pet_id);
CREATE INDEX IF NOT EXISTS idx_vet_visits_visit_date ON vet_visits (user_id, pet_id, visit_date);

-- updated_at 트리거
CREATE OR REPLACE FUNCTION update_vet_visits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_vet_visits_updated_at
  BEFORE UPDATE ON vet_visits
  FOR EACH ROW
  EXECUTE FUNCTION update_vet_visits_updated_at();

-- 2. consent_logs 테이블
CREATE TABLE IF NOT EXISTS consent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL,
  agreed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'
);

ALTER TABLE consent_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consent_logs_select_own" ON consent_logs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "consent_logs_insert_own" ON consent_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_consent_logs_user_id ON consent_logs (user_id);

-- 3. Storage 버킷 (vet-recordings)
INSERT INTO storage.buckets (id, name, public)
VALUES ('vet-recordings', 'vet-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
CREATE POLICY "vet_recordings_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vet-recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "vet_recordings_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'vet-recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "vet_recordings_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'vet-recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
