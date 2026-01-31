-- 007: Daily Logs RLS (Row Level Security) 설정
-- 사용자별로 본인 기록만 조회/수정 가능

-- 1. user_id 컬럼 추가
ALTER TABLE daily_logs
ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- 2. 기존 데이터에 대한 처리 (선택사항 - 기존 데이터가 있는 경우)
-- 기존 데이터는 특정 사용자에게 할당하거나 삭제해야 함
-- UPDATE daily_logs SET user_id = 'your-user-id' WHERE user_id IS NULL;

-- 3. RLS 활성화
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS 정책 생성

-- SELECT: 본인 기록만 조회 가능
CREATE POLICY "Users can view own daily_logs"
ON daily_logs FOR SELECT
USING (auth.uid() = user_id);

-- INSERT: 본인 ID로만 생성 가능
CREATE POLICY "Users can insert own daily_logs"
ON daily_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- UPDATE: 본인 기록만 수정 가능
CREATE POLICY "Users can update own daily_logs"
ON daily_logs FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE: 본인 기록만 삭제 가능
CREATE POLICY "Users can delete own daily_logs"
ON daily_logs FOR DELETE
USING (auth.uid() = user_id);

-- 5. user_id 인덱스 추가 (성능 최적화)
CREATE INDEX idx_daily_logs_user_id ON daily_logs(user_id);

-- 6. user_id + logged_at 복합 인덱스 (날짜별 조회 최적화)
CREATE INDEX idx_daily_logs_user_date ON daily_logs(user_id, logged_at);

-- 7. daily_stats 뷰 업데이트 (user_id 포함)
DROP VIEW IF EXISTS daily_stats;

CREATE VIEW daily_stats AS
SELECT
  user_id,
  (logged_at AT TIME ZONE 'UTC')::date as log_date,
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
GROUP BY user_id, (logged_at AT TIME ZONE 'UTC')::date;

-- 8. Storage bucket RLS (daily-log-photos)
-- Supabase Dashboard에서 설정 또는 아래 SQL 실행

-- 사용자별 폴더 구조: uploads/{user_id}/filename
-- INSERT: 본인 폴더에만 업로드 가능
CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'daily-log-photos' AND
  (storage.foldername(name))[1] = 'uploads' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- SELECT: 본인 폴더만 조회 가능
CREATE POLICY "Users can view own photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'daily-log-photos' AND
  (storage.foldername(name))[1] = 'uploads' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- DELETE: 본인 폴더만 삭제 가능
CREATE POLICY "Users can delete own photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'daily-log-photos' AND
  (storage.foldername(name))[1] = 'uploads' AND
  (storage.foldername(name))[2] = auth.uid()::text
);
