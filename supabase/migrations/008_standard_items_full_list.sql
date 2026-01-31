-- ============================================
-- Migration 008: Standard Items Full List
-- 전체 표준 항목 목록 추가 (115개 항목)
-- ============================================

-- ============================================
-- 1. 기존 항목 카테고리 업데이트
-- ============================================

-- Lipase: Special -> Chemistry로 이동
UPDATE standard_items SET category = 'Chemistry' WHERE name = 'Lipase';

-- ============================================
-- 2. 새 표준 항목 추가 (중복 시 건너뜀)
-- ============================================

-- Vital (4개)
INSERT INTO standard_items (category, name, display_name_ko, default_unit, description) VALUES
  ('Vital', 'BT', '체온', '℃', '체온 측정'),
  ('Vital', 'BW', '체중', 'Kg', '체중 측정'),
  ('Vital', 'Pulse', '맥박', '/min', '분당 맥박수'),
  ('Vital', 'Systolic BP', '수축기혈압', 'mmHg', '수축기 혈압')
ON CONFLICT DO NOTHING;

-- CBC (35개) - HCT, PLT 제외한 33개 추가
INSERT INTO standard_items (category, name, display_name_ko, default_unit, description) VALUES
  ('CBC', '%BASO', '호염기구비율', '%', '호염기구 백분율'),
  ('CBC', '%EOS', '호산구비율', '%', '호산구 백분율'),
  ('CBC', '%LYM', '림프구비율', '%', '림프구 백분율'),
  ('CBC', '%MONO', '단핵구비율', '%', '단핵구 백분율'),
  ('CBC', '%NEU', '호중구비율', '%', '호중구 백분율'),
  ('CBC', '%RETIC', '망상적혈구비율', '%', '망상적혈구 백분율'),
  ('CBC', 'BASO', '호염기구', 'K/μL', '호염기구 절대수'),
  ('CBC', 'CH', 'CH', '-', '세포 헤모글로빈'),
  ('CBC', 'CHCM', 'CHCM', 'g/dL', '세포 헤모글로빈 농도 평균'),
  ('CBC', 'CHr', 'CHr', 'pg', '망상적혈구 헤모글로빈'),
  ('CBC', 'EOS', '호산구', 'K/μL', '호산구 절대수'),
  ('CBC', 'HDW', 'HDW', 'g/dL', '헤모글로빈 분포폭'),
  ('CBC', 'HGB', '헤모글로빈', 'g/dL', '혈색소'),
  ('CBC', 'LUC(#)', 'LUC수', 'K/uL', '대형 미분류 세포 수'),
  ('CBC', 'LUC(%)', 'LUC비율', '%', '대형 미분류 세포 비율'),
  ('CBC', 'LYM', '림프구', 'K/μL', '림프구 절대수'),
  ('CBC', 'MCH', 'MCH', 'pg', '평균 적혈구 헤모글로빈'),
  ('CBC', 'MCHC', 'MCHC', 'g/dL', '평균 적혈구 헤모글로빈 농도'),
  ('CBC', 'MCV', 'MCV', 'fL', '평균 적혈구 용적'),
  ('CBC', 'MONO', '단핵구', 'K/μL', '단핵구 절대수'),
  ('CBC', 'MPV', 'MPV', 'fL', '평균 혈소판 용적'),
  ('CBC', 'NEU', '호중구', 'K/μL', '호중구 절대수'),
  ('CBC', 'PCT', 'PCT', '%', '혈소판용적률'),
  ('CBC', 'PDW', 'PDW', 'fL', '혈소판 분포폭'),
  ('CBC', 'RBC', '적혈구', '10x12/L', '적혈구 수'),
  ('CBC', 'RDW', 'RDW', '%', '적혈구 분포폭'),
  ('CBC', 'RETIC', '망상적혈구', 'K/μL', '망상적혈구 절대수'),
  ('CBC', 'RETIC-HGB', 'RETIC-HGB', 'pg', '망상적혈구 헤모글로빈'),
  ('CBC', 'WBC', '백혈구', '10x9/L', '백혈구 수')
ON CONFLICT DO NOTHING;

-- Chemistry (35개) - 기존 7개 제외한 28개 추가
INSERT INTO standard_items (category, name, display_name_ko, default_unit, description) VALUES
  ('Chemistry', 'A/G ratio', 'A/G비', '-', '알부민/글로불린 비율'),
  ('Chemistry', 'ALP(ALKP)', 'ALP', 'U/L', '알칼리성 인산분해효소 (ALKP 별칭)'),
  ('Chemistry', 'AST', 'AST', 'U/L', '아스파르테이트 아미노전이효소'),
  ('Chemistry', 'Albumin', '알부민', 'g/dL', '혈청 알부민'),
  ('Chemistry', 'Amylase', '아밀라아제', 'U/L', '췌장/침샘 효소'),
  ('Chemistry', 'BUN:Cr Ratio', 'BUN/Cr비', '-', 'BUN 크레아티닌 비율'),
  ('Chemistry', 'CK', 'CK', 'U/L', '크레아틴 키나아제 (근육 효소)'),
  ('Chemistry', 'Calcium', '칼슘', 'mg/dL', '혈청 칼슘'),
  ('Chemistry', 'Cl-', '염소', 'mmol/L', '혈청 염소'),
  ('Chemistry', 'GOT/GPT', 'GOT/GPT비', '%', 'AST/ALT 비율'),
  ('Chemistry', 'Globulin', '글로불린', 'g/dL', '혈청 글로불린'),
  ('Chemistry', 'Glucose', '혈당', 'mg/dL', '혈당'),
  ('Chemistry', 'K+', '칼륨', 'mmol/L', '혈청 칼륨'),
  ('Chemistry', 'LDH', 'LDH', 'U/L', '젖산탈수소효소'),
  ('Chemistry', 'Lactate', '젖산', 'mmol/L', '혈중 젖산'),
  ('Chemistry', 'Lipase(vLIP)', 'vLIP', 'U/L', '특이 리파아제 (vLIP)'),
  ('Chemistry', 'NA/K', 'Na/K비', '-', '나트륨/칼륨 비율'),
  ('Chemistry', 'NH3(Ammonia)', '암모니아', 'ug/dL', '혈중 암모니아'),
  ('Chemistry', 'Na+', '나트륨', 'mmol/L', '혈청 나트륨'),
  ('Chemistry', 'Protein-Total', '총단백', 'g/dL', '총 단백질'),
  ('Chemistry', 'T.Bilirubin', '총빌리루빈', 'mg/dL', '총 빌리루빈'),
  ('Chemistry', 'T.Cholesterol', '총콜레스테롤', 'mg/dL', '총 콜레스테롤'),
  ('Chemistry', 'Triglycerides', '중성지방', 'mg/dL', '트리글리세라이드'),
  ('Chemistry', 'mOsm', '삼투압', 'mmol/kg', '혈장 삼투압'),
  ('Chemistry', 'tBil', 'tBil', '-', '총빌리루빈 (약어)')
ON CONFLICT DO NOTHING;

-- Special (5개) - 기존 2개(cPL, SDMA) 제외한 3개 추가
INSERT INTO standard_items (category, name, display_name_ko, default_unit, description) VALUES
  ('Special', 'CRP', 'CRP', 'mg/L', 'C반응성단백 (염증지표)'),
  ('Special', 'proBNP', 'proBNP', 'pmol/L', 'NT-proBNP (심장표지자)'),
  ('Special', '심장사상충', '심장사상충', '-', '심장사상충 검사')
ON CONFLICT DO NOTHING;

-- Blood Gas (34개) - 신규 카테고리
INSERT INTO standard_items (category, name, display_name_ko, default_unit, description) VALUES
  ('Blood Gas', 'Anion', '음이온', 'mmol', '음이온'),
  ('Blood Gas', 'Anion Gap', '음이온차', '-', '음이온 갭'),
  ('Blood Gas', 'BE', 'BE', 'mmol', '염기과잉'),
  ('Blood Gas', 'Ca++(ABL80F)', 'Ca++(가스)', 'mmol', '이온화칼슘 (혈액가스)'),
  ('Blood Gas', 'Cl(ABL80F)', 'Cl(가스)', 'mmol', '염소 (혈액가스)'),
  ('Blood Gas', 'HGB(Gas)', 'HGB(가스)', 'g/dL', '헤모글로빈 (혈액가스)'),
  ('Blood Gas', 'Hct(ABL80F)', 'Hct(가스)', '%', '헤마토크릿 (혈액가스)'),
  ('Blood Gas', 'K+(ABL80F)', 'K+(가스)', 'mmol', '칼륨 (혈액가스)'),
  ('Blood Gas', 'Na+(ABL80F)', 'Na+(가스)', 'mmol', '나트륨 (혈액가스)'),
  ('Blood Gas', 'cBASE(B)', 'cBASE(B)', 'mmol', '혈액 염기과잉'),
  ('Blood Gas', 'cBASE(B,ox)', 'cBASE(B,ox)', 'mmol', '혈액 염기과잉 (산소화)'),
  ('Blood Gas', 'cBASE(Ecf)', 'cBASE(Ecf)', 'mmol', '세포외액 염기과잉'),
  ('Blood Gas', 'cBASE(Ecf,ox)', 'cBASE(Ecf,ox)', 'mmol', '세포외액 염기과잉 (산소화)'),
  ('Blood Gas', 'cCa++(7.40)', 'cCa++(7.40)', 'mmol', 'pH 7.40 보정 이온화칼슘'),
  ('Blood Gas', 'cHCO3', 'cHCO3', 'mmol', '중탄산염'),
  ('Blood Gas', 'cHCO3(P,st)', 'cHCO3(P,st)', 'mmol', '표준 중탄산염'),
  ('Blood Gas', 'ctCO2(B)', 'ctCO2(B)', 'mmol', '혈액 총CO2'),
  ('Blood Gas', 'ctCO2(P)', 'ctCO2(P)', 'mmol', '혈장 총CO2'),
  ('Blood Gas', 'ctHb', 'ctHb', 'g/dL', '총 헤모글로빈'),
  ('Blood Gas', 'ctO2', 'ctO2', 'Vol%', '총 산소함량'),
  ('Blood Gas', 'p50(act)', 'p50(act)', '-', '산소해리곡선 P50'),
  ('Blood Gas', 'pCO2', 'pCO2', 'mmHg', '이산화탄소분압'),
  ('Blood Gas', 'pCO2(T)', 'pCO2(T)', 'mmHg', '이산화탄소분압 (체온보정)'),
  ('Blood Gas', 'pH', 'pH', '-', '산도'),
  ('Blood Gas', 'pH(T)', 'pH(T)', '-', '산도 (체온보정)'),
  ('Blood Gas', 'pO2', 'pO2', 'mmHg', '산소분압'),
  ('Blood Gas', 'pO2(T)', 'pO2(T)', 'mmHg', '산소분압 (체온보정)'),
  ('Blood Gas', 'sO2', 'sO2', '%', '산소포화도')
ON CONFLICT DO NOTHING;

-- Coagulation (8개) - 신규 카테고리
INSERT INTO standard_items (category, name, display_name_ko, default_unit, description) VALUES
  ('Coagulation', 'APTT', 'APTT', 'sec', '활성화부분트롬보플라스틴시간'),
  ('Coagulation', 'D-dimer', 'D-다이머', 'mg/L', 'D-이합체 (혈전표지자)'),
  ('Coagulation', 'Fibrinogen', '피브리노겐', 'mg/dL', '섬유소원'),
  ('Coagulation', 'PT', 'PT', 'sec', '프로트롬빈시간'),
  ('Coagulation', 'TEG_Angle', 'TEG Angle', 'deg', 'TEG 각도'),
  ('Coagulation', 'TEG_K', 'TEG K', 'min', 'TEG K시간'),
  ('Coagulation', 'TEG_MA', 'TEG MA', 'mm', 'TEG 최대진폭'),
  ('Coagulation', 'TEG_R', 'TEG R', 'min', 'TEG R시간')
ON CONFLICT DO NOTHING;

-- 뇨검사 (3개) - 신규 카테고리
INSERT INTO standard_items (category, name, display_name_ko, default_unit, description) VALUES
  ('Urinalysis', 'PH(뇨)', '요pH', '-', '소변 산도'),
  ('Urinalysis', 'UPC', 'UPC', '-', '요단백크레아티닌비'),
  ('Urinalysis', '요비중', '요비중', '-', '소변 비중')
ON CONFLICT DO NOTHING;

-- 안과검사 (4개) - 신규 카테고리
INSERT INTO standard_items (category, name, display_name_ko, default_unit, description) VALUES
  ('Ophthalmology', '눈물량(OD)', '눈물량(우)', 'mm', '우안 눈물량 (STT)'),
  ('Ophthalmology', '눈물량(OS)', '눈물량(좌)', 'mm', '좌안 눈물량 (STT)'),
  ('Ophthalmology', '안압(OD)', '안압(우)', 'mmHg', '우안 안압'),
  ('Ophthalmology', '안압(OS)', '안압(좌)', 'mmHg', '좌안 안압')
ON CONFLICT DO NOTHING;

-- Echo (2개) - 신규 카테고리
INSERT INTO standard_items (category, name, display_name_ko, default_unit, description) VALUES
  ('Echo', 'E', 'E파', 'm/s', '승모판 E파 속도'),
  ('Echo', 'LVIDd', 'LVIDd', 'cm', '좌심실 이완기 내경')
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. 추가 동의어 매핑
-- ============================================

-- WBC 동의어
INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'White Blood Cell', id FROM standard_items WHERE name = 'WBC'
ON CONFLICT (raw_name) DO NOTHING;

INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT '백혈구', id FROM standard_items WHERE name = 'WBC'
ON CONFLICT (raw_name) DO NOTHING;

-- RBC 동의어
INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'Red Blood Cell', id FROM standard_items WHERE name = 'RBC'
ON CONFLICT (raw_name) DO NOTHING;

INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT '적혈구', id FROM standard_items WHERE name = 'RBC'
ON CONFLICT (raw_name) DO NOTHING;

-- HGB 동의어
INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'Hemoglobin', id FROM standard_items WHERE name = 'HGB'
ON CONFLICT (raw_name) DO NOTHING;

INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT '헤모글로빈', id FROM standard_items WHERE name = 'HGB'
ON CONFLICT (raw_name) DO NOTHING;

-- Glucose 동의어
INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'GLU', id FROM standard_items WHERE name = 'Glucose'
ON CONFLICT (raw_name) DO NOTHING;

INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT '혈당', id FROM standard_items WHERE name = 'Glucose'
ON CONFLICT (raw_name) DO NOTHING;

-- ALP/ALKP 동의어 추가
INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'ALP(ALKP)', id FROM standard_items WHERE name = 'ALKP'
ON CONFLICT (raw_name) DO NOTHING;

INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'Alkaline Phosphatase', id FROM standard_items WHERE name = 'ALKP'
ON CONFLICT (raw_name) DO NOTHING;

-- ALT 동의어
INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'GPT', id FROM standard_items WHERE name = 'ALT'
ON CONFLICT (raw_name) DO NOTHING;

INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'ALT(GPT)', id FROM standard_items WHERE name = 'ALT'
ON CONFLICT (raw_name) DO NOTHING;

-- AST 동의어
INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'GOT', id FROM standard_items WHERE name = 'AST'
ON CONFLICT (raw_name) DO NOTHING;

INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'AST(GOT)', id FROM standard_items WHERE name = 'AST'
ON CONFLICT (raw_name) DO NOTHING;

-- Lipase 동의어 (vLIP 포함)
INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'vLIP', id FROM standard_items WHERE name = 'Lipase(vLIP)'
ON CONFLICT (raw_name) DO NOTHING;

-- Total Protein 동의어
INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'TP', id FROM standard_items WHERE name = 'Protein-Total'
ON CONFLICT (raw_name) DO NOTHING;

INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'Total Protein', id FROM standard_items WHERE name = 'Protein-Total'
ON CONFLICT (raw_name) DO NOTHING;

INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT '총단백', id FROM standard_items WHERE name = 'Protein-Total'
ON CONFLICT (raw_name) DO NOTHING;

-- Bilirubin 동의어
INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'TBIL', id FROM standard_items WHERE name = 'T.Bilirubin'
ON CONFLICT (raw_name) DO NOTHING;

INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'Total Bilirubin', id FROM standard_items WHERE name = 'T.Bilirubin'
ON CONFLICT (raw_name) DO NOTHING;

-- Cholesterol 동의어
INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'CHOL', id FROM standard_items WHERE name = 'T.Cholesterol'
ON CONFLICT (raw_name) DO NOTHING;

INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'Total Cholesterol', id FROM standard_items WHERE name = 'T.Cholesterol'
ON CONFLICT (raw_name) DO NOTHING;

-- Triglycerides 동의어
INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'TG', id FROM standard_items WHERE name = 'Triglycerides'
ON CONFLICT (raw_name) DO NOTHING;

INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'TRIG', id FROM standard_items WHERE name = 'Triglycerides'
ON CONFLICT (raw_name) DO NOTHING;

-- Calcium 동의어
INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'Ca', id FROM standard_items WHERE name = 'Calcium'
ON CONFLICT (raw_name) DO NOTHING;

INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'CA', id FROM standard_items WHERE name = 'Calcium'
ON CONFLICT (raw_name) DO NOTHING;

-- Ammonia 동의어
INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'NH3', id FROM standard_items WHERE name = 'NH3(Ammonia)'
ON CONFLICT (raw_name) DO NOTHING;

INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'Ammonia', id FROM standard_items WHERE name = 'NH3(Ammonia)'
ON CONFLICT (raw_name) DO NOTHING;

-- cPL 동의어
INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'Spec cPL', id FROM standard_items WHERE name = 'cPL'
ON CONFLICT (raw_name) DO NOTHING;

INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'SPEC CPL', id FROM standard_items WHERE name = 'cPL'
ON CONFLICT (raw_name) DO NOTHING;

INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'cPL_V100', id FROM standard_items WHERE name = 'cPL'
ON CONFLICT (raw_name) DO NOTHING;

-- proBNP 동의어
INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'NT-proBNP', id FROM standard_items WHERE name = 'proBNP'
ON CONFLICT (raw_name) DO NOTHING;

INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'NTproBNP', id FROM standard_items WHERE name = 'proBNP'
ON CONFLICT (raw_name) DO NOTHING;

-- ============================================
-- 4. sort_order 업데이트 (UI 표시 순서)
-- ============================================

-- Vital
UPDATE standard_items SET sort_order = 1 WHERE name = 'BT' AND category = 'Vital';
UPDATE standard_items SET sort_order = 2 WHERE name = 'BW' AND category = 'Vital';
UPDATE standard_items SET sort_order = 3 WHERE name = 'Pulse' AND category = 'Vital';
UPDATE standard_items SET sort_order = 4 WHERE name = 'Systolic BP' AND category = 'Vital';

-- CBC - WBC first, then RBC related, then PLT related
UPDATE standard_items SET sort_order = 10 WHERE name = 'WBC' AND category = 'CBC';
UPDATE standard_items SET sort_order = 11 WHERE name = 'NEU' AND category = 'CBC';
UPDATE standard_items SET sort_order = 12 WHERE name = '%NEU' AND category = 'CBC';
UPDATE standard_items SET sort_order = 13 WHERE name = 'LYM' AND category = 'CBC';
UPDATE standard_items SET sort_order = 14 WHERE name = '%LYM' AND category = 'CBC';
UPDATE standard_items SET sort_order = 15 WHERE name = 'MONO' AND category = 'CBC';
UPDATE standard_items SET sort_order = 16 WHERE name = '%MONO' AND category = 'CBC';
UPDATE standard_items SET sort_order = 17 WHERE name = 'EOS' AND category = 'CBC';
UPDATE standard_items SET sort_order = 18 WHERE name = '%EOS' AND category = 'CBC';
UPDATE standard_items SET sort_order = 19 WHERE name = 'BASO' AND category = 'CBC';
UPDATE standard_items SET sort_order = 20 WHERE name = '%BASO' AND category = 'CBC';

UPDATE standard_items SET sort_order = 30 WHERE name = 'RBC' AND category = 'CBC';
UPDATE standard_items SET sort_order = 31 WHERE name = 'HGB' AND category = 'CBC';
UPDATE standard_items SET sort_order = 32 WHERE name = 'HCT' AND category = 'CBC';
UPDATE standard_items SET sort_order = 33 WHERE name = 'MCV' AND category = 'CBC';
UPDATE standard_items SET sort_order = 34 WHERE name = 'MCH' AND category = 'CBC';
UPDATE standard_items SET sort_order = 35 WHERE name = 'MCHC' AND category = 'CBC';
UPDATE standard_items SET sort_order = 36 WHERE name = 'RDW' AND category = 'CBC';
UPDATE standard_items SET sort_order = 37 WHERE name = 'RETIC' AND category = 'CBC';
UPDATE standard_items SET sort_order = 38 WHERE name = '%RETIC' AND category = 'CBC';
UPDATE standard_items SET sort_order = 39 WHERE name = 'RETIC-HGB' AND category = 'CBC';

UPDATE standard_items SET sort_order = 50 WHERE name = 'PLT' AND category = 'CBC';
UPDATE standard_items SET sort_order = 51 WHERE name = 'MPV' AND category = 'CBC';
UPDATE standard_items SET sort_order = 52 WHERE name = 'PCT' AND category = 'CBC';
UPDATE standard_items SET sort_order = 53 WHERE name = 'PDW' AND category = 'CBC';

-- Chemistry - Kidney first
UPDATE standard_items SET sort_order = 100 WHERE name = 'BUN' AND category = 'Chemistry';
UPDATE standard_items SET sort_order = 101 WHERE name = 'Creatinine' AND category = 'Chemistry';
UPDATE standard_items SET sort_order = 102 WHERE name = 'BUN:Cr Ratio' AND category = 'Chemistry';
UPDATE standard_items SET sort_order = 103 WHERE name = 'Phosphorus' AND category = 'Chemistry';

-- Chemistry - Liver
UPDATE standard_items SET sort_order = 110 WHERE name = 'ALT' AND category = 'Chemistry';
UPDATE standard_items SET sort_order = 111 WHERE name = 'AST' AND category = 'Chemistry';
UPDATE standard_items SET sort_order = 112 WHERE name = 'ALKP' AND category = 'Chemistry';
UPDATE standard_items SET sort_order = 113 WHERE name = 'ALP(ALKP)' AND category = 'Chemistry';
UPDATE standard_items SET sort_order = 114 WHERE name = 'GGT' AND category = 'Chemistry';
UPDATE standard_items SET sort_order = 115 WHERE name = 'GOT/GPT' AND category = 'Chemistry';
UPDATE standard_items SET sort_order = 116 WHERE name = 'T.Bilirubin' AND category = 'Chemistry';
UPDATE standard_items SET sort_order = 117 WHERE name = 'tBil' AND category = 'Chemistry';
UPDATE standard_items SET sort_order = 118 WHERE name = 'NH3(Ammonia)' AND category = 'Chemistry';

-- Chemistry - Protein
UPDATE standard_items SET sort_order = 130 WHERE name = 'Protein-Total' AND category = 'Chemistry';
UPDATE standard_items SET sort_order = 131 WHERE name = 'Albumin' AND category = 'Chemistry';
UPDATE standard_items SET sort_order = 132 WHERE name = 'Globulin' AND category = 'Chemistry';
UPDATE standard_items SET sort_order = 133 WHERE name = 'A/G ratio' AND category = 'Chemistry';

-- Chemistry - Electrolytes
UPDATE standard_items SET sort_order = 140 WHERE name = 'Na+' AND category = 'Chemistry';
UPDATE standard_items SET sort_order = 141 WHERE name = 'K+' AND category = 'Chemistry';
UPDATE standard_items SET sort_order = 142 WHERE name = 'Cl-' AND category = 'Chemistry';
UPDATE standard_items SET sort_order = 143 WHERE name = 'NA/K' AND category = 'Chemistry';
UPDATE standard_items SET sort_order = 144 WHERE name = 'Calcium' AND category = 'Chemistry';

-- Chemistry - Glucose & Lipids
UPDATE standard_items SET sort_order = 150 WHERE name = 'Glucose' AND category = 'Chemistry';
UPDATE standard_items SET sort_order = 151 WHERE name = 'T.Cholesterol' AND category = 'Chemistry';
UPDATE standard_items SET sort_order = 152 WHERE name = 'Triglycerides' AND category = 'Chemistry';

-- Chemistry - Enzymes & Others
UPDATE standard_items SET sort_order = 160 WHERE name = 'Lipase' AND category = 'Chemistry';
UPDATE standard_items SET sort_order = 161 WHERE name = 'Lipase(vLIP)' AND category = 'Chemistry';
UPDATE standard_items SET sort_order = 162 WHERE name = 'Amylase' AND category = 'Chemistry';
UPDATE standard_items SET sort_order = 163 WHERE name = 'CK' AND category = 'Chemistry';
UPDATE standard_items SET sort_order = 164 WHERE name = 'LDH' AND category = 'Chemistry';
UPDATE standard_items SET sort_order = 165 WHERE name = 'Lactate' AND category = 'Chemistry';
UPDATE standard_items SET sort_order = 166 WHERE name = 'mOsm' AND category = 'Chemistry';

-- Special
UPDATE standard_items SET sort_order = 200 WHERE name = 'cPL' AND category = 'Special';
UPDATE standard_items SET sort_order = 201 WHERE name = 'SDMA' AND category = 'Special';
UPDATE standard_items SET sort_order = 202 WHERE name = 'CRP' AND category = 'Special';
UPDATE standard_items SET sort_order = 203 WHERE name = 'proBNP' AND category = 'Special';
UPDATE standard_items SET sort_order = 204 WHERE name = '심장사상충' AND category = 'Special';

-- Blood Gas
UPDATE standard_items SET sort_order = 300 WHERE name = 'pH' AND category = 'Blood Gas';
UPDATE standard_items SET sort_order = 301 WHERE name = 'pCO2' AND category = 'Blood Gas';
UPDATE standard_items SET sort_order = 302 WHERE name = 'pO2' AND category = 'Blood Gas';
UPDATE standard_items SET sort_order = 303 WHERE name = 'cHCO3' AND category = 'Blood Gas';
UPDATE standard_items SET sort_order = 304 WHERE name = 'BE' AND category = 'Blood Gas';
UPDATE standard_items SET sort_order = 305 WHERE name = 'sO2' AND category = 'Blood Gas';

-- Coagulation
UPDATE standard_items SET sort_order = 400 WHERE name = 'PT' AND category = 'Coagulation';
UPDATE standard_items SET sort_order = 401 WHERE name = 'APTT' AND category = 'Coagulation';
UPDATE standard_items SET sort_order = 402 WHERE name = 'Fibrinogen' AND category = 'Coagulation';
UPDATE standard_items SET sort_order = 403 WHERE name = 'D-dimer' AND category = 'Coagulation';

-- Urinalysis
UPDATE standard_items SET sort_order = 500 WHERE name = '요비중' AND category = 'Urinalysis';
UPDATE standard_items SET sort_order = 501 WHERE name = 'PH(뇨)' AND category = 'Urinalysis';
UPDATE standard_items SET sort_order = 502 WHERE name = 'UPC' AND category = 'Urinalysis';

-- Ophthalmology
UPDATE standard_items SET sort_order = 600 WHERE category = 'Ophthalmology';

-- Echo
UPDATE standard_items SET sort_order = 700 WHERE category = 'Echo';

-- ============================================
-- Migration Complete
-- ============================================
