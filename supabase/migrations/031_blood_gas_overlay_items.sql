-- ============================================
-- Migration 031: Blood Gas 장비(GEM 등) 중복 항목 분리
--
-- CBC/Chemistry와 동일 측정 대상이지만 혈액가스 장비에서
-- 측정한 값은 방법·시료가 달라 수치가 다를 수 있음.
-- 별도 표준항목으로 분리하여 두 값을 모두 보존.
-- ============================================

-- 1. Blood Gas 전용 표준항목 추가
INSERT INTO standard_items_master (name, display_name_ko, default_unit, category, exam_type, organ_tags, sort_order)
VALUES
  ('HCT(BG)',      '적혈구용적률(혈액가스)', '%',      'Blood Gas', 'Blood Gas', '["혈액"]',          900),
  ('Na(BG)',       '나트륨(혈액가스)',       'mmol/L', 'Blood Gas', 'Blood Gas', '["전해질"]',        901),
  ('K(BG)',        '칼륨(혈액가스)',         'mmol/L', 'Blood Gas', 'Blood Gas', '["전해질"]',        902),
  ('Ca(BG)',       '칼슘(혈액가스)',         'mmol/L', 'Blood Gas', 'Blood Gas', '["전해질"]',        903),
  ('Cl(BG)',       '염소(혈액가스)',         'mmol/L', 'Blood Gas', 'Blood Gas', '["전해질"]',        904),
  ('Glucose(BG)',  '혈당(혈액가스)',         'mg/dL',  'Blood Gas', 'Blood Gas', '["대사"]',          905),
  ('Lactate(BG)',  '젖산(혈액가스)',         'mmol/L', 'Blood Gas', 'Blood Gas', '["대사"]',          906),
  ('tHb(BG)',      '총헤모글로빈(혈액가스)', 'g/dL',   'Blood Gas', 'Blood Gas', '["혈액"]',          907),
  ('Ca(7.4)(BG)',  '보정칼슘(pH7.4)',       'mmol/L', 'Blood Gas', 'Blood Gas', '["전해질"]',        908)
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
