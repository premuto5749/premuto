-- ============================================
-- 032: pet_foods 테이블 (사료 데이터베이스)
-- ============================================

CREATE TABLE IF NOT EXISTS pet_foods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,                          -- 사료명
  brand TEXT,                                  -- 브랜드
  calorie_density DECIMAL(6,2) NOT NULL,       -- kcal/g
  food_type TEXT DEFAULT '건사료'
    CHECK (food_type IN ('건사료', '습식', '기타')),
  target_animal TEXT DEFAULT '공통'
    CHECK (target_animal IN ('강아지', '고양이', '공통')),
  memo TEXT,                                   -- 관리자 메모
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_pet_foods_brand ON pet_foods (brand);
CREATE INDEX idx_pet_foods_target_animal ON pet_foods (target_animal);

-- RLS: 인증 사용자 읽기 허용, 쓰기는 admin API (service role)
ALTER TABLE pet_foods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pet_foods_select" ON pet_foods FOR SELECT TO authenticated USING (true);

-- updated_at 트리거
CREATE TRIGGER trigger_pet_foods_updated_at
  BEFORE UPDATE ON pet_foods FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
