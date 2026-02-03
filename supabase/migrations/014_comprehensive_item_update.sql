-- ============================================
-- Migration 014: 종합 항목 업데이트
-- 1. 누락된 Blood Gas 항목 추가
-- 2. ABL80F 장비 별칭 추가
-- 3. % 항목 별칭 추가
-- 4. 모든 항목 설명 (description_common/high/low) 추가
-- ============================================

-- ============================================
-- PART 1: 누락된 Blood Gas 항목 추가
-- ============================================

INSERT INTO standard_items (category, name, display_name_ko, default_unit, description) VALUES
  -- 폐포 관련 산소 지표
  ('Blood Gas', 'pO2(A)', 'pO2(A)', 'mmHg', '폐포 산소분압'),
  ('Blood Gas', 'pO2(A-a)', 'pO2(A-a)', 'mmHg', '폐포-동맥 산소분압차'),
  ('Blood Gas', 'pO2(a/A)', 'pO2(a/A)', '%', '동맥/폐포 산소분압비'),
  ('Blood Gas', 'pO2(A,T)', 'pO2(A,T)', 'mmHg', '폐포 산소분압 (체온보정)'),
  ('Blood Gas', 'pO2(A-a,T)', 'pO2(A-a,T)', 'mmHg', '폐포-동맥 산소분압차 (체온보정)'),
  ('Blood Gas', 'pO2(a/A,T)', 'pO2(a/A,T)', '%', '동맥/폐포 산소분압비 (체온보정)'),
  -- 호흡지수
  ('Blood Gas', 'RI', 'RI', '-', '호흡지수'),
  ('Blood Gas', 'RI(T)', 'RI(T)', '-', '호흡지수 (체온보정)')
ON CONFLICT DO NOTHING;

-- sort_order 설정
UPDATE standard_items SET sort_order = 310 WHERE name = 'pO2(A)' AND category = 'Blood Gas';
UPDATE standard_items SET sort_order = 311 WHERE name = 'pO2(A-a)' AND category = 'Blood Gas';
UPDATE standard_items SET sort_order = 312 WHERE name = 'pO2(a/A)' AND category = 'Blood Gas';
UPDATE standard_items SET sort_order = 313 WHERE name = 'pO2(A,T)' AND category = 'Blood Gas';
UPDATE standard_items SET sort_order = 314 WHERE name = 'pO2(A-a,T)' AND category = 'Blood Gas';
UPDATE standard_items SET sort_order = 315 WHERE name = 'pO2(a/A,T)' AND category = 'Blood Gas';
UPDATE standard_items SET sort_order = 316 WHERE name = 'RI' AND category = 'Blood Gas';
UPDATE standard_items SET sort_order = 317 WHERE name = 'RI(T)' AND category = 'Blood Gas';

-- ============================================
-- PART 2: ABL80F 장비 별칭 추가
-- OCR에서 "pH(ABL80F)" → "pH" 로 매핑
-- ============================================

-- pH 관련
INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'pH(ABL80F)', 'pH', id, 'ABL80F' FROM standard_items WHERE name = 'pH' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'pH(T)(ABL80F)', 'pH(T)', id, 'ABL80F' FROM standard_items WHERE name = 'pH(T)' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

-- pCO2 관련
INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'pCO2(ABL80F)', 'pCO2', id, 'ABL80F' FROM standard_items WHERE name = 'pCO2' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'pCO2(T)(ABL80F)', 'pCO2(T)', id, 'ABL80F' FROM standard_items WHERE name = 'pCO2(T)' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

-- pO2 관련
INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'pO2(ABL80F)', 'pO2', id, 'ABL80F' FROM standard_items WHERE name = 'pO2' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'pO2(T)(ABL80F)', 'pO2(T)', id, 'ABL80F' FROM standard_items WHERE name = 'pO2(T)' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

-- 폐포 관련 별칭
INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'pO2(A)(ABL80F)', 'pO2(A)', id, 'ABL80F' FROM standard_items WHERE name = 'pO2(A)' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'pO2(A-a)(ABL80F)', 'pO2(A-a)', id, 'ABL80F' FROM standard_items WHERE name = 'pO2(A-a)' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'pO2(a/A)(ABL80F)', 'pO2(a/A)', id, 'ABL80F' FROM standard_items WHERE name = 'pO2(a/A)' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'pO2(A,T)(ABL80F)', 'pO2(A,T)', id, 'ABL80F' FROM standard_items WHERE name = 'pO2(A,T)' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'pO2(A-a,T)(ABL80F)', 'pO2(A-a,T)', id, 'ABL80F' FROM standard_items WHERE name = 'pO2(A-a,T)' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'pO2(a/A,T)(ABL80F)', 'pO2(a/A,T)', id, 'ABL80F' FROM standard_items WHERE name = 'pO2(a/A,T)' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

-- sO2 별칭 (ALB80F 오타 포함)
INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'sO2(ABL80F)', 'sO2', id, 'ABL80F' FROM standard_items WHERE name = 'sO2' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'sO2(ALB80F)', 'sO2', id, 'ABL80F' FROM standard_items WHERE name = 'sO2' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

-- ctO2 별칭
INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'ctO2(ABL80F)', 'ctO2', id, 'ABL80F' FROM standard_items WHERE name = 'ctO2' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'ctO2(ALB80F)', 'ctO2', id, 'ABL80F' FROM standard_items WHERE name = 'ctO2' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

-- RI 별칭
INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'RI(ABL80F)', 'RI', id, 'ABL80F' FROM standard_items WHERE name = 'RI' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'Rl(ABL80F)', 'RI', id, 'ABL80F' FROM standard_items WHERE name = 'RI' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'RI(T)(ABL80F)', 'RI(T)', id, 'ABL80F' FROM standard_items WHERE name = 'RI(T)' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'Rl(T)(ABL80F)', 'RI(T)', id, 'ABL80F' FROM standard_items WHERE name = 'RI(T)' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

-- 전해질 별칭 (Na+, K+, Ca++, Cl)
INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'Na+(ABL80F)', 'Na+(ABL80F)', id, 'ABL80F' FROM standard_items WHERE name = 'Na+(ABL80F)' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'K+(ABL80F)', 'K+(ABL80F)', id, 'ABL80F' FROM standard_items WHERE name = 'K+(ABL80F)' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'Ca++(ABL80F)', 'Ca++(ABL80F)', id, 'ABL80F' FROM standard_items WHERE name = 'Ca++(ABL80F)' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'Cl(ABL80F)', 'Cl(ABL80F)', id, 'ABL80F' FROM standard_items WHERE name = 'Cl(ABL80F)' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

-- Hct 별칭
INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'Hct(ABL80F)', 'Hct(ABL80F)', id, 'ABL80F' FROM standard_items WHERE name = 'Hct(ABL80F)' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

-- ctHB/ctHb 별칭
INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'ctHB(ABL80F)', 'ctHb', id, 'ABL80F' FROM standard_items WHERE name = 'ctHb' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'ctHb(ABL80F)', 'ctHb', id, 'ABL80F' FROM standard_items WHERE name = 'ctHb' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

-- cHCO3 별칭
INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'cHCO3(P)(ABL80F)', 'cHCO3', id, 'ABL80F' FROM standard_items WHERE name = 'cHCO3' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'cHCO3(P,st)(ABL80F)', 'cHCO3(P,st)', id, 'ABL80F' FROM standard_items WHERE name = 'cHCO3(P,st)' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

-- cBASE 별칭
INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'cBASE(B)(ABL80F)', 'cBASE(B)', id, 'ABL80F' FROM standard_items WHERE name = 'cBASE(B)' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'cBASE(Ecf)(ABL80F)', 'cBASE(Ecf)', id, 'ABL80F' FROM standard_items WHERE name = 'cBASE(Ecf)' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'cBASE(B,ox)(ABL80F)', 'cBASE(B,ox)', id, 'ABL80F' FROM standard_items WHERE name = 'cBASE(B,ox)' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'cBASE(Ecf,ox)(ABL80F)', 'cBASE(Ecf,ox)', id, 'ABL80F' FROM standard_items WHERE name = 'cBASE(Ecf,ox)' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'cBASE(Ecf.ox)(ABL80', 'cBASE(Ecf,ox)', id, 'ABL80F' FROM standard_items WHERE name = 'cBASE(Ecf,ox)' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

-- ctCO2 별칭
INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'ctCO2(B)(ABL80F)', 'ctCO2(B)', id, 'ABL80F' FROM standard_items WHERE name = 'ctCO2(B)' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'ctCO2(P)(ABL80F)', 'ctCO2(P)', id, 'ABL80F' FROM standard_items WHERE name = 'ctCO2(P)' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

-- cCa++ 별칭
INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'cCA++(7,40)(ABL80F)', 'cCa++(7.40)', id, 'ABL80F' FROM standard_items WHERE name = 'cCa++(7.40)' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'cCa++(7,40)(ABL80F)', 'cCa++(7.40)', id, 'ABL80F' FROM standard_items WHERE name = 'cCa++(7.40)' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'cCa++(7.40)(ABL80F)', 'cCa++(7.40)', id, 'ABL80F' FROM standard_items WHERE name = 'cCa++(7.40)' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

-- Anion Gap 별칭
INSERT INTO item_aliases (alias, canonical_name, standard_item_id, source_hint)
SELECT 'Anion Gap(ABL80F)', 'Anion Gap', id, 'ABL80F' FROM standard_items WHERE name = 'Anion Gap' AND category = 'Blood Gas'
ON CONFLICT (alias) DO NOTHING;

-- ============================================
-- PART 3: % 항목 별칭 추가
-- OCR에서 "MONO%", "NEU%" 등 → "%MONO", "%NEU" 등으로 매핑
-- ============================================

-- %MONO (단핵구%)
INSERT INTO item_aliases (alias, canonical_name, standard_item_id)
SELECT 'MONO%', '%MONO', id FROM standard_items WHERE name = '%MONO'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id)
SELECT 'Monocytes%', '%MONO', id FROM standard_items WHERE name = '%MONO'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id)
SELECT 'MONO(%)', '%MONO', id FROM standard_items WHERE name = '%MONO'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id)
SELECT '단핵구%', '%MONO', id FROM standard_items WHERE name = '%MONO'
ON CONFLICT (alias) DO NOTHING;

-- %NEU (호중구%)
INSERT INTO item_aliases (alias, canonical_name, standard_item_id)
SELECT 'NEU%', '%NEU', id FROM standard_items WHERE name = '%NEU'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id)
SELECT 'Neutrophils%', '%NEU', id FROM standard_items WHERE name = '%NEU'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id)
SELECT 'NEU(%)', '%NEU', id FROM standard_items WHERE name = '%NEU'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id)
SELECT '호중구%', '%NEU', id FROM standard_items WHERE name = '%NEU'
ON CONFLICT (alias) DO NOTHING;

-- %LYM (림프구%)
INSERT INTO item_aliases (alias, canonical_name, standard_item_id)
SELECT 'LYM%', '%LYM', id FROM standard_items WHERE name = '%LYM'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id)
SELECT 'Lymphocytes%', '%LYM', id FROM standard_items WHERE name = '%LYM'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id)
SELECT 'LYM(%)', '%LYM', id FROM standard_items WHERE name = '%LYM'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id)
SELECT '림프구%', '%LYM', id FROM standard_items WHERE name = '%LYM'
ON CONFLICT (alias) DO NOTHING;

-- %EOS (호산구%)
INSERT INTO item_aliases (alias, canonical_name, standard_item_id)
SELECT 'EOS%', '%EOS', id FROM standard_items WHERE name = '%EOS'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id)
SELECT 'Eosinophils%', '%EOS', id FROM standard_items WHERE name = '%EOS'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id)
SELECT 'EOS(%)', '%EOS', id FROM standard_items WHERE name = '%EOS'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id)
SELECT '호산구%', '%EOS', id FROM standard_items WHERE name = '%EOS'
ON CONFLICT (alias) DO NOTHING;

-- %BASO (호염기구%)
INSERT INTO item_aliases (alias, canonical_name, standard_item_id)
SELECT 'BASO%', '%BASO', id FROM standard_items WHERE name = '%BASO'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id)
SELECT 'Basophils%', '%BASO', id FROM standard_items WHERE name = '%BASO'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id)
SELECT 'BASO(%)', '%BASO', id FROM standard_items WHERE name = '%BASO'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id)
SELECT '호염기구%', '%BASO', id FROM standard_items WHERE name = '%BASO'
ON CONFLICT (alias) DO NOTHING;

-- %RETIC (망상적혈구%)
INSERT INTO item_aliases (alias, canonical_name, standard_item_id)
SELECT 'RETIC%', '%RETIC', id FROM standard_items WHERE name = '%RETIC'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id)
SELECT 'Reticulocytes%', '%RETIC', id FROM standard_items WHERE name = '%RETIC'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id)
SELECT 'RETIC(%)', '%RETIC', id FROM standard_items WHERE name = '%RETIC'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases (alias, canonical_name, standard_item_id)
SELECT '망상적혈구%', '%RETIC', id FROM standard_items WHERE name = '%RETIC'
ON CONFLICT (alias) DO NOTHING;

-- ============================================
-- PART 4: 모든 항목 설명 추가
-- description_common: 일반 설명
-- description_high: 높을 때 의미
-- description_low: 낮을 때 의미
-- ============================================

-- ========== CBC 항목 ==========

-- WBC (백혈구)
UPDATE standard_items SET
  description_common = '감염과 염증에 대항하는 면역세포입니다. 전체 면역 상태를 평가하는 기본 지표입니다.',
  description_high = '감염, 염증, 스트레스, 백혈병, 스테로이드 투여',
  description_low = '골수억제, 바이러스 감염, 면역억제, 패혈증'
WHERE name = 'WBC' AND category = 'CBC';

-- NEU (호중구)
UPDATE standard_items SET
  description_common = '세균 감염에 대한 1차 방어세포입니다. 염증 반응의 주요 지표입니다.',
  description_high = '세균 감염, 염증, 스트레스, 조직 괴사, 스테로이드 반응',
  description_low = '골수억제, 심한 감염(소모성), 면역억제'
WHERE name = 'NEU' AND category = 'CBC';

-- %NEU
UPDATE standard_items SET
  description_common = '백혈구 중 호중구가 차지하는 비율입니다.',
  description_high = '세균 감염, 스트레스, 스테로이드 반응',
  description_low = '림프구 증가 (상대적), 호중구 감소증'
WHERE name = '%NEU' AND category = 'CBC';

-- LYM (림프구)
UPDATE standard_items SET
  description_common = '면역 반응을 조절하는 세포입니다. 바이러스 감염과 면역 상태를 반영합니다.',
  description_high = '만성 감염, 바이러스 감염, 림프종, 면역 자극',
  description_low = '급성 스트레스, 스테로이드 투여, 림프관 손실'
WHERE name = 'LYM' AND category = 'CBC';

-- %LYM
UPDATE standard_items SET
  description_common = '백혈구 중 림프구가 차지하는 비율입니다.',
  description_high = '바이러스 감염, 만성 염증',
  description_low = '급성 스트레스, 스테로이드 반응'
WHERE name = '%LYM' AND category = 'CBC';

-- MONO (단핵구)
UPDATE standard_items SET
  description_common = '조직으로 이동하여 대식세포가 되는 세포입니다. 만성 염증 지표입니다.',
  description_high = '만성 염증, 감염 회복기, 조직 괴사, 면역매개질환',
  description_low = '임상적 의미 제한적'
WHERE name = 'MONO' AND category = 'CBC';

-- %MONO
UPDATE standard_items SET
  description_common = '백혈구 중 단핵구가 차지하는 비율입니다.',
  description_high = '만성 염증, 감염 회복기',
  description_low = '임상적 의미 제한적'
WHERE name = '%MONO' AND category = 'CBC';

-- EOS (호산구)
UPDATE standard_items SET
  description_common = '기생충 감염과 알레르기 반응에 관여하는 세포입니다.',
  description_high = '기생충 감염, 알레르기, 호산구성 질환, 과민반응',
  description_low = '급성 스트레스, 스테로이드 투여'
WHERE name = 'EOS' AND category = 'CBC';

-- %EOS
UPDATE standard_items SET
  description_common = '백혈구 중 호산구가 차지하는 비율입니다.',
  description_high = '기생충, 알레르기, 과민반응',
  description_low = '스트레스, 스테로이드 반응'
WHERE name = '%EOS' AND category = 'CBC';

-- BASO (호염기구)
UPDATE standard_items SET
  description_common = '히스타민을 함유한 희귀한 백혈구입니다. 알레르기 반응에 관여합니다.',
  description_high = '알레르기, 기생충 감염, 골수증식성 질환',
  description_low = '임상적 의미 제한적'
WHERE name = 'BASO' AND category = 'CBC';

-- %BASO
UPDATE standard_items SET
  description_common = '백혈구 중 호염기구가 차지하는 비율입니다.',
  description_high = '알레르기, 과민반응',
  description_low = '임상적 의미 제한적'
WHERE name = '%BASO' AND category = 'CBC';

-- RBC (적혈구)
UPDATE standard_items SET
  description_common = '산소를 운반하는 혈액세포입니다. 빈혈과 적혈구증가증 평가에 사용됩니다.',
  description_high = '탈수, 적혈구증가증, 저산소증 보상',
  description_low = '빈혈 (출혈, 용혈, 골수억제, 만성질환)'
WHERE name = 'RBC' AND category = 'CBC';

-- HGB (헤모글로빈)
UPDATE standard_items SET
  description_common = '적혈구 내 산소 운반 단백질입니다. 빈혈 진단의 핵심 지표입니다.',
  description_high = '탈수, 적혈구증가증',
  description_low = '빈혈 (철분 결핍, 출혈, 용혈, 만성질환)'
WHERE name = 'HGB' AND category = 'CBC';

-- HCT (헤마토크릿)
UPDATE standard_items SET
  description_common = '혈액 중 적혈구가 차지하는 부피 비율입니다. 빈혈과 탈수 평가의 기본 지표입니다.',
  description_high = '탈수, 적혈구증가증, 비장 수축',
  description_low = '빈혈, 과수화, 출혈'
WHERE name = 'HCT' AND category = 'CBC';

-- MCV
UPDATE standard_items SET
  description_common = '적혈구의 평균 크기입니다. 빈혈의 원인 분류에 도움됩니다.',
  description_high = '거대적아구성 빈혈, 망상적혈구 증가, FeLV 감염 (고양이)',
  description_low = '철분 결핍, 만성 출혈, 간문맥 단락'
WHERE name = 'MCV' AND category = 'CBC';

-- MCH
UPDATE standard_items SET
  description_common = '적혈구 1개당 평균 헤모글로빈 양입니다.',
  description_high = '용혈, 지질혈증 (간섭)',
  description_low = '철분 결핍, 만성 출혈'
WHERE name = 'MCH' AND category = 'CBC';

-- MCHC
UPDATE standard_items SET
  description_common = '적혈구 내 헤모글로빈 농도입니다.',
  description_high = '용혈, 지질혈증/용혈 (간섭), 구상적혈구증',
  description_low = '철분 결핍, 망상적혈구 증가'
WHERE name = 'MCHC' AND category = 'CBC';

-- RDW
UPDATE standard_items SET
  description_common = '적혈구 크기의 변이 정도입니다. 빈혈 원인 감별에 도움됩니다.',
  description_high = '철분 결핍 빈혈, 재생성 빈혈, 수혈 후',
  description_low = '임상적 의미 제한적'
WHERE name = 'RDW' AND category = 'CBC';

-- RETIC (망상적혈구)
UPDATE standard_items SET
  description_common = '미성숙 적혈구로 골수의 적혈구 생산 능력을 반영합니다.',
  description_high = '재생성 빈혈 (출혈, 용혈), 빈혈 치료 반응',
  description_low = '비재생성 빈혈, 골수억제, 만성 신장병'
WHERE name = 'RETIC' AND category = 'CBC';

-- %RETIC
UPDATE standard_items SET
  description_common = '적혈구 중 망상적혈구가 차지하는 비율입니다.',
  description_high = '재생성 빈혈, 골수 반응',
  description_low = '비재생성 빈혈, 골수억제'
WHERE name = '%RETIC' AND category = 'CBC';

-- PLT (혈소판)
UPDATE standard_items SET
  description_common = '지혈에 필수적인 혈액세포입니다. 출혈 경향 평가에 사용됩니다.',
  description_high = '반응성 혈소판증가증, 철분 결핍, 비장절제 후',
  description_low = '면역매개 혈소판감소증, 골수억제, DIC, 감염'
WHERE name = 'PLT' AND category = 'CBC';

-- MPV
UPDATE standard_items SET
  description_common = '혈소판의 평균 크기입니다. 골수 기능 평가에 도움됩니다.',
  description_high = '혈소판 재생 활발, 면역매개 파괴',
  description_low = '골수억제, 만성 염증'
WHERE name = 'MPV' AND category = 'CBC';

-- ========== Chemistry 항목 ==========

-- BUN
UPDATE standard_items SET
  description_common = '단백질 대사 산물로 신장에서 배설됩니다. 신장 기능과 탈수 평가에 사용됩니다.',
  description_high = '신장질환, 탈수, 위장관 출혈, 고단백 식이, 요로 폐색',
  description_low = '간부전, 저단백 식이, 다뇨'
WHERE name = 'BUN' AND category = 'Chemistry';

-- Creatinine
UPDATE standard_items SET
  description_common = '근육 대사 산물로 신장에서 배설됩니다. 신장 기능 평가의 핵심 지표입니다.',
  description_high = '신장질환 (급성/만성), 탈수, 요로 폐색, 근육량 과다',
  description_low = '근육량 감소, 심한 저단백혈증'
WHERE name = 'Creatinine' AND category = 'Chemistry';

-- Phosphorus
UPDATE standard_items SET
  description_common = '뼈와 에너지 대사에 중요한 미네랄입니다. 신장과 부갑상선 기능을 반영합니다.',
  description_high = '신장질환, 부갑상선기능저하증, 골 용해, 어린 동물',
  description_low = '부갑상선기능항진증, 당뇨병성 케톤산증, 영양 결핍'
WHERE name = 'Phosphorus' AND category = 'Chemistry';

-- ALT
UPDATE standard_items SET
  description_common = '간세포에 특이적인 효소입니다. 간세포 손상의 민감한 지표입니다.',
  description_high = '간세포 손상/괴사, 간염, 간독성, 저산소증',
  description_low = '임상적 의미 제한적'
WHERE name = 'ALT' AND category = 'Chemistry';

-- AST
UPDATE standard_items SET
  description_common = '간과 근육에 존재하는 효소입니다. 간/근육 손상을 반영합니다.',
  description_high = '간세포 손상, 근육 손상, 용혈',
  description_low = '임상적 의미 제한적'
WHERE name = 'AST' AND category = 'Chemistry';

-- ALKP
UPDATE standard_items SET
  description_common = '담관과 뼈에서 분비되는 효소입니다. 담즙 정체와 스테로이드 반응을 평가합니다.',
  description_high = '담즙 정체, 스테로이드 유도 (개), 뼈 질환, 성장기',
  description_low = '임상적 의미 제한적'
WHERE name = 'ALKP' AND category = 'Chemistry';

-- GGT
UPDATE standard_items SET
  description_common = '담관에서 분비되는 효소입니다. 담즙 정체의 민감한 지표입니다.',
  description_high = '담즙 정체, 담관 질환, 췌장염, 스테로이드 유도',
  description_low = '임상적 의미 제한적'
WHERE name = 'GGT' AND category = 'Chemistry';

-- T.Bilirubin
UPDATE standard_items SET
  description_common = '헤모글로빈 분해 산물입니다. 황달의 원인 평가에 사용됩니다.',
  description_high = '용혈, 간질환, 담관 폐색 (황달)',
  description_low = '임상적 의미 제한적'
WHERE name = 'T.Bilirubin' AND category = 'Chemistry';

-- Protein-Total
UPDATE standard_items SET
  description_common = '혈액 내 총 단백질 양입니다. 영양상태와 면역기능을 반영합니다.',
  description_high = '탈수, 만성 염증, 다발성 골수종',
  description_low = '단백 소실 (신장/장), 간부전, 출혈, 영양실조'
WHERE name = 'Protein-Total' AND category = 'Chemistry';

-- Albumin
UPDATE standard_items SET
  description_common = '간에서 합성되는 주요 혈장 단백질입니다. 영양과 간 기능을 반영합니다.',
  description_high = '탈수',
  description_low = '간부전, 신장/장 소실, 염증, 영양실조'
WHERE name = 'Albumin' AND category = 'Chemistry';

-- Globulin
UPDATE standard_items SET
  description_common = '면역글로불린을 포함한 단백질입니다. 염증과 면역 상태를 반영합니다.',
  description_high = '만성 염증, 감염, 면역매개질환, 종양',
  description_low = '면역결핍, 신생아'
WHERE name = 'Globulin' AND category = 'Chemistry';

-- Glucose
UPDATE standard_items SET
  description_common = '혈당 수치로 에너지 대사 상태를 반영합니다.',
  description_high = '당뇨병, 스트레스 (고양이), 스테로이드 투여, 췌장염',
  description_low = '인슐린 과다, 패혈증, 간부전, 부신기능저하증'
WHERE name = 'Glucose' AND category = 'Chemistry';

-- Na+
UPDATE standard_items SET
  description_common = '체액 균형과 신경/근육 기능에 필수적인 전해질입니다.',
  description_high = '탈수, 수분 섭취 부족, 당뇨병성 삼투성 이뇨',
  description_low = '구토/설사, 부신기능저하증, 이뇨제, 심한 당뇨'
WHERE name = 'Na+' AND category = 'Chemistry';

-- K+
UPDATE standard_items SET
  description_common = '심장과 근육 기능에 중요한 전해질입니다.',
  description_high = '신장질환, 부신기능저하증, 요로 폐색, 조직 괴사',
  description_low = '구토/설사, 인슐린 투여, 이뇨제, 알칼리증'
WHERE name = 'K+' AND category = 'Chemistry';

-- Cl-
UPDATE standard_items SET
  description_common = '산-염기 균형 유지에 중요한 전해질입니다.',
  description_high = '탈수, 대사성 산증, 신장질환',
  description_low = '구토, 대사성 알칼리증, 이뇨제'
WHERE name = 'Cl-' AND category = 'Chemistry';

-- Calcium
UPDATE standard_items SET
  description_common = '뼈, 근육, 신경 기능에 필수적인 미네랄입니다.',
  description_high = '악성종양, 부갑상선기능항진증, 신장질환, 비타민D 중독',
  description_low = '부갑상선기능저하증, 저알부민혈증, 급성 췌장염'
WHERE name = 'Calcium' AND category = 'Chemistry';

-- Lipase
UPDATE standard_items SET
  description_common = '췌장에서 분비되는 지방 분해 효소입니다. 췌장염 진단에 사용됩니다.',
  description_high = '췌장염, 신장질환, 위장관 질환',
  description_low = '임상적 의미 제한적'
WHERE name = 'Lipase' AND category = 'Chemistry';

-- T.Cholesterol
UPDATE standard_items SET
  description_common = '혈중 총 콜레스테롤입니다. 지질 대사와 내분비 질환을 평가합니다.',
  description_high = '갑상선기능저하증, 당뇨병, 쿠싱증후군, 담즙 정체',
  description_low = '간부전, 흡수 장애, 단백소실장병증'
WHERE name = 'T.Cholesterol' AND category = 'Chemistry';

-- Triglycerides
UPDATE standard_items SET
  description_common = '혈중 중성지방입니다. 지질 대사 장애를 평가합니다.',
  description_high = '식후, 갑상선기능저하증, 당뇨병, 쿠싱증후군, 췌장염',
  description_low = '영양실조, 흡수 장애'
WHERE name = 'Triglycerides' AND category = 'Chemistry';

-- ========== Special 항목 ==========

-- cPL
UPDATE standard_items SET
  description_common = '개 특이 췌장 리파아제입니다. 개 췌장염 진단의 가장 특이적인 지표입니다.',
  description_high = '췌장염 (급성/만성)',
  description_low = '임상적 의미 없음'
WHERE name = 'cPL' AND category = 'Special';

-- SDMA
UPDATE standard_items SET
  description_common = '신장에서 배설되는 아미노산 유도체입니다. 조기 신장질환 발견에 유용합니다.',
  description_high = '신장 기능 저하 (GFR 40% 감소 시 상승)',
  description_low = '임상적 의미 제한적'
WHERE name = 'SDMA' AND category = 'Special';

-- CRP
UPDATE standard_items SET
  description_common = 'C반응성단백으로 급성 염증의 민감한 지표입니다.',
  description_high = '급성 염증, 감염, 조직 손상, 수술 후',
  description_low = '임상적 의미 제한적'
WHERE name = 'CRP' AND category = 'Special';

-- proBNP
UPDATE standard_items SET
  description_common = '심장에서 분비되는 호르몬입니다. 심장 질환 선별에 사용됩니다.',
  description_high = '심장질환 (심근병증, 심부전), 폐고혈압',
  description_low = '임상적 의미 제한적'
WHERE name = 'proBNP' AND category = 'Special';

-- ========== Blood Gas 항목 ==========

-- pH
UPDATE standard_items SET
  description_common = '혈액의 산도를 나타냅니다. 산-염기 균형 평가의 기본 지표입니다.',
  description_high = '알칼리증 (호흡성/대사성)',
  description_low = '산증 (호흡성/대사성)'
WHERE name = 'pH' AND category = 'Blood Gas';

-- pH(T)
UPDATE standard_items SET
  description_common = '체온 보정된 혈액 산도입니다.',
  description_high = '알칼리증',
  description_low = '산증'
WHERE name = 'pH(T)' AND category = 'Blood Gas';

-- pCO2
UPDATE standard_items SET
  description_common = '혈액 내 이산화탄소 분압입니다. 호흡 기능을 반영합니다.',
  description_high = '호흡성 산증 (환기 저하), 대사성 알칼리증 보상',
  description_low = '호흡성 알칼리증 (과환기), 대사성 산증 보상'
WHERE name = 'pCO2' AND category = 'Blood Gas';

-- pCO2(T)
UPDATE standard_items SET
  description_common = '체온 보정된 이산화탄소 분압입니다.',
  description_high = '환기 저하, 호흡성 산증',
  description_low = '과환기, 호흡성 알칼리증'
WHERE name = 'pCO2(T)' AND category = 'Blood Gas';

-- pO2
UPDATE standard_items SET
  description_common = '혈액 내 산소 분압입니다. 폐의 산소 교환 능력을 반영합니다.',
  description_high = '산소 투여',
  description_low = '저산소증, 폐질환, 환기-관류 불균형'
WHERE name = 'pO2' AND category = 'Blood Gas';

-- pO2(T)
UPDATE standard_items SET
  description_common = '체온 보정된 산소 분압입니다.',
  description_high = '산소 투여',
  description_low = '저산소증'
WHERE name = 'pO2(T)' AND category = 'Blood Gas';

-- sO2
UPDATE standard_items SET
  description_common = '헤모글로빈의 산소 포화도입니다. 조직으로의 산소 전달을 반영합니다.',
  description_high = '산소 투여',
  description_low = '저산소증, 빈혈, 일산화탄소 중독'
WHERE name = 'sO2' AND category = 'Blood Gas';

-- cHCO3
UPDATE standard_items SET
  description_common = '중탄산염으로 대사성 산-염기 상태를 반영합니다.',
  description_high = '대사성 알칼리증, 호흡성 산증 보상',
  description_low = '대사성 산증, 호흡성 알칼리증 보상'
WHERE name = 'cHCO3' AND category = 'Blood Gas';

-- cHCO3(P,st)
UPDATE standard_items SET
  description_common = '표준 조건(pCO2 40mmHg)에서의 중탄산염입니다. 순수 대사성 변화를 반영합니다.',
  description_high = '대사성 알칼리증',
  description_low = '대사성 산증'
WHERE name = 'cHCO3(P,st)' AND category = 'Blood Gas';

-- BE
UPDATE standard_items SET
  description_common = '염기과잉으로 대사성 산-염기 상태를 수치화합니다.',
  description_high = '대사성 알칼리증',
  description_low = '대사성 산증'
WHERE name = 'BE' AND category = 'Blood Gas';

-- cBASE(B)
UPDATE standard_items SET
  description_common = '혈액의 염기과잉입니다.',
  description_high = '대사성 알칼리증',
  description_low = '대사성 산증'
WHERE name = 'cBASE(B)' AND category = 'Blood Gas';

-- cBASE(Ecf)
UPDATE standard_items SET
  description_common = '세포외액의 염기과잉입니다. 전신 산-염기 상태를 더 정확히 반영합니다.',
  description_high = '대사성 알칼리증',
  description_low = '대사성 산증'
WHERE name = 'cBASE(Ecf)' AND category = 'Blood Gas';

-- cBASE(B,ox)
UPDATE standard_items SET
  description_common = '산소화 보정된 혈액 염기과잉입니다.',
  description_high = '대사성 알칼리증',
  description_low = '대사성 산증'
WHERE name = 'cBASE(B,ox)' AND category = 'Blood Gas';

-- cBASE(Ecf,ox)
UPDATE standard_items SET
  description_common = '산소화 보정된 세포외액 염기과잉입니다.',
  description_high = '대사성 알칼리증',
  description_low = '대사성 산증'
WHERE name = 'cBASE(Ecf,ox)' AND category = 'Blood Gas';

-- Anion Gap
UPDATE standard_items SET
  description_common = '측정되지 않는 음이온의 양입니다. 대사성 산증의 원인 감별에 사용됩니다.',
  description_high = '젖산 산증, 케톤산증, 신부전, 중독 (에틸렌글리콜 등)',
  description_low = '저알부민혈증, 검사 오류'
WHERE name = 'Anion Gap' AND category = 'Blood Gas';

-- Anion
UPDATE standard_items SET
  description_common = '음이온 수치입니다.',
  description_high = '대사성 이상',
  description_low = '임상적 의미 제한적'
WHERE name = 'Anion' AND category = 'Blood Gas';

-- ctCO2(B)
UPDATE standard_items SET
  description_common = '혈액 내 총 이산화탄소입니다.',
  description_high = '대사성 알칼리증, 호흡성 산증',
  description_low = '대사성 산증, 호흡성 알칼리증'
WHERE name = 'ctCO2(B)' AND category = 'Blood Gas';

-- ctCO2(P)
UPDATE standard_items SET
  description_common = '혈장 내 총 이산화탄소입니다.',
  description_high = '대사성 알칼리증, 호흡성 산증',
  description_low = '대사성 산증, 호흡성 알칼리증'
WHERE name = 'ctCO2(P)' AND category = 'Blood Gas';

-- ctHb
UPDATE standard_items SET
  description_common = '혈액가스 분석기로 측정한 총 헤모글로빈입니다.',
  description_high = '적혈구증가증, 탈수',
  description_low = '빈혈'
WHERE name = 'ctHb' AND category = 'Blood Gas';

-- ctO2
UPDATE standard_items SET
  description_common = '혈액 내 총 산소 함량입니다. 산소 운반 능력을 반영합니다.',
  description_high = '산소 투여, 적혈구증가증',
  description_low = '빈혈, 저산소증'
WHERE name = 'ctO2' AND category = 'Blood Gas';

-- p50(act)
UPDATE standard_items SET
  description_common = '산소해리곡선에서 50% 포화 시 산소분압입니다. 산소 친화도를 반영합니다.',
  description_high = '산소 친화도 감소 (조직에 산소 방출 증가)',
  description_low = '산소 친화도 증가 (조직에 산소 방출 감소)'
WHERE name = 'p50(act)' AND category = 'Blood Gas';

-- Na+(ABL80F)
UPDATE standard_items SET
  description_common = '혈액가스 분석기로 측정한 나트륨입니다.',
  description_high = '탈수, 고나트륨혈증',
  description_low = '저나트륨혈증, 부신기능저하증'
WHERE name = 'Na+(ABL80F)' AND category = 'Blood Gas';

-- K+(ABL80F)
UPDATE standard_items SET
  description_common = '혈액가스 분석기로 측정한 칼륨입니다.',
  description_high = '신부전, 부신기능저하증, 조직 괴사',
  description_low = '구토/설사, 이뇨제'
WHERE name = 'K+(ABL80F)' AND category = 'Blood Gas';

-- Ca++(ABL80F)
UPDATE standard_items SET
  description_common = '이온화 칼슘입니다. 생리적으로 활성화된 칼슘 형태입니다.',
  description_high = '악성종양, 부갑상선기능항진증',
  description_low = '부갑상선기능저하증, 급성 췌장염'
WHERE name = 'Ca++(ABL80F)' AND category = 'Blood Gas';

-- cCa++(7.40)
UPDATE standard_items SET
  description_common = 'pH 7.40으로 보정된 이온화 칼슘입니다.',
  description_high = '고칼슘혈증',
  description_low = '저칼슘혈증'
WHERE name = 'cCa++(7.40)' AND category = 'Blood Gas';

-- Cl(ABL80F)
UPDATE standard_items SET
  description_common = '혈액가스 분석기로 측정한 염소입니다.',
  description_high = '탈수, 대사성 산증',
  description_low = '구토, 대사성 알칼리증'
WHERE name = 'Cl(ABL80F)' AND category = 'Blood Gas';

-- Hct(ABL80F)
UPDATE standard_items SET
  description_common = '혈액가스 분석기로 측정한 헤마토크릿입니다.',
  description_high = '탈수, 적혈구증가증',
  description_low = '빈혈'
WHERE name = 'Hct(ABL80F)' AND category = 'Blood Gas';

-- HGB(Gas)
UPDATE standard_items SET
  description_common = '혈액가스 분석기로 측정한 헤모글로빈입니다.',
  description_high = '적혈구증가증, 탈수',
  description_low = '빈혈'
WHERE name = 'HGB(Gas)' AND category = 'Blood Gas';

-- 폐포 관련 지표
-- pO2(A)
UPDATE standard_items SET
  description_common = '폐포 내 산소분압입니다. 폐포 환기를 반영합니다.',
  description_high = '산소 투여, 과환기',
  description_low = '저환기, 고지대'
WHERE name = 'pO2(A)' AND category = 'Blood Gas';

-- pO2(A-a)
UPDATE standard_items SET
  description_common = '폐포-동맥 산소분압차입니다. 폐의 가스교환 효율을 평가합니다.',
  description_high = '폐질환, 환기-관류 불균형, 단락',
  description_low = '정상 폐기능'
WHERE name = 'pO2(A-a)' AND category = 'Blood Gas';

-- pO2(a/A)
UPDATE standard_items SET
  description_common = '동맥/폐포 산소분압비입니다. 산소화 효율을 반영합니다.',
  description_high = '정상 또는 양호한 산소화',
  description_low = '폐질환, 가스교환 장애'
WHERE name = 'pO2(a/A)' AND category = 'Blood Gas';

-- pO2(A,T)
UPDATE standard_items SET
  description_common = '체온 보정된 폐포 산소분압입니다.',
  description_high = '산소 투여',
  description_low = '저환기'
WHERE name = 'pO2(A,T)' AND category = 'Blood Gas';

-- pO2(A-a,T)
UPDATE standard_items SET
  description_common = '체온 보정된 폐포-동맥 산소분압차입니다.',
  description_high = '폐질환, 가스교환 장애',
  description_low = '정상 폐기능'
WHERE name = 'pO2(A-a,T)' AND category = 'Blood Gas';

-- pO2(a/A,T)
UPDATE standard_items SET
  description_common = '체온 보정된 동맥/폐포 산소분압비입니다.',
  description_high = '양호한 산소화',
  description_low = '가스교환 장애'
WHERE name = 'pO2(a/A,T)' AND category = 'Blood Gas';

-- RI
UPDATE standard_items SET
  description_common = '호흡지수로 폐의 산소화 능력을 종합 평가합니다.',
  description_high = '폐질환, ARDS, 폐렴',
  description_low = '정상 폐기능'
WHERE name = 'RI' AND category = 'Blood Gas';

-- RI(T)
UPDATE standard_items SET
  description_common = '체온 보정된 호흡지수입니다.',
  description_high = '폐질환',
  description_low = '정상'
WHERE name = 'RI(T)' AND category = 'Blood Gas';

-- ========== Coagulation 항목 ==========

-- PT
UPDATE standard_items SET
  description_common = '프로트롬빈 시간으로 외인성 응고경로를 평가합니다.',
  description_high = '간부전, 비타민K 결핍, 항응고제, DIC',
  description_low = '임상적 의미 제한적'
WHERE name = 'PT' AND category = 'Coagulation';

-- APTT
UPDATE standard_items SET
  description_common = '활성화 부분 트롬보플라스틴 시간으로 내인성 응고경로를 평가합니다.',
  description_high = '혈우병, 헤파린 투여, DIC, 간부전',
  description_low = '임상적 의미 제한적'
WHERE name = 'APTT' AND category = 'Coagulation';

-- Fibrinogen
UPDATE standard_items SET
  description_common = '피브리노겐으로 응고 최종단계와 급성기 반응을 반영합니다.',
  description_high = '급성 염증, 임신',
  description_low = '간부전, DIC, 대량 수혈'
WHERE name = 'Fibrinogen' AND category = 'Coagulation';

-- D-dimer
UPDATE standard_items SET
  description_common = '피브린 분해산물로 혈전 형성과 용해를 반영합니다.',
  description_high = '혈전색전증, DIC, 수술 후, 염증',
  description_low = '임상적 의미 제한적'
WHERE name = 'D-dimer' AND category = 'Coagulation';

-- ============================================
-- Migration Complete
-- ============================================
