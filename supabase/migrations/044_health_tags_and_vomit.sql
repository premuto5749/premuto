-- 044: 건강 태그 + 구토/기타 enum 추가
-- NOTE: ALTER TYPE ADD VALUE는 별도 트랜잭션이 필요하므로 뷰는 044b에서 재생성

-- 1. tags JSONB 컬럼 추가
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT NULL;

-- 2. vomit, note enum 추가
ALTER TYPE log_category ADD VALUE IF NOT EXISTS 'vomit';
ALTER TYPE log_category ADD VALUE IF NOT EXISTS 'note';
