-- =====================================================
-- Migration: 040_add_terms_accepted_at
-- Description: user_profiles에 이용약관 동의 시점 기록 컬럼 추가
-- =====================================================

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

COMMENT ON COLUMN user_profiles.terms_accepted_at IS '이용약관 및 개인정보처리방침 동의 시점';
