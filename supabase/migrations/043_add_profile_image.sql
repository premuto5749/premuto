-- =====================================================
-- Migration: 043_add_profile_image
-- Description: user_profiles에 프로필 이미지 URL 컬럼 추가
-- =====================================================

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS profile_image TEXT;

COMMENT ON COLUMN user_profiles.profile_image IS '프로필 이미지 URL (카카오 프로필 등)';
