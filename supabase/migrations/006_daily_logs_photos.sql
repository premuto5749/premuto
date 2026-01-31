-- 006: Daily Logs 사진 첨부 기능 업데이트
-- 단일 photo_url에서 다중 photo_urls로 변경 (최대 5장)

-- 1. 기존 photo_url 데이터를 photo_urls 배열로 마이그레이션
ALTER TABLE daily_logs
ADD COLUMN photo_urls JSONB DEFAULT '[]'::jsonb;

-- 2. 기존 데이터 마이그레이션 (photo_url이 있는 경우 배열로 변환)
UPDATE daily_logs
SET photo_urls = jsonb_build_array(photo_url)
WHERE photo_url IS NOT NULL AND photo_url != '';

-- 3. 기존 photo_url 컬럼 제거
ALTER TABLE daily_logs
DROP COLUMN photo_url;

-- 4. Storage bucket 생성 안내 (Supabase Dashboard에서 수동 생성 필요)
-- Bucket name: daily-log-photos
-- Public: true (또는 RLS 정책 설정)
-- Allowed MIME types: image/jpeg, image/png, image/webp
-- File size limit: 5MB

COMMENT ON COLUMN daily_logs.photo_urls IS '사진 URL 배열 (최대 5장). 형식: ["url1", "url2", ...]';
