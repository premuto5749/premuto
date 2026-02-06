-- =====================================================
-- Migration: 025_fix_user_roles_recursion
-- Description: user_roles RLS 무한재귀 해결 + admin 관련 정책 정리
-- =====================================================

-- 1. SECURITY DEFINER 함수: RLS 우회하여 admin 여부 확인
CREATE OR REPLACE FUNCTION is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = check_user_id
    AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION is_admin IS 'RLS 우회하여 사용자의 admin 여부 확인 (SECURITY DEFINER)';

-- 2. user_roles: 무한재귀 정책 교체
DROP POLICY IF EXISTS "Super admins can manage roles" ON user_roles;

CREATE POLICY "Super admins can manage roles"
  ON user_roles FOR ALL
  USING (is_admin());

-- 3. user_profiles: 기존 정책을 is_admin() 함수로 교체
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can update profiles" ON user_profiles;
CREATE POLICY "Admins can update profiles"
  ON user_profiles FOR UPDATE
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can insert profiles" ON user_profiles;
CREATE POLICY "Admins can insert profiles"
  ON user_profiles FOR INSERT
  WITH CHECK (is_admin());

-- 4. usage_logs: admin 정책도 동일하게 교체
DROP POLICY IF EXISTS "Admins can view all usage" ON usage_logs;
CREATE POLICY "Admins can view all usage"
  ON usage_logs FOR SELECT
  USING (is_admin());
