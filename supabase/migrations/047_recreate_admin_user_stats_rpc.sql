-- 046에서 생성되었어야 할 RPC 함수가 실제로 존재하지 않아 재생성
-- CREATE OR REPLACE이므로 이미 존재하더라도 안전

CREATE OR REPLACE FUNCTION get_admin_user_stats()
RETURNS TABLE (
  user_id uuid,
  total_ocr bigint,
  test_records_count bigint,
  daily_logs_count bigint,
  last_usage_at timestamptz,
  last_test_at timestamptz,
  last_daily_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.user_id,
    COALESCE(ocr.cnt, 0) AS total_ocr,
    COALESCE(tr.cnt, 0) AS test_records_count,
    COALESCE(dl.cnt, 0) AS daily_logs_count,
    ul.last_at AS last_usage_at,
    tr.last_at AS last_test_at,
    dl.last_at AS last_daily_at
  FROM (SELECT DISTINCT user_id FROM user_profiles) u
  LEFT JOIN (
    SELECT user_id, COUNT(*) AS cnt
    FROM usage_logs
    WHERE action = 'ocr_analysis'
    GROUP BY user_id
  ) ocr ON u.user_id = ocr.user_id
  LEFT JOIN (
    SELECT user_id, MAX(created_at) AS last_at
    FROM usage_logs
    GROUP BY user_id
  ) ul ON u.user_id = ul.user_id
  LEFT JOIN (
    SELECT user_id, COUNT(*) AS cnt, MAX(created_at) AS last_at
    FROM test_records
    GROUP BY user_id
  ) tr ON u.user_id = tr.user_id
  LEFT JOIN (
    SELECT user_id, COUNT(*) AS cnt, MAX(created_at) AS last_at
    FROM daily_logs
    WHERE deleted_at IS NULL
    GROUP BY user_id
  ) dl ON u.user_id = dl.user_id;
$$;
