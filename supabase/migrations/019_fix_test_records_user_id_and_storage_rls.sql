-- ============================================
-- Migration 019: test_records user_id 할당 및 Storage RLS 수정
-- ============================================

-- ============================================
-- 1. test_records.user_id가 NULL인 레코드에 user_id 할당
-- pets 테이블의 user_id를 기반으로 역추적
-- ============================================

-- 1-1. pet_id가 있는 경우: pets 테이블에서 user_id 가져오기
UPDATE test_records tr
SET user_id = (
  SELECT p.user_id FROM pets p
  WHERE p.id = tr.pet_id
  LIMIT 1
)
WHERE tr.user_id IS NULL AND tr.pet_id IS NOT NULL;

-- 1-2. pet_id가 없는 경우: 시스템에 유일한 사용자가 있다면 그 사용자에게 할당
-- (싱글 유저 마이그레이션 용도)
-- 주의: 여러 사용자가 있는 환경에서는 수동으로 처리 필요
DO $$
DECLARE
  v_user_id UUID;
  v_user_count INT;
BEGIN
  -- 사용자 수 확인
  SELECT COUNT(DISTINCT user_id) INTO v_user_count FROM pets;

  -- 사용자가 1명인 경우에만 자동 할당
  IF v_user_count = 1 THEN
    SELECT user_id INTO v_user_id FROM pets LIMIT 1;

    UPDATE test_records
    SET user_id = v_user_id
    WHERE user_id IS NULL;

    RAISE NOTICE 'Assigned % records to user %', (SELECT COUNT(*) FROM test_records WHERE user_id = v_user_id), v_user_id;
  ELSIF v_user_count > 1 THEN
    RAISE NOTICE 'Multiple users found. Please manually assign user_id to test_records where user_id IS NULL';
  END IF;
END $$;

-- ============================================
-- 2. Storage RLS 정책 수정 (daily-log-photos)
-- 기존 정책 삭제 후 authenticated 역할 명시하여 재생성
-- ============================================

-- 2-1. 기존 정책 삭제 (모든 가능한 이름)
DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own photos" ON storage.objects;

-- daily-log-photos 관련 추가 정책명 (Dashboard에서 생성된 경우)
DROP POLICY IF EXISTS "daily_log_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "daily_log_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "daily_log_photos_delete" ON storage.objects;
DROP POLICY IF EXISTS "daily_log_photos_update" ON storage.objects;

-- 새로 생성할 정책명도 미리 삭제 (재실행 대비)
DROP POLICY IF EXISTS "daily_log_photos_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "daily_log_photos_authenticated_select" ON storage.objects;
DROP POLICY IF EXISTS "daily_log_photos_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "daily_log_photos_authenticated_delete" ON storage.objects;

-- 2-2. 새 정책 생성 (TO authenticated 명시)

-- INSERT: 본인 폴더에만 업로드 가능
CREATE POLICY "daily_log_photos_authenticated_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'daily-log-photos' AND
  (storage.foldername(name))[1] = 'uploads' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- SELECT: 본인 폴더만 조회 가능
CREATE POLICY "daily_log_photos_authenticated_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'daily-log-photos' AND
  (storage.foldername(name))[1] = 'uploads' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- UPDATE: 본인 폴더만 수정 가능
CREATE POLICY "daily_log_photos_authenticated_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'daily-log-photos' AND
  (storage.foldername(name))[1] = 'uploads' AND
  (storage.foldername(name))[2] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'daily-log-photos' AND
  (storage.foldername(name))[1] = 'uploads' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- DELETE: 본인 폴더만 삭제 가능
CREATE POLICY "daily_log_photos_authenticated_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'daily-log-photos' AND
  (storage.foldername(name))[1] = 'uploads' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- ============================================
-- 3. 확인용 쿼리 (실행 후 확인)
-- ============================================
-- SELECT
--   COUNT(*) as total,
--   COUNT(user_id) as with_user_id,
--   COUNT(*) - COUNT(user_id) as without_user_id
-- FROM test_records;

-- ============================================
-- Migration Complete
-- ============================================
