-- 049: walk_id FK에 ON DELETE SET NULL 추가
-- 산책 기록 영구삭제 시 연결된 로그의 walk_id를 NULL로 안전하게 해제

ALTER TABLE daily_logs
  DROP CONSTRAINT IF EXISTS daily_logs_walk_id_fkey;

ALTER TABLE daily_logs
  ADD CONSTRAINT daily_logs_walk_id_fkey
  FOREIGN KEY (walk_id) REFERENCES daily_logs(id) ON DELETE SET NULL;
