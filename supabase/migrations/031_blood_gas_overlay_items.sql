-- ============================================
-- Migration 031: Blood Gas 장비(GEM 등) 중복 항목 분리
--
-- CBC/Chemistry와 동일 측정 대상이지만 혈액가스 장비에서
-- 측정한 값은 방법·시료가 달라 수치가 다를 수 있음.
-- 별도 표준항목으로 분리하여 두 값을 모두 보존.
-- ============================================

-- 1. Blood Gas 전용 표준항목 추가
INSERT INTO standard_items_master (name, display_name_ko, default_unit, category, exam_type, organ_tags, sort_order, description_common, description_high, description_low)
VALUES
  ('HCT(BG)',      '적혈구용적률(혈액가스)', '%',      'Blood Gas', 'Blood Gas', '["혈액"]',     900,
   '혈액가스 장비(GEM 등)로 측정한 적혈구용적률. 전도도(conductometry) 방식으로 측정하여 CBC 장비의 HCT(임피던스/광학)와 1~3% 차이가 날 수 있습니다. 응급 상황에서 빠르게 빈혈 여부를 확인할 때 사용합니다.',
   '탈수, 적혈구증다증, 쇼크 초기(혈장 누출)',
   '빈혈, 출혈, 수액 과다 투여, 만성 질환'),
  ('Na(BG)',       '나트륨(혈액가스)',       'mmol/L', 'Blood Gas', 'Blood Gas', '["전해질"]',   901,
   '혈액가스 장비로 측정한 나트륨. 전혈에서 이온선택전극(ISE) 직접법으로 측정하여, Chemistry의 간접법과 약간 차이가 날 수 있습니다.',
   '탈수(수분 부족), 고나트륨혈증, 요붕증, 구토/설사 후 수분 손실',
   '저나트륨혈증, 수분 과잉, 애디슨병, 심한 구토/설사'),
  ('K(BG)',        '칼륨(혈액가스)',         'mmol/L', 'Blood Gas', 'Blood Gas', '["전해질"]',   902,
   '혈액가스 장비로 측정한 칼륨. 전혈 직접 측정이라 용혈 영향을 덜 받습니다. 심장 부정맥 위험 평가에 중요합니다.',
   '고칼륨혈증 — 급성 신부전, 요로폐색, 애디슨병, 조직 괴사. 심장 부정맥 위험.',
   '저칼륨혈증 — 구토, 설사, 수액치료 중, 인슐린 투여. 근무력, 장마비 위험.'),
  ('Ca(BG)',       '칼슘(혈액가스)',         'mmol/L', 'Blood Gas', 'Blood Gas', '["전해질"]',   903,
   '혈액가스 장비로 측정한 이온화 칼슘(iCa). Chemistry의 총칼슘(mg/dL)과 단위·의미가 다릅니다. 생리적으로 활성인 칼슘만 측정하므로 임상적으로 더 정확합니다.',
   '고칼슘혈증 — 악성 종양(림프종), 부갑상선항진증, 비타민D 중독, 애디슨병',
   '저칼슘혈증 — 산욕기(수유 중), 급성 췌장염, 신부전, 저알부민혈증'),
  ('Cl(BG)',       '염소(혈액가스)',         'mmol/L', 'Blood Gas', 'Blood Gas', '["전해질"]',   904,
   '혈액가스 장비로 측정한 염소. 산염기 균형 평가에서 나트륨·중탄산염과 함께 해석합니다.',
   '고염소혈증 — 탈수, 비호흡성 대사산증(설사 등), 과다 생리식염수 투여',
   '저염소혈증 — 구토(위산 손실), 대사성 알칼리증, 이뇨제 사용'),
  ('Glucose(BG)',  '혈당(혈액가스)',         'mg/dL',  'Blood Gas', 'Blood Gas', '["대사"]',     905,
   '혈액가스 장비로 측정한 혈당. 전혈 직접 측정이라 Chemistry 혈청 혈당보다 10~15% 낮을 수 있습니다. 응급 시 저혈당/고혈당 즉시 확인에 사용.',
   '고혈당 — 당뇨병, 스트레스성 고혈당(고양이), 쿠싱증후군, 스테로이드 투여',
   '저혈당 — 인슐린 과다, 패혈증, 간부전, 신생아/소형견, 인슐린종'),
  ('Lactate(BG)',  '젖산(혈액가스)',         'mmol/L', 'Blood Gas', 'Blood Gas', '["대사"]',     906,
   '혈액가스 장비로 측정한 젖산. 조직 저산소증의 지표로, 응급/중환자에서 예후 판단에 핵심적입니다. 정상 개: <2.5 mmol/L.',
   '조직 저산소증(쇼크, 패혈증), 장허혈(GDV), 심한 빈혈, 발작 후, 격렬한 운동',
   '임상적 의미 없음 (낮을수록 좋음)'),
  ('tHb(BG)',      '총헤모글로빈(혈액가스)', 'g/dL',   'Blood Gas', 'Blood Gas', '["혈액"]',     907,
   '혈액가스 장비로 측정한 총헤모글로빈. CO-oximetry 방식으로 측정하여 CBC의 HGB(시안메트헤모글로빈법)와 측정 원리가 다릅니다. 산소 운반 능력 평가에 사용.',
   '탈수, 적혈구증다증',
   '빈혈, 출혈, 수액 과다 투여'),
  ('Ca(7.4)(BG)',  '보정칼슘(pH7.4)',       'mmol/L', 'Blood Gas', 'Blood Gas', '["전해질"]',   908,
   'pH 7.4로 보정한 이온화 칼슘. 환자의 산염기 상태가 칼슘 결합에 영향을 주므로, 표준 pH로 보정하여 "진짜" 칼슘 수준을 평가합니다.',
   '고칼슘혈증 — 악성 종양, 부갑상선항진증, 비타민D 중독',
   '저칼슘혈증 — 산욕기, 급성 췌장염, 신부전')
ON CONFLICT (name) DO NOTHING;

-- 2. GEM 장비 별칭 등록
-- HCT (GEM) → HCT(BG)
INSERT INTO item_aliases_master (alias, canonical_name, source_hint, standard_item_id)
SELECT 'HCT (GEM)', 'HCT(BG)', 'GEM', id FROM standard_items_master WHERE name = 'HCT(BG)'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases_master (alias, canonical_name, source_hint, standard_item_id)
SELECT 'HCT(GEM)', 'HCT(BG)', 'GEM', id FROM standard_items_master WHERE name = 'HCT(BG)'
ON CONFLICT (alias) DO NOTHING;

-- Na (GEM) → Na(BG)
INSERT INTO item_aliases_master (alias, canonical_name, source_hint, standard_item_id)
SELECT 'Na (GEM)', 'Na(BG)', 'GEM', id FROM standard_items_master WHERE name = 'Na(BG)'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases_master (alias, canonical_name, source_hint, standard_item_id)
SELECT 'Na(GEM)', 'Na(BG)', 'GEM', id FROM standard_items_master WHERE name = 'Na(BG)'
ON CONFLICT (alias) DO NOTHING;

-- K (GEM) → K(BG)
INSERT INTO item_aliases_master (alias, canonical_name, source_hint, standard_item_id)
SELECT 'K (GEM)', 'K(BG)', 'GEM', id FROM standard_items_master WHERE name = 'K(BG)'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases_master (alias, canonical_name, source_hint, standard_item_id)
SELECT 'K(GEM)', 'K(BG)', 'GEM', id FROM standard_items_master WHERE name = 'K(BG)'
ON CONFLICT (alias) DO NOTHING;

-- Ca (GEM) → Ca(BG)
INSERT INTO item_aliases_master (alias, canonical_name, source_hint, standard_item_id)
SELECT 'Ca (GEM)', 'Ca(BG)', 'GEM', id FROM standard_items_master WHERE name = 'Ca(BG)'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases_master (alias, canonical_name, source_hint, standard_item_id)
SELECT 'Ca(GEM)', 'Ca(BG)', 'GEM', id FROM standard_items_master WHERE name = 'Ca(BG)'
ON CONFLICT (alias) DO NOTHING;

-- Cl (GEM) → Cl(BG)
INSERT INTO item_aliases_master (alias, canonical_name, source_hint, standard_item_id)
SELECT 'Cl (GEM)', 'Cl(BG)', 'GEM', id FROM standard_items_master WHERE name = 'Cl(BG)'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases_master (alias, canonical_name, source_hint, standard_item_id)
SELECT 'Cl(GEM)', 'Cl(BG)', 'GEM', id FROM standard_items_master WHERE name = 'Cl(BG)'
ON CONFLICT (alias) DO NOTHING;

-- GLU (GEM) → Glucose(BG)
INSERT INTO item_aliases_master (alias, canonical_name, source_hint, standard_item_id)
SELECT 'GLU (GEM)', 'Glucose(BG)', 'GEM', id FROM standard_items_master WHERE name = 'Glucose(BG)'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases_master (alias, canonical_name, source_hint, standard_item_id)
SELECT 'GLU(GEM)', 'Glucose(BG)', 'GEM', id FROM standard_items_master WHERE name = 'Glucose(BG)'
ON CONFLICT (alias) DO NOTHING;

-- LAC (GEM) → Lactate(BG)
INSERT INTO item_aliases_master (alias, canonical_name, source_hint, standard_item_id)
SELECT 'LAC (GEM)', 'Lactate(BG)', 'GEM', id FROM standard_items_master WHERE name = 'Lactate(BG)'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases_master (alias, canonical_name, source_hint, standard_item_id)
SELECT 'LAC(GEM)', 'Lactate(BG)', 'GEM', id FROM standard_items_master WHERE name = 'Lactate(BG)'
ON CONFLICT (alias) DO NOTHING;

-- tHb (GEM) → tHb(BG)
INSERT INTO item_aliases_master (alias, canonical_name, source_hint, standard_item_id)
SELECT 'tHb (GEM)', 'tHb(BG)', 'GEM', id FROM standard_items_master WHERE name = 'tHb(BG)'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases_master (alias, canonical_name, source_hint, standard_item_id)
SELECT 'tHb(GEM)', 'tHb(BG)', 'GEM', id FROM standard_items_master WHERE name = 'tHb(BG)'
ON CONFLICT (alias) DO NOTHING;

-- Ca(7.4) (GEM) → Ca(7.4)(BG)
INSERT INTO item_aliases_master (alias, canonical_name, source_hint, standard_item_id)
SELECT 'Ca(7.4) (GEM)', 'Ca(7.4)(BG)', 'GEM', id FROM standard_items_master WHERE name = 'Ca(7.4)(BG)'
ON CONFLICT (alias) DO NOTHING;

INSERT INTO item_aliases_master (alias, canonical_name, source_hint, standard_item_id)
SELECT 'Ca(7.4)(GEM)', 'Ca(7.4)(BG)', 'GEM', id FROM standard_items_master WHERE name = 'Ca(7.4)(BG)'
ON CONFLICT (alias) DO NOTHING;

-- 3. 기존 Blood Gas 별칭 보정: HGB(Gas) → tHb(BG)로 변경
UPDATE item_aliases_master
SET canonical_name = 'tHb(BG)',
    standard_item_id = (SELECT id FROM standard_items_master WHERE name = 'tHb(BG)')
WHERE alias = 'HGB(Gas)' AND canonical_name = 'HGB';

-- ============================================
-- Migration Complete
-- ============================================
