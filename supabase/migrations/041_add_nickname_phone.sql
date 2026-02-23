-- =====================================================
-- Migration: 041_add_nickname_phone
-- Description: user_profiles에 닉네임, 전화번호 컬럼 추가
-- =====================================================

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS nickname TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN user_profiles.nickname IS '사용자 닉네임 (카카오: 카카오닉네임, 이메일: 랜덤생성)';
COMMENT ON COLUMN user_profiles.phone IS '전화번호 (카카오 동의항목에서 수집)';
