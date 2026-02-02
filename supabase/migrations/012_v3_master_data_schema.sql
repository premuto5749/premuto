-- ============================================
-- Migration 012: v3 마스터 데이터 스키마
-- 검사항목_마스터_v3.md 기반 스키마 확장
-- ============================================

-- ============================================
-- 1. standard_items 테이블 확장
-- ============================================
-- exam_type: 검사유형 (Vital, CBC, Chemistry, Special, Blood Gas, Coagulation, 뇨검사, 안과검사, Echo)
-- organ_tags: 장기/시스템 태그 배열 (다중 태그 지원)

ALTER TABLE standard_items
ADD COLUMN IF NOT EXISTS exam_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS organ_tags JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN standard_items.exam_type IS '검사유형: Vital, CBC, Chemistry, Special, Blood Gas, Coagulation, 뇨검사, 안과검사, Echo';
COMMENT ON COLUMN standard_items.organ_tags IS '장기/시스템 태그 배열. 예: ["혈액", "면역"]';

-- exam_type 제약조건
ALTER TABLE standard_items
DROP CONSTRAINT IF EXISTS check_exam_type;

-- 기존 category를 exam_type으로 마이그레이션 (category가 있고 exam_type이 없는 경우)
-- 레거시 값을 새 값으로 변환
UPDATE standard_items
SET exam_type = CASE category
  WHEN 'Urinalysis' THEN '뇨검사'
  WHEN 'Ophthalmology' THEN '안과검사'
  WHEN 'Electrolyte' THEN 'Chemistry'
  WHEN 'BloodGas' THEN 'Blood Gas'
  WHEN 'Unmapped' THEN NULL
  ELSE category
END
WHERE exam_type IS NULL AND category IS NOT NULL;

-- 이제 제약 조건 적용 (레거시 값도 허용)
ALTER TABLE standard_items
ADD CONSTRAINT check_exam_type CHECK (
  exam_type IS NULL OR exam_type IN (
    'Vital', 'CBC', 'Chemistry', 'Special', 'Blood Gas',
    'Coagulation', '뇨검사', '안과검사', 'Echo',
    -- 레거시 값 (하위 호환성)
    'Urinalysis', 'Ophthalmology', 'Electrolyte', 'BloodGas', 'Unmapped', 'Other'
  )
);

-- ============================================
-- 2. item_aliases 테이블 생성
-- ============================================
-- 별칭 매핑 테이블 (source_hint 포함)
-- 기존 item_mappings 테이블과 병행 사용 (점진적 전환)

CREATE TABLE IF NOT EXISTS item_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alias VARCHAR(100) NOT NULL,
  canonical_name VARCHAR(100) NOT NULL,
  source_hint VARCHAR(100),
  standard_item_id UUID REFERENCES standard_items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_alias UNIQUE(alias)
);

COMMENT ON TABLE item_aliases IS 'v3 별칭 매핑 테이블 - source_hint 지원';
COMMENT ON COLUMN item_aliases.alias IS '별칭 (검사지에 표시되는 이름)';
COMMENT ON COLUMN item_aliases.canonical_name IS '정규 항목명 (standard_items.name)';
COMMENT ON COLUMN item_aliases.source_hint IS '장비/병원 힌트. 예: ABL80F, IDEXX, Blood Gas';
COMMENT ON COLUMN item_aliases.standard_item_id IS '정규 항목 ID 참조';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_aliases_alias_lower ON item_aliases(LOWER(alias));
CREATE INDEX IF NOT EXISTS idx_aliases_canonical ON item_aliases(canonical_name);
CREATE INDEX IF NOT EXISTS idx_aliases_standard_item ON item_aliases(standard_item_id);

-- RLS
ALTER TABLE item_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON item_aliases FOR ALL USING (true);

-- ============================================
-- 3. test_results 테이블 확장
-- ============================================
-- source_hint: 장비/병원 힌트 저장

ALTER TABLE test_results
ADD COLUMN IF NOT EXISTS source_hint VARCHAR(100);

COMMENT ON COLUMN test_results.source_hint IS '검사 장비/병원 힌트. 예: ABL80F, IDEXX';

-- ============================================
-- 4. sort_order_configs 테이블 생성 (정렬 체계 메타데이터)
-- ============================================

CREATE TABLE IF NOT EXISTS sort_order_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_type VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_sort_type UNIQUE(sort_type)
);

COMMENT ON TABLE sort_order_configs IS '정렬 체계 설정 테이블';
COMMENT ON COLUMN sort_order_configs.sort_type IS '정렬 유형: by_exam_type, by_organ, by_clinical_priority, by_panel';
COMMENT ON COLUMN sort_order_configs.config IS '정렬 순서 및 그룹 설정 JSON';

-- RLS
ALTER TABLE sort_order_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON sort_order_configs FOR ALL USING (true);

-- ============================================
-- 5. 기본 정렬 체계 데이터 삽입
-- ============================================

INSERT INTO sort_order_configs (sort_type, name, description, config) VALUES
(
  'by_exam_type',
  '검사유형별',
  '장비/검사 방법 기준 (검사 결과지 순서)',
  '{
    "order": ["Vital", "CBC", "Chemistry", "Special", "Blood Gas", "Coagulation", "뇨검사", "안과검사", "Echo"]
  }'::jsonb
),
(
  'by_organ',
  '장기/시스템별',
  '신체 부위 기준 (하나의 항목이 여러 장기에 태그 가능)',
  '{
    "order": ["기본신체", "혈액", "간", "신장", "췌장", "심장", "전해질", "산염기", "호흡", "지혈", "면역", "염증", "대사", "내분비", "근육", "뼈", "담도", "영양", "알레르기", "감염", "안과"]
  }'::jsonb
),
(
  'by_clinical_priority',
  '임상 우선순위별',
  '응급/중환자 상황에서 확인 순서',
  '{
    "order_groups": [
      {"label": "1. 활력징후", "items": ["BT", "Pulse", "Systolic BP", "BW"]},
      {"label": "2. 산소/환기", "items": ["pO2", "pO2(T)", "sO2", "pCO2", "pCO2(T)", "ctO2"]},
      {"label": "3. 산염기", "items": ["pH", "pH(T)", "cHCO3", "cHCO3(P,st)", "BE", "Lactate", "Anion Gap", "cBASE(B)", "cBASE(B,ox)", "cBASE(Ecf)", "cBASE(Ecf,ox)", "Anion", "ctCO2(B)", "ctCO2(P)"]},
      {"label": "4. 전해질", "items": ["Na", "K", "Cl", "Calcium", "Phosphorus", "NA/K"]},
      {"label": "5. 빈혈/적혈구", "items": ["HCT", "HGB", "RBC", "MCV", "MCH", "MCHC", "RDW", "RETIC", "%RETIC", "RETIC-HGB", "CH", "CHCM", "CHr", "HDW", "p50(act)"]},
      {"label": "6. 백혈구", "items": ["WBC", "NEU", "%NEU", "LYM", "%LYM", "MONO", "%MONO", "EOS", "%EOS", "BASO", "%BASO", "LUC(#)", "LUC(%)"]},
      {"label": "7. 지혈/응고", "items": ["PLT", "MPV", "PDW", "PCT", "PT", "APTT", "Fibrinogen", "D-dimer", "TEG_R", "TEG_K", "TEG_Angle", "TEG_MA"]},
      {"label": "8. 간/담도", "items": ["ALT", "AST", "ALKP", "GGT", "T.Bilirubin", "NH3", "GOT/GPT"]},
      {"label": "9. 신장", "items": ["BUN", "Creatinine", "BUN:Cr Ratio", "SDMA", "UPC", "PH(뇨)", "요비중", "mOsm"]},
      {"label": "10. 단백질", "items": ["Protein-Total", "Albumin", "Globulin", "A/G ratio"]},
      {"label": "11. 췌장/대사", "items": ["Glucose", "Lipase", "Amylase", "cPL", "Triglycerides", "T.Cholesterol"]},
      {"label": "12. 특수/심장", "items": ["CRP", "CK", "LDH", "proBNP", "심장사상충", "E", "LVIDd"]},
      {"label": "13. 안과", "items": ["눈물량(OD)", "눈물량(OS)", "안압(OD)", "안압(OS)"]}
    ]
  }'::jsonb
),
(
  'by_panel',
  '검사 패널별',
  '병원에서 한번에 돌리는 검사 세트 기준',
  '{
    "panels": [
      {"panel": "Basic", "label": "기본 혈액검사", "items": ["WBC", "RBC", "HGB", "HCT", "PLT", "ALT", "BUN", "Creatinine", "Glucose", "Protein-Total"]},
      {"panel": "Pre-anesthetic", "label": "마취 전 검사", "items": ["WBC", "RBC", "HGB", "HCT", "PLT", "ALT", "AST", "BUN", "Creatinine", "Glucose", "Protein-Total", "Albumin", "PT", "APTT"]},
      {"panel": "Senior", "label": "노령견 종합", "items": ["WBC", "RBC", "HGB", "HCT", "PLT", "ALT", "AST", "ALKP", "GGT", "BUN", "Creatinine", "SDMA", "Glucose", "Protein-Total", "Albumin", "T.Cholesterol", "Triglycerides", "T.Bilirubin", "Phosphorus", "Calcium", "Na", "K", "Cl", "CRP", "UPC", "요비중"]},
      {"panel": "Pancreatitis", "label": "췌장염 집중", "items": ["cPL", "Lipase", "Amylase", "Glucose", "Triglycerides", "Calcium", "CRP", "WBC"]},
      {"panel": "Coagulation", "label": "응고 검사", "items": ["PLT", "PT", "APTT", "Fibrinogen", "D-dimer", "TEG_R", "TEG_K", "TEG_Angle", "TEG_MA"]},
      {"panel": "Emergency", "label": "응급/중환자", "items": ["pH", "pCO2", "pO2", "cHCO3", "BE", "Lactate", "Na", "K", "Cl", "Calcium", "HCT", "HGB", "Glucose"]},
      {"panel": "Cardiac", "label": "심장 검사", "items": ["proBNP", "심장사상충", "E", "LVIDd", "Systolic BP", "CK"]},
      {"panel": "Kidney", "label": "신장 집중", "items": ["BUN", "Creatinine", "BUN:Cr Ratio", "SDMA", "Phosphorus", "Calcium", "UPC", "PH(뇨)", "요비중", "mOsm", "K", "Na", "Albumin"]}
    ]
  }'::jsonb
)
ON CONFLICT (sort_type) DO UPDATE SET
  config = EXCLUDED.config,
  updated_at = NOW();

-- ============================================
-- 6. updated_at 자동 업데이트 트리거
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_item_aliases_updated_at ON item_aliases;
CREATE TRIGGER update_item_aliases_updated_at
  BEFORE UPDATE ON item_aliases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sort_order_configs_updated_at ON sort_order_configs;
CREATE TRIGGER update_sort_order_configs_updated_at
  BEFORE UPDATE ON sort_order_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. View: 정렬 체계별 항목 조회
-- ============================================

CREATE OR REPLACE VIEW items_by_exam_type AS
SELECT
  si.*,
  COALESCE(si.exam_type, si.category) as effective_exam_type
FROM standard_items si
ORDER BY
  CASE COALESCE(si.exam_type, si.category)
    WHEN 'Vital' THEN 1
    WHEN 'CBC' THEN 2
    WHEN 'Chemistry' THEN 3
    WHEN 'Special' THEN 4
    WHEN 'Blood Gas' THEN 5
    WHEN 'Coagulation' THEN 6
    WHEN '뇨검사' THEN 7
    WHEN '안과검사' THEN 8
    WHEN 'Echo' THEN 9
    ELSE 10
  END,
  si.sort_order,
  si.name;

COMMENT ON VIEW items_by_exam_type IS '검사유형별 정렬된 항목 뷰';

-- ============================================
-- Migration Complete
-- ============================================
