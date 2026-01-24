-- hospitals 테이블 생성
CREATE TABLE IF NOT EXISTS hospitals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  address TEXT,
  phone VARCHAR(50),
  website VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 인덱스 생성
CREATE INDEX idx_hospitals_name ON hospitals(name);

-- 업데이트 타임스탬프 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_hospitals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hospitals_updated_at
  BEFORE UPDATE ON hospitals
  FOR EACH ROW
  EXECUTE FUNCTION update_hospitals_updated_at();

-- test_records 테이블에 hospital_id 외래키 추가
-- (기존 hospital_name 필드는 유지하되, hospital_id로 참조하도록 함)
ALTER TABLE test_records
  ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES hospitals(id);

-- 기존 hospital_name에서 hospitals 테이블로 데이터 마이그레이션
-- (기존 데이터가 있다면 hospitals 테이블에 추가)
INSERT INTO hospitals (name)
SELECT DISTINCT hospital_name
FROM test_records
WHERE hospital_name IS NOT NULL
  AND hospital_name != ''
ON CONFLICT (name) DO NOTHING;

-- 기존 test_records의 hospital_name을 hospital_id로 매핑
UPDATE test_records
SET hospital_id = hospitals.id
FROM hospitals
WHERE test_records.hospital_name = hospitals.name;

-- 코멘트 추가
COMMENT ON TABLE hospitals IS '병원 정보 테이블';
COMMENT ON COLUMN hospitals.name IS '병원명';
COMMENT ON COLUMN hospitals.address IS '주소';
COMMENT ON COLUMN hospitals.phone IS '전화번호';
COMMENT ON COLUMN hospitals.website IS '웹사이트 URL';
COMMENT ON COLUMN hospitals.notes IS '메모';
