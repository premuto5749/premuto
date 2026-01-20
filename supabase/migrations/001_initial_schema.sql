-- Mimo Health Log 초기 스키마
-- SCHEMA.md 기반 4개 핵심 테이블 생성

-- ============================================
-- 1. 표준 항목 마스터 (Standard Items)
-- ============================================
CREATE TABLE standard_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50),
  name VARCHAR(100) NOT NULL,
  display_name_ko VARCHAR(100),
  default_unit VARCHAR(20),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. 항목 매핑 사전 (Item Synonyms)
-- ============================================
CREATE TABLE item_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_name VARCHAR(100) NOT NULL,
  standard_item_id UUID REFERENCES standard_items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(raw_name)
);

-- ============================================
-- 3. 검사 기록 헤더 (Test Records)
-- ============================================
CREATE TABLE test_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_date DATE NOT NULL,
  hospital_name VARCHAR(100),
  machine_type VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. 검사 상세 결과 (Test Results) - 핵심 테이블
-- ============================================
CREATE TABLE test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID REFERENCES test_records(id) ON DELETE CASCADE,
  standard_item_id UUID REFERENCES standard_items(id),
  value NUMERIC NOT NULL,
  
  -- 참고치 스냅샷 (Dynamic Reference Range)
  ref_min NUMERIC,
  ref_max NUMERIC,
  ref_text VARCHAR(50),
  
  status VARCHAR(20) CHECK (status IN ('Low', 'Normal', 'High', 'Unknown')),
  unit VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 인덱스 생성 (성능 최적화)
-- ============================================
CREATE INDEX idx_test_results_record ON test_results(record_id);
CREATE INDEX idx_test_results_item ON test_results(standard_item_id);
CREATE INDEX idx_test_records_date ON test_records(test_date DESC);
CREATE INDEX idx_item_mappings_raw ON item_mappings(raw_name);

-- ============================================
-- RLS (Row Level Security) 활성화
-- ============================================
ALTER TABLE standard_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;

-- 기본 정책: 모든 사용자 읽기/쓰기 허용 (향후 인증 추가 시 수정)
CREATE POLICY "Allow all access" ON standard_items FOR ALL USING (true);
CREATE POLICY "Allow all access" ON item_mappings FOR ALL USING (true);
CREATE POLICY "Allow all access" ON test_records FOR ALL USING (true);
CREATE POLICY "Allow all access" ON test_results FOR ALL USING (true);

-- ============================================
-- 초기 데이터: 미모 주요 관리 항목 (CLAUDE.md 기반)
-- ============================================

-- Pancreas (췌장)
INSERT INTO standard_items (category, name, display_name_ko, default_unit, description) VALUES
  ('Special', 'Lipase', '리파아제', 'U/L', '췌장 효소 - 췌장염 진단'),
  ('Special', 'cPL', '췌장특이효소', 'μg/L', '개 췌장 특이 리파아제 - 췌장염 조기 진단');

-- Kidney (신장)
INSERT INTO standard_items (category, name, display_name_ko, default_unit, description) VALUES
  ('Chemistry', 'BUN', '혈중요소질소', 'mg/dL', '신장 기능 지표'),
  ('Chemistry', 'Creatinine', '크레아티닌', 'mg/dL', '신장 기능 - GFR 반영'),
  ('Chemistry', 'SDMA', 'SDMA', 'μg/dL', '신장 기능 조기 지표'),
  ('Chemistry', 'Phosphorus', '인', 'mg/dL', '신장/골대사 지표');

-- Liver (간)
INSERT INTO standard_items (category, name, display_name_ko, default_unit, description) VALUES
  ('Chemistry', 'ALT', 'ALT', 'U/L', '간세포 손상 지표'),
  ('Chemistry', 'ALKP', 'ALP', 'U/L', '담도/간 효소'),
  ('Chemistry', 'GGT', 'GGT', 'U/L', '담도계 효소');

-- CBC
INSERT INTO standard_items (category, name, display_name_ko, default_unit, description) VALUES
  ('CBC', 'HCT', '적혈구용적률', '%', '빈혈/탈수 지표'),
  ('CBC', 'PLT', '혈소판', 'K/μL', '지혈 기능');

-- ============================================
-- 동의어 매핑 초기 데이터
-- ============================================

-- Creatinine 동의어
INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'CREA', id FROM standard_items WHERE name = 'Creatinine'
UNION ALL
SELECT 'Cre', id FROM standard_items WHERE name = 'Creatinine'
UNION ALL
SELECT 'CREATININE', id FROM standard_items WHERE name = 'Creatinine';

-- ALKP 동의어
INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'ALP', id FROM standard_items WHERE name = 'ALKP'
UNION ALL
SELECT 'Alk Phos', id FROM standard_items WHERE name = 'ALKP'
UNION ALL
SELECT 'ALK', id FROM standard_items WHERE name = 'ALKP';

-- BUN 동의어
INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'Blood Urea Nitrogen', id FROM standard_items WHERE name = 'BUN';

-- Lipase 동의어
INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'LIP', id FROM standard_items WHERE name = 'Lipase'
UNION ALL
SELECT 'LIPASE', id FROM standard_items WHERE name = 'Lipase';

-- HCT 동의어
INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'Hematocrit', id FROM standard_items WHERE name = 'HCT'
UNION ALL
SELECT 'PCV', id FROM standard_items WHERE name = 'HCT';

-- PLT 동의어
INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'Platelet', id FROM standard_items WHERE name = 'PLT'
UNION ALL
SELECT 'PLATELET', id FROM standard_items WHERE name = 'PLT';
