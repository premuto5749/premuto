-- 030: 체중 조회 성능 인덱스 (029에서 분리 - 새 enum 값 커밋 후 생성 필요)
CREATE INDEX IF NOT EXISTS idx_daily_logs_weight_lookup
  ON daily_logs(user_id, pet_id, logged_at DESC)
  WHERE category = 'weight' AND deleted_at IS NULL;
