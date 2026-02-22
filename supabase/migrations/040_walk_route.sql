-- 040: walk_route (산책 경로) JSONB 컬럼 추가
-- GPS 좌표 배열과 거리 정보를 저장
-- 형식: { "coordinates": [{"lat": 37.5, "lng": 127.0, "timestamp": 1708000000000}, ...], "distance_meters": 1234 }

ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS walk_route JSONB;

-- 산책 경로가 있는 로그만 인덱스 (존재 여부 빠른 확인)
CREATE INDEX IF NOT EXISTS idx_daily_logs_walk_route ON daily_logs ((walk_route IS NOT NULL)) WHERE walk_route IS NOT NULL;
