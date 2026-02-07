-- =====================================================
-- Migration: 027_add_detailed_export_limit
-- Description: tier_config에 월간 상세 내보내기 제한 추가
-- =====================================================

-- app_settings의 tier_config에 monthly_detailed_export_limit 필드 추가
-- free: 1 (월 1회), basic: -1 (무제한), premium: -1 (무제한)
UPDATE app_settings
SET value = jsonb_set(
  jsonb_set(
    jsonb_set(
      value::jsonb,
      '{free,monthly_detailed_export_limit}',
      '1'
    ),
    '{basic,monthly_detailed_export_limit}',
    '-1'
  ),
  '{premium,monthly_detailed_export_limit}',
  '-1'
)
WHERE key = 'tier_config';
