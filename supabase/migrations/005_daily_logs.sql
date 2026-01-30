-- Daily Health Logs Table
-- 반려동물 일일 건강 기록 (식사, 음수, 약, 배변, 배뇨, 호흡수)

-- 기록 카테고리 enum
CREATE TYPE log_category AS ENUM (
  'meal',      -- 식사
  'water',     -- 음수
  'medicine',  -- 약
  'poop',      -- 배변
  'pee',       -- 배뇨
  'breathing'  -- 호흡수
);

-- 일일 건강 기록 테이블
CREATE TABLE daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 기록 정보
  category log_category NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- 기록 시간

  -- 수치 정보
  amount DECIMAL(10, 2),          -- 양 (g, ml 등)
  unit VARCHAR(20),               -- 단위 (g, ml, 회, 회/분 등)

  -- 추가 정보
  memo TEXT,                      -- 메모
  photo_url TEXT,                 -- 사진 URL (Supabase Storage)

  -- 약 관련 추가 정보
  medicine_name VARCHAR(100),     -- 약 이름 (category가 medicine일 때)

  -- 메타데이터
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스: 날짜별 조회 최적화
CREATE INDEX idx_daily_logs_logged_at ON daily_logs(logged_at DESC);
CREATE INDEX idx_daily_logs_category ON daily_logs(category);
CREATE INDEX idx_daily_logs_date ON daily_logs(DATE(logged_at));

-- Updated at 트리거
CREATE OR REPLACE FUNCTION update_daily_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_daily_logs_updated_at
  BEFORE UPDATE ON daily_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_logs_updated_at();

-- RLS 정책 (Row Level Security)
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기/쓰기 가능 (단일 사용자 앱이므로)
CREATE POLICY "Allow all access to daily_logs" ON daily_logs
  FOR ALL USING (true) WITH CHECK (true);

-- 일일 통계 뷰 (선택적)
CREATE OR REPLACE VIEW daily_stats AS
SELECT
  DATE(logged_at) as log_date,

  -- 식사 통계
  SUM(CASE WHEN category = 'meal' THEN amount ELSE 0 END) as total_meal_amount,
  COUNT(CASE WHEN category = 'meal' THEN 1 END) as meal_count,

  -- 음수 통계
  SUM(CASE WHEN category = 'water' THEN amount ELSE 0 END) as total_water_amount,
  COUNT(CASE WHEN category = 'water' THEN 1 END) as water_count,

  -- 약 통계
  COUNT(CASE WHEN category = 'medicine' THEN 1 END) as medicine_count,

  -- 배변 통계
  COUNT(CASE WHEN category = 'poop' THEN 1 END) as poop_count,

  -- 배뇨 통계
  COUNT(CASE WHEN category = 'pee' THEN 1 END) as pee_count,

  -- 호흡수 통계
  AVG(CASE WHEN category = 'breathing' THEN amount END) as avg_breathing_rate,
  COUNT(CASE WHEN category = 'breathing' THEN 1 END) as breathing_count

FROM daily_logs
GROUP BY DATE(logged_at)
ORDER BY log_date DESC;

-- 코멘트
COMMENT ON TABLE daily_logs IS '반려동물 일일 건강 기록';
COMMENT ON COLUMN daily_logs.category IS '기록 유형: meal(식사), water(음수), medicine(약), poop(배변), pee(배뇨), breathing(호흡수)';
COMMENT ON COLUMN daily_logs.amount IS '양 또는 수치 (식사g, 음수ml, 호흡수 회/분 등)';
COMMENT ON COLUMN daily_logs.logged_at IS '실제 기록 시간 (사용자가 지정)';
