-- 029: 체중 추적 + 칼로리 관리
-- log_category enum에 'weight' 추가, pets 테이블에 칼로리 관련 컬럼 추가

-- 1. log_category enum에 'weight' 추가
ALTER TYPE log_category ADD VALUE IF NOT EXISTS 'weight';

-- 2. pets 테이블에 칼로리 관련 컬럼 추가
ALTER TABLE pets ADD COLUMN IF NOT EXISTS is_neutered BOOLEAN DEFAULT FALSE;
ALTER TABLE pets ADD COLUMN IF NOT EXISTS activity_level VARCHAR(10) DEFAULT 'normal'
  CHECK (activity_level IN ('low', 'normal', 'high'));
ALTER TABLE pets ADD COLUMN IF NOT EXISTS food_calorie_density DECIMAL(6, 2) DEFAULT NULL;

-- 3. 체중 기록 시 pets.weight_kg 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_pet_weight_on_log()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.category = 'weight' AND NEW.amount IS NOT NULL AND NEW.pet_id IS NOT NULL THEN
    UPDATE pets SET weight_kg = NEW.amount, updated_at = NOW()
    WHERE id = NEW.pet_id AND user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_pet_weight ON daily_logs;
CREATE TRIGGER trigger_update_pet_weight
  AFTER INSERT ON daily_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_pet_weight_on_log();

-- 4. 체중 조회 성능 인덱스는 030에서 생성 (같은 트랜잭션에서 새 enum 값 참조 불가)
