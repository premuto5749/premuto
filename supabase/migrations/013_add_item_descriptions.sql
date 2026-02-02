-- Migration 013: standard_items 테이블에 설명 컬럼 추가
-- 각 검사 항목에 대한 설명을 저장하기 위한 컬럼들

-- 설명 컬럼 추가
ALTER TABLE standard_items
ADD COLUMN IF NOT EXISTS description_common TEXT,
ADD COLUMN IF NOT EXISTS description_high TEXT,
ADD COLUMN IF NOT EXISTS description_low TEXT;

-- 컬럼 설명 추가
COMMENT ON COLUMN standard_items.description_common IS '검사 항목에 대한 일반적인 설명';
COMMENT ON COLUMN standard_items.description_high IS '수치가 높을 때의 의미와 원인';
COMMENT ON COLUMN standard_items.description_low IS '수치가 낮을 때의 의미와 원인';

-- 예시 데이터 (선택적)
-- UPDATE standard_items
-- SET
--   description_common = '신장의 여과 기능을 평가하는 핵심 지표입니다.',
--   description_high = '신장 기능 저하, 탈수, 요로 폐색, 고단백 식이',
--   description_low = '근육량 감소, 간 기능 저하, 저단백 식이'
-- WHERE name = 'Creatinine';
