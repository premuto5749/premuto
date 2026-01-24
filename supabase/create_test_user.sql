-- 테스트 계정 생성 스크립트
-- Supabase Dashboard → SQL Editor에서 실행

-- 기존 테스트 계정 삭제 (있을 경우)
DELETE FROM auth.users WHERE email = 'test@mimo.com';

-- 테스트 계정 생성 (이메일 확인 완료 상태)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'test@mimo.com',
  crypt('test1234', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
);

-- 생성 확인
SELECT id, email, email_confirmed_at, created_at
FROM auth.users
WHERE email = 'test@mimo.com';

-- 테스트 계정 정보
-- 이메일: test@mimo.com
-- 비밀번호: test1234
