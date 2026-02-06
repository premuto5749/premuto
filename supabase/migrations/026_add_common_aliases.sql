-- =====================================================
-- Migration: 026_add_common_aliases
-- Description: 자주 사용되는 약어 별칭 추가 (AP→ALKP, GPT→ALT 등)
-- =====================================================

-- 표준 항목 ID 조회 후 별칭 삽입 (이미 존재하면 무시)
DO $$
DECLARE
  v_alkp_id UUID;
  v_alt_id UUID;
  v_ast_id UUID;
  v_tbil_id UUID;
  v_tchol_id UUID;
  v_cre_id UUID;
  v_cal_id UUID;
  v_phos_id UUID;
  v_fib_id UUID;
BEGIN
  SELECT id INTO v_alkp_id FROM standard_items_master WHERE LOWER(name) = 'alkp';
  SELECT id INTO v_alt_id FROM standard_items_master WHERE LOWER(name) = 'alt';
  SELECT id INTO v_ast_id FROM standard_items_master WHERE LOWER(name) = 'ast';
  SELECT id INTO v_tbil_id FROM standard_items_master WHERE LOWER(name) = 't.bilirubin';
  SELECT id INTO v_tchol_id FROM standard_items_master WHERE LOWER(name) = 't.cholesterol';
  SELECT id INTO v_cre_id FROM standard_items_master WHERE LOWER(name) = 'creatinine';
  SELECT id INTO v_cal_id FROM standard_items_master WHERE LOWER(name) = 'calcium';
  SELECT id INTO v_phos_id FROM standard_items_master WHERE LOWER(name) = 'phosphorus';
  SELECT id INTO v_fib_id FROM standard_items_master WHERE LOWER(name) = 'fibrinogen';

  -- AP → ALKP
  IF v_alkp_id IS NOT NULL THEN
    INSERT INTO item_aliases_master (alias, canonical_name, source_hint, standard_item_id)
    VALUES ('AP', 'ALKP', NULL, v_alkp_id)
    ON CONFLICT (alias) DO NOTHING;
  END IF;

  -- GPT → ALT, SGPT → ALT
  IF v_alt_id IS NOT NULL THEN
    INSERT INTO item_aliases_master (alias, canonical_name, source_hint, standard_item_id)
    VALUES ('GPT', 'ALT', NULL, v_alt_id)
    ON CONFLICT (alias) DO NOTHING;

    INSERT INTO item_aliases_master (alias, canonical_name, source_hint, standard_item_id)
    VALUES ('SGPT', 'ALT', NULL, v_alt_id)
    ON CONFLICT (alias) DO NOTHING;
  END IF;

  -- GOT → AST, SGOT → AST
  IF v_ast_id IS NOT NULL THEN
    INSERT INTO item_aliases_master (alias, canonical_name, source_hint, standard_item_id)
    VALUES ('GOT', 'AST', NULL, v_ast_id)
    ON CONFLICT (alias) DO NOTHING;

    INSERT INTO item_aliases_master (alias, canonical_name, source_hint, standard_item_id)
    VALUES ('SGOT', 'AST', NULL, v_ast_id)
    ON CONFLICT (alias) DO NOTHING;
  END IF;

  -- Bil → T.Bilirubin
  IF v_tbil_id IS NOT NULL THEN
    INSERT INTO item_aliases_master (alias, canonical_name, source_hint, standard_item_id)
    VALUES ('Bil', 'T.Bilirubin', NULL, v_tbil_id)
    ON CONFLICT (alias) DO NOTHING;
  END IF;

  -- Chol → T.Cholesterol, TCH → T.Cholesterol
  IF v_tchol_id IS NOT NULL THEN
    INSERT INTO item_aliases_master (alias, canonical_name, source_hint, standard_item_id)
    VALUES ('Chol', 'T.Cholesterol', NULL, v_tchol_id)
    ON CONFLICT (alias) DO NOTHING;

    INSERT INTO item_aliases_master (alias, canonical_name, source_hint, standard_item_id)
    VALUES ('TCH', 'T.Cholesterol', NULL, v_tchol_id)
    ON CONFLICT (alias) DO NOTHING;
  END IF;

  -- Cr → Creatinine
  IF v_cre_id IS NOT NULL THEN
    INSERT INTO item_aliases_master (alias, canonical_name, source_hint, standard_item_id)
    VALUES ('Cr', 'Creatinine', NULL, v_cre_id)
    ON CONFLICT (alias) DO NOTHING;
  END IF;

  -- iCa → Calcium
  IF v_cal_id IS NOT NULL THEN
    INSERT INTO item_aliases_master (alias, canonical_name, source_hint, standard_item_id)
    VALUES ('iCa', 'Calcium', NULL, v_cal_id)
    ON CONFLICT (alias) DO NOTHING;
  END IF;

  -- Phos → Phosphorus
  IF v_phos_id IS NOT NULL THEN
    INSERT INTO item_aliases_master (alias, canonical_name, source_hint, standard_item_id)
    VALUES ('Phos', 'Phosphorus', NULL, v_phos_id)
    ON CONFLICT (alias) DO NOTHING;
  END IF;

  -- FIB, Fib → Fibrinogen
  IF v_fib_id IS NOT NULL THEN
    INSERT INTO item_aliases_master (alias, canonical_name, source_hint, standard_item_id)
    VALUES ('FIB', 'Fibrinogen', NULL, v_fib_id)
    ON CONFLICT (alias) DO NOTHING;

    INSERT INTO item_aliases_master (alias, canonical_name, source_hint, standard_item_id)
    VALUES ('Fib', 'Fibrinogen', NULL, v_fib_id)
    ON CONFLICT (alias) DO NOTHING;
  END IF;
END $$;
