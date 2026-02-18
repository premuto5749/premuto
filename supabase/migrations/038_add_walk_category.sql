-- 038: walk (산책) 카테고리 추가 + 관련 컬럼
-- walk_end_at: 산책 종료 시각 (NULL = 진행 중)
-- walk_id: 산책 중 기록한 활동 연결용 FK

ALTER TYPE log_category ADD VALUE IF NOT EXISTS 'walk';

ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS walk_end_at TIMESTAMPTZ;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS walk_id UUID REFERENCES daily_logs(id);
