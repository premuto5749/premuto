-- ============================================
-- Migration 004: Enhanced Items & Validation
-- 항목 확장 및 검증 관련 스키마 업데이트
-- ============================================

-- ============================================
-- 1. standard_items 테이블 확장
-- ============================================
-- 생물학적 범위, 별칭, 패턴 매칭 지원

ALTER TABLE standard_items
ADD COLUMN IF NOT EXISTS biological_min NUMERIC,
ADD COLUMN IF NOT EXISTS biological_max NUMERIC,
ADD COLUMN IF NOT EXISTS critical_low NUMERIC,
ADD COLUMN IF NOT EXISTS critical_high NUMERIC,
ADD COLUMN IF NOT EXISTS aliases JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS patterns JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS default_ref_min NUMERIC,
ADD COLUMN IF NOT EXISTS default_ref_max NUMERIC,
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

COMMENT ON COLUMN standard_items.biological_min IS '생물학적 최소값 (이 이하는 불가능)';
COMMENT ON COLUMN standard_items.biological_max IS '생물학적 최대값 (이 이상은 불가능)';
COMMENT ON COLUMN standard_items.critical_low IS '위험 저값 (생명 위험)';
COMMENT ON COLUMN standard_items.critical_high IS '위험 고값 (생명 위험)';
COMMENT ON COLUMN standard_items.aliases IS '항목명 별칭 배열. 예: ["CREA", "Cr", "Creat"]';
COMMENT ON COLUMN standard_items.patterns IS '정규식 패턴 배열. 예: ["^creat", "cr$"]';
COMMENT ON COLUMN standard_items.default_ref_min IS '기본 참조 최소값 (장비별 다를 수 있음)';
COMMENT ON COLUMN standard_items.default_ref_max IS '기본 참조 최대값 (장비별 다를 수 있음)';
COMMENT ON COLUMN standard_items.sort_order IS 'UI 표시 순서';

-- ============================================
-- 2. test_results 테이블 확장
-- ============================================
-- 값 타입 확장 (특수값 지원), 검증 결과 저장

ALTER TABLE test_results
ADD COLUMN IF NOT EXISTS raw_value VARCHAR(50),
ADD COLUMN IF NOT EXISTS is_special_value BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS special_value_type VARCHAR(20),
ADD COLUMN IF NOT EXISTS validation_warnings JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS normalized_unit VARCHAR(20),
ADD COLUMN IF NOT EXISTS original_unit VARCHAR(20),
ADD COLUMN IF NOT EXISTS is_abnormal BOOLEAN,
ADD COLUMN IF NOT EXISTS abnormal_direction VARCHAR(10);

COMMENT ON COLUMN test_results.raw_value IS 'OCR에서 추출한 원본 값 (특수문자 포함). 예: "<500", "*14"';
COMMENT ON COLUMN test_results.is_special_value IS '특수값 여부 (<, >, * 등 포함)';
COMMENT ON COLUMN test_results.special_value_type IS '특수값 타입: less_than, greater_than, flagged, range';
COMMENT ON COLUMN test_results.validation_warnings IS '검증 경고 배열. 예: [{"type": "out_of_range", "message": "..."}]';
COMMENT ON COLUMN test_results.normalized_unit IS '표준화된 단위';
COMMENT ON COLUMN test_results.original_unit IS 'OCR에서 추출한 원본 단위';
COMMENT ON COLUMN test_results.is_abnormal IS '검사지에서 이상치로 표시되었는지';
COMMENT ON COLUMN test_results.abnormal_direction IS 'high 또는 low';

-- special_value_type 제약조건
ALTER TABLE test_results
ADD CONSTRAINT check_special_value_type
CHECK (special_value_type IS NULL OR special_value_type IN ('less_than', 'greater_than', 'flagged', 'range', 'qualitative'));

-- abnormal_direction 제약조건
ALTER TABLE test_results
ADD CONSTRAINT check_abnormal_direction
CHECK (abnormal_direction IS NULL OR abnormal_direction IN ('high', 'low'));

-- ============================================
-- 3. unit_conversions 테이블 생성
-- ============================================
-- 단위 변환 규칙 DB 저장 (config/unit_mappings.json 백업)

CREATE TABLE IF NOT EXISTS unit_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name VARCHAR(50) NOT NULL,
  from_unit VARCHAR(20) NOT NULL,
  to_unit VARCHAR(20) NOT NULL,
  multiplier NUMERIC NOT NULL,
  formula TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(item_name, from_unit, to_unit)
);

COMMENT ON TABLE unit_conversions IS '단위 변환 규칙 테이블';
COMMENT ON COLUMN unit_conversions.item_name IS '항목명 (대문자)';
COMMENT ON COLUMN unit_conversions.from_unit IS '원본 단위';
COMMENT ON COLUMN unit_conversions.to_unit IS '목표 단위 (표준)';
COMMENT ON COLUMN unit_conversions.multiplier IS '변환 계수 (원본 × multiplier = 목표)';
COMMENT ON COLUMN unit_conversions.formula IS '변환 공식 설명';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_unit_conversions_item ON unit_conversions(item_name);

-- RLS
ALTER TABLE unit_conversions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON unit_conversions FOR ALL USING (true);

-- ============================================
-- 4. validation_logs 테이블 생성 (선택적)
-- ============================================
-- 검증 결과 기록 (디버깅 및 개선용)

CREATE TABLE IF NOT EXISTS validation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_result_id UUID REFERENCES test_results(id) ON DELETE CASCADE,
  validation_type VARCHAR(50) NOT NULL,
  is_valid BOOLEAN NOT NULL,
  warnings JSONB DEFAULT '[]'::jsonb,
  errors JSONB DEFAULT '[]'::jsonb,
  suggestions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE validation_logs IS '검증 로그 테이블';
COMMENT ON COLUMN validation_logs.validation_type IS '검증 유형: biological_range, ocr_error, cross_validation';
COMMENT ON COLUMN validation_logs.is_valid IS '검증 통과 여부';
COMMENT ON COLUMN validation_logs.warnings IS '경고 배열';
COMMENT ON COLUMN validation_logs.errors IS '오류 배열';
COMMENT ON COLUMN validation_logs.suggestions IS '제안 배열';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_validation_logs_result ON validation_logs(test_result_id);
CREATE INDEX IF NOT EXISTS idx_validation_logs_type ON validation_logs(validation_type);

-- RLS
ALTER TABLE validation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON validation_logs FOR ALL USING (true);

-- ============================================
-- 5. standard_items 초기 데이터 업데이트
-- ============================================
-- 생물학적 범위 데이터 추가

-- CBC 항목
UPDATE standard_items SET
  biological_min = 0.1, biological_max = 200,
  critical_low = 1, critical_high = 50,
  aliases = '["WBC", "White Blood Cell", "백혈구"]'::jsonb,
  sort_order = 1
WHERE name = 'WBC' OR name ILIKE '%white%blood%';

UPDATE standard_items SET
  biological_min = 1, biological_max = 15,
  critical_low = 3, critical_high = 10,
  aliases = '["RBC", "Red Blood Cell", "적혈구"]'::jsonb,
  sort_order = 2
WHERE name = 'RBC' OR name ILIKE '%red%blood%';

UPDATE standard_items SET
  biological_min = 5, biological_max = 80,
  critical_low = 15, critical_high = 65,
  aliases = '["HCT", "Hematocrit", "PCV", "적혈구용적률"]'::jsonb,
  sort_order = 3
WHERE name = 'HCT';

UPDATE standard_items SET
  biological_min = 5, biological_max = 2000,
  critical_low = 20, critical_high = 1000,
  aliases = '["PLT", "Platelet", "혈소판"]'::jsonb,
  sort_order = 4
WHERE name = 'PLT';

-- Kidney 항목
UPDATE standard_items SET
  biological_min = 0, biological_max = 300,
  critical_high = 150,
  aliases = '["BUN", "Blood Urea Nitrogen", "혈중요소질소"]'::jsonb,
  default_ref_min = 7, default_ref_max = 27,
  sort_order = 10
WHERE name = 'BUN';

UPDATE standard_items SET
  biological_min = 0, biological_max = 30,
  critical_high = 15,
  aliases = '["CREA", "Creatinine", "Cr", "크레아티닌"]'::jsonb,
  patterns = '["^crea", "cr$"]'::jsonb,
  default_ref_min = 0.5, default_ref_max = 1.8,
  sort_order = 11
WHERE name = 'Creatinine';

UPDATE standard_items SET
  biological_min = 0, biological_max = 100,
  aliases = '["SDMA", "Symmetric Dimethylarginine"]'::jsonb,
  default_ref_min = 0, default_ref_max = 14,
  sort_order = 12
WHERE name = 'SDMA';

UPDATE standard_items SET
  biological_min = 1, biological_max = 20,
  aliases = '["P", "Phosphorus", "PHOS", "인"]'::jsonb,
  default_ref_min = 2.5, default_ref_max = 6.8,
  sort_order = 13
WHERE name = 'Phosphorus';

-- Liver 항목
UPDATE standard_items SET
  biological_min = 0, biological_max = 5000,
  critical_high = 2000,
  aliases = '["ALT", "Alanine Aminotransferase", "GPT"]'::jsonb,
  default_ref_min = 10, default_ref_max = 125,
  sort_order = 20
WHERE name = 'ALT';

UPDATE standard_items SET
  biological_min = 0, biological_max = 5000,
  aliases = '["ALKP", "ALP", "Alkaline Phosphatase", "Alk Phos"]'::jsonb,
  default_ref_min = 23, default_ref_max = 212,
  sort_order = 21
WHERE name = 'ALKP';

UPDATE standard_items SET
  biological_min = 0, biological_max = 500,
  aliases = '["GGT", "Gamma-Glutamyl Transferase"]'::jsonb,
  default_ref_min = 0, default_ref_max = 11,
  sort_order = 22
WHERE name = 'GGT';

-- Pancreas 항목
UPDATE standard_items SET
  biological_min = 0, biological_max = 5000,
  aliases = '["Lipase", "LIP", "리파아제"]'::jsonb,
  sort_order = 30
WHERE name = 'Lipase';

UPDATE standard_items SET
  biological_min = 0, biological_max = 2000,
  aliases = '["cPL", "Spec cPL", "SPEC CPL", "췌장특이효소"]'::jsonb,
  sort_order = 31
WHERE name = 'cPL';

-- ============================================
-- 6. unit_conversions 초기 데이터
-- ============================================

-- Calcium
INSERT INTO unit_conversions (item_name, from_unit, to_unit, multiplier, formula) VALUES
('CA', 'mmol/L', 'mg/dL', 4.008, 'mmol/L × 4.008 = mg/dL'),
('CA', 'mEq/L', 'mg/dL', 2.004, 'mEq/L × 2.004 = mg/dL')
ON CONFLICT (item_name, from_unit, to_unit) DO NOTHING;

-- Creatinine
INSERT INTO unit_conversions (item_name, from_unit, to_unit, multiplier, formula) VALUES
('CREA', 'μmol/L', 'mg/dL', 0.0113, 'μmol/L × 0.0113 = mg/dL')
ON CONFLICT (item_name, from_unit, to_unit) DO NOTHING;

-- Glucose
INSERT INTO unit_conversions (item_name, from_unit, to_unit, multiplier, formula) VALUES
('GLU', 'mmol/L', 'mg/dL', 18.02, 'mmol/L × 18.02 = mg/dL')
ON CONFLICT (item_name, from_unit, to_unit) DO NOTHING;

-- BUN
INSERT INTO unit_conversions (item_name, from_unit, to_unit, multiplier, formula) VALUES
('BUN', 'mmol/L', 'mg/dL', 2.801, 'mmol/L × 2.801 = mg/dL')
ON CONFLICT (item_name, from_unit, to_unit) DO NOTHING;

-- Bilirubin
INSERT INTO unit_conversions (item_name, from_unit, to_unit, multiplier, formula) VALUES
('TBIL', 'μmol/L', 'mg/dL', 0.0585, 'μmol/L × 0.0585 = mg/dL')
ON CONFLICT (item_name, from_unit, to_unit) DO NOTHING;

-- Protein (g/L to g/dL)
INSERT INTO unit_conversions (item_name, from_unit, to_unit, multiplier, formula) VALUES
('TP', 'g/L', 'g/dL', 0.1, 'g/L × 0.1 = g/dL'),
('ALB', 'g/L', 'g/dL', 0.1, 'g/L × 0.1 = g/dL'),
('HGB', 'g/L', 'g/dL', 0.1, 'g/L × 0.1 = g/dL')
ON CONFLICT (item_name, from_unit, to_unit) DO NOTHING;

-- ============================================
-- 7. View: 항목별 통계 (트렌드 분석용)
-- ============================================

CREATE OR REPLACE VIEW item_statistics AS
SELECT
  si.id as standard_item_id,
  si.name as item_name,
  si.display_name_ko,
  si.category,
  COUNT(tr.id) as total_results,
  AVG(tr.value) as avg_value,
  MIN(tr.value) as min_value,
  MAX(tr.value) as max_value,
  STDDEV(tr.value) as stddev_value,
  COUNT(CASE WHEN tr.status = 'High' THEN 1 END) as high_count,
  COUNT(CASE WHEN tr.status = 'Low' THEN 1 END) as low_count,
  COUNT(CASE WHEN tr.status = 'Normal' THEN 1 END) as normal_count,
  MIN(rec.test_date) as first_test_date,
  MAX(rec.test_date) as last_test_date
FROM standard_items si
LEFT JOIN test_results tr ON tr.standard_item_id = si.id
LEFT JOIN test_records rec ON rec.id = tr.record_id
GROUP BY si.id, si.name, si.display_name_ko, si.category;

COMMENT ON VIEW item_statistics IS '항목별 통계 뷰 - 트렌드 분석 및 대시보드용';

-- ============================================
-- 8. Function: 항목별 트렌드 데이터 조회
-- ============================================

CREATE OR REPLACE FUNCTION get_item_trend(
  p_item_name VARCHAR,
  p_limit INTEGER DEFAULT 20
) RETURNS TABLE (
  test_date DATE,
  value NUMERIC,
  ref_min NUMERIC,
  ref_max NUMERIC,
  status VARCHAR,
  hospital_name VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rec.test_date,
    tr.value,
    tr.ref_min,
    tr.ref_max,
    tr.status,
    rec.hospital_name
  FROM test_results tr
  JOIN test_records rec ON rec.id = tr.record_id
  JOIN standard_items si ON si.id = tr.standard_item_id
  WHERE si.name ILIKE p_item_name
     OR si.display_name_ko ILIKE p_item_name
     OR si.aliases::text ILIKE '%' || p_item_name || '%'
  ORDER BY rec.test_date DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_item_trend IS '특정 항목의 시계열 트렌드 데이터 조회';

-- ============================================
-- Migration Complete
-- ============================================
