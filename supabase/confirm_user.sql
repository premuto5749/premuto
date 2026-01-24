-- 기존 사용자 이메일 확인 처리
-- Supabase Dashboard → SQL Editor에서 실행

-- test@mimo.com 계정 이메일 확인 처리
UPDATE auth.users
SET email_confirmed_at = NOW(),
    updated_at = NOW()
WHERE email = 'test@mimo.com';

-- 확인
SELECT
  id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users
WHERE email = 'test@mimo.com';

-- 결과: email_confirmed_at에 시간이 표시되면 성공
