-- 카드 배치 커스텀 설정 컬럼 추가
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS card_layout JSONB DEFAULT NULL;
