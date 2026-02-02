# Database Schema: Mimo Health Log

## Overview
반려동물 '미모'의 건강을 종합적으로 관리하기 위한 데이터베이스 구조입니다.

**주요 기능**:
1. **일일 건강 기록**: 식사, 음수, 약, 배변, 배뇨, 호흡수 기록 (`daily_logs`)
2. **혈액검사 아카이브**: 검사지 OCR 분석 및 시계열 관리 (`test_records`, `test_results`)

**v2 업데이트**: 다중 파일 업로드 지원 및 AI 기반 매칭 신뢰도 저장 기능 추가
**v3 업데이트**: 일일 건강 기록 기능 추가
**v3.2 업데이트**: 마스터 데이터 v3 스키마 확장 (exam_type, organ_tags, item_aliases, sort_order_configs)

## Tables

### 0. 일일 건강 기록 (Daily Logs) - **v3 추가**
반려동물의 일일 건강 상태를 기록하는 테이블

```sql
-- 기록 카테고리 enum
CREATE TYPE log_category AS ENUM (
  'meal',      -- 식사
  'water',     -- 음수
  'medicine',  -- 약
  'poop',      -- 배변
  'pee',       -- 배뇨
  'breathing'  -- 호흡수
);

CREATE TABLE daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category log_category NOT NULL,    -- 기록 유형
  logged_at TIMESTAMPTZ NOT NULL,    -- 기록 시간
  amount DECIMAL(10, 2),             -- 양 (g, ml, 회/분 등)
  unit VARCHAR(20),                  -- 단위
  memo TEXT,                         -- 메모
  photo_urls JSONB DEFAULT '[]',     -- 사진 URL 배열 (최대 5장)
  medicine_name VARCHAR(100),        -- 약 이름 (category='medicine'일 때)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 일일 통계 뷰
CREATE VIEW daily_stats AS
SELECT
  (logged_at AT TIME ZONE 'UTC')::date as log_date,
  SUM(CASE WHEN category = 'meal' THEN amount ELSE 0 END) as total_meal_amount,
  COUNT(CASE WHEN category = 'meal' THEN 1 END) as meal_count,
  SUM(CASE WHEN category = 'water' THEN amount ELSE 0 END) as total_water_amount,
  COUNT(CASE WHEN category = 'water' THEN 1 END) as water_count,
  COUNT(CASE WHEN category = 'medicine' THEN 1 END) as medicine_count,
  COUNT(CASE WHEN category = 'poop' THEN 1 END) as poop_count,
  COUNT(CASE WHEN category = 'pee' THEN 1 END) as pee_count,
  AVG(CASE WHEN category = 'breathing' THEN amount END) as avg_breathing_rate,
  COUNT(CASE WHEN category = 'breathing' THEN 1 END) as breathing_count
FROM daily_logs
GROUP BY (logged_at AT TIME ZONE 'UTC')::date;
```

**카테고리별 기록 항목**:
| 카테고리 | 설명 | 단위 | 비고 |
|---------|------|------|------|
| `meal` | 식사 | g | 사료/간식 섭취량 |
| `water` | 음수 | ml | 물 섭취량 |
| `medicine` | 약 | 정/ml | `medicine_name`에 약 이름 기록 |
| `poop` | 배변 | 회 | 양보다 횟수 중심 |
| `pee` | 배뇨 | 회 | 양보다 횟수 중심 |
| `breathing` | 호흡수 | 회/분 | 분당 호흡수 |

---

### 1. 표준 항목 마스터 (Standard Items) - **v3.2 업데이트**
미모 데이터의 'Category'와 'Item'을 관리하는 기준 테이블

```sql
create table standard_items (
  id uuid primary key default gen_random_uuid(),
  category varchar, -- 예: CBC, Chemistry, Electrolyte, Special (하위 호환)
  name varchar not null, -- 표준명 (예: 'Creatinine', 'cPL')
  display_name_ko varchar, -- 한글명 (예: '크레아티닌', '췌장특이효소')
  default_unit varchar, -- 기본 단위 (예: mg/dL, ng/ml)
  description text, -- 해석 가이드 내용 (예: '신장 기능 지표...')

  -- v3.2 추가 필드
  exam_type varchar(50), -- 검사 유형: Vital, CBC, Chemistry, Special, Blood Gas, Coagulation, 뇨검사, 안과검사, Echo
  organ_tags jsonb default '[]'::jsonb, -- 장기 태그 배열: ["신장", "간", "전해질"] 등
  sort_order integer -- 정렬 순서 (선택사항)
);

-- v3.2 인덱스
create index idx_standard_items_exam_type on standard_items(exam_type);
create index idx_standard_items_organ_tags on standard_items using gin(organ_tags);
```

**v3.2 exam_type 목록** (9개):
- `Vital`: 기본 신체 검사 (체온, 체중, 맥박, 혈압)
- `CBC`: 혈구 검사 (WBC, RBC, HGB, HCT, PLT 등)
- `Chemistry`: 화학 검사 (BUN, Creatinine, ALT, AST 등)
- `Special`: 특수 검사 (cPL, proBNP, SDMA 등)
- `Blood Gas`: 혈액 가스 (pH, pCO2, pO2, Lactate 등)
- `Coagulation`: 응고 검사 (PT, APTT, Fibrinogen 등)
- `뇨검사`: 소변 검사 (요비중, pH, UPC 등)
- `안과검사`: 안과 검사 (눈물량, 안압)
- `Echo`: 심초음파 (E, LVIDd)

**v3.2 organ_tags 목록** (21개):
```
기본신체, 혈액, 간, 신장, 췌장, 심장, 전해질, 산염기,
호흡, 지혈, 면역, 염증, 대사, 내분비, 근육, 뼈,
담도, 영양, 알레르기, 감염, 안과
```

### 2. 항목 별칭 (Item Aliases) - **v3.2 추가**
OCR 결과가 다양하게 나와도 표준 항목으로 연결해주는 별칭 테이블
- `item_mappings`을 대체하는 새로운 테이블 (하위 호환성 유지)
- **source_hint**: 장비/병원별 힌트 지원 (예: ABL80F, IDEXX)

```sql
create table item_aliases (
  id uuid primary key default gen_random_uuid(),
  alias varchar(100) not null, -- 검사지에 적힌 날것의 이름
  canonical_name varchar(100) not null, -- 표준 항목명 (standard_items.name)
  source_hint varchar(100), -- 장비/병원 힌트 (예: ABL80F, IDEXX, Fuji)
  standard_item_id uuid references standard_items(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 동일한 alias가 중복 생성되지 않도록 유니크 제약
create unique index idx_unique_alias on item_aliases(alias);
-- 표준 항목으로 빠른 조회
create index idx_alias_standard_item on item_aliases(standard_item_id);
```

**source_hint 예시**:
| alias | canonical_name | source_hint | 설명 |
|-------|---------------|-------------|------|
| cHCO3(P) | cHCO3 | ABL80F | ABL80F 혈액가스 장비의 표기 |
| crea | Creatinine | IDEXX | IDEXX 장비의 약어 |
| Neu% | NEU | - | 일반적 약어 |

---

### 3. 항목 매핑 사전 (Item Mappings) - **레거시, v3.2부터 item_aliases 사용 권장**
OCR 결과가 다양하게 나와도 표준 항목으로 연결해주는 사전
- 예: raw_name='Cre' -> standard_item_id='Creatinine의 ID'
- 예: raw_name='CREA' -> standard_item_id='Creatinine의 ID'
- **v2 추가**: AI가 제안한 매칭을 사용자가 승인하면 자동으로 이 테이블에 추가되어 다음번 학습에 활용
- **v3.2 참고**: 새로운 매핑은 `item_aliases` 테이블에 저장 권장

```sql
create table item_mappings (
  id uuid primary key default gen_random_uuid(),
  raw_name varchar not null, -- 검사지에 적힌 날것의 이름
  standard_item_id uuid references standard_items(id),

  -- v2 추가 필드
  confidence_score numeric(5,2), -- AI 매칭 신뢰도 (0.00~100.00)
  mapping_source varchar check (mapping_source in ('ai', 'user', 'manual')),
    -- ai: AI가 자동 매칭, user: 사용자가 AI 제안 승인, manual: 사용자가 직접 입력
  created_at timestamptz default now(),
  created_by varchar -- 매핑을 생성한 사용자 (향후 다중 사용자 지원 시)
);

-- 동일한 raw_name이 중복 생성되지 않도록 유니크 제약
create unique index idx_unique_raw_name on item_mappings(raw_name);
```

---

### 4. 정렬 설정 (Sort Order Configs) - **v3.2 추가**
대시보드 View 옵션의 정렬 설정을 저장하는 테이블

```sql
create table sort_order_configs (
  id uuid primary key default gen_random_uuid(),
  sort_type varchar(50) not null unique, -- by_exam_type, by_organ, by_clinical_priority, by_panel
  config jsonb not null, -- 정렬 순서 및 그룹 설정
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

**config 예시** (by_exam_type):
```json
{
  "order": ["Vital", "CBC", "Chemistry", "Special", "Blood Gas", "Coagulation", "뇨검사", "안과검사", "Echo"]
}
```

**config 예시** (by_panel):
```json
{
  "panels": [
    { "panel": "Basic", "label": "기본 혈액검사", "items": ["WBC", "RBC", "HGB", "HCT", "PLT", ...] },
    { "panel": "Pre-anesthetic", "label": "마취 전 검사", "items": [...] },
    { "panel": "Senior", "label": "노령견 종합", "items": [...] },
    { "panel": "Pancreatitis", "label": "췌장염 집중", "items": ["cPL", "Lipase", "Amylase", ...] },
    { "panel": "Coagulation", "label": "응고 검사", "items": [...] },
    { "panel": "Emergency", "label": "응급/중환자", "items": [...] },
    { "panel": "Cardiac", "label": "심장 검사", "items": [...] },
    { "panel": "Kidney", "label": "신장 집중", "items": [...] }
  ]
}
```

### 5. 검사 기록 헤더 (Test Records) - **다중 파일 통합**
병원 방문 1회당 1개의 레코드 생성 (여러 파일에서 추출된 결과를 하나로 통합)

```sql
create table test_records (
  id uuid primary key default gen_random_uuid(),
  test_date date not null, -- 검사 날짜 (2025-12-02 등)
  hospital_name varchar, -- 병원명 (타임즈, 서동심 등)
  machine_type varchar, -- 장비명 (선택사항, 예: Fuji, IDEXX)

  -- v2 추가 필드: 다중 파일 업로드 지원
  uploaded_files jsonb, -- 업로드된 파일들의 메타데이터 배열
    -- 예: [
    --   {"filename": "cbc_2025-12-02.pdf", "size": 245120, "type": "application/pdf"},
    --   {"filename": "chemistry_2025-12-02.jpg", "size": 1048576, "type": "image/jpeg"}
    -- ]
  file_count integer default 1, -- 업로드된 파일 개수
  batch_upload_id varchar, -- 같은 배치로 업로드된 파일들을 그룹화 (UUID 또는 타임스탬프)

  created_at timestamptz default now()
);
```

### 6. 검사 상세 결과 (Test Results) - **핵심 테이블**
**중요**: 검사 당시의 참고치(Snapshot)를 여기에 직접 저장합니다.

**설계 철학 - 장비별 참고치 독립성**:
- 같은 항목(예: Creatinine)이라도 검사 장비에 따라 참고치가 다릅니다.
  - Hitachi 장비: 0~10 mg/dL
  - IDEXX 장비: 0~<9 mg/dL
  - Fuji 장비: 0.5~1.8 mg/dL
- **절대 `standard_items`에 고정 참고치를 저장하지 말 것**: 각 검사 결과는 반드시 자체 참고치를 가져야 합니다.
- 판정(Low/Normal/High)은 **해당 검사 당시의 참고치**로만 수행합니다.

```sql
create table test_results (
  id uuid primary key default gen_random_uuid(),
  record_id uuid references test_records(id) on delete cascade,
  standard_item_id uuid references standard_items(id), -- 어떤 항목인가

  value numeric not null, -- 검사 결과 수치

  -- **참고치 스냅샷 (Dynamic Reference Range) - 가장 중요한 부분**
  -- 이 필드들은 검사 당시 검사지에 적힌 참고치를 그대로 저장합니다.
  -- 장비가 바뀌거나 검사 방법이 변경되어도 과거 데이터의 정확한 해석이 가능합니다.
  ref_min numeric, -- 그 당시 검사지의 최소값 (Low 기준)
  ref_max numeric, -- 그 당시 검사지의 최대값 (High 기준)
  ref_text varchar, -- 참고치 텍스트 원본 (예: "5.0-16.0", "0-<9" 등)
    -- ref_text는 사람이 읽기 편한 형태로 저장 (UI 표시용)
    -- 예: "5.0-16.0", "< 9", "> 0.5", "음성(-)" 등

  status varchar check (status in ('Low', 'Normal', 'High', 'Unknown')), -- 판정 결과
  unit varchar, -- 그 당시 검사지의 단위 (단위가 바뀔 수도 있으므로 저장)

  -- v2 추가 필드: 추적성 및 AI 매칭 정보
  source_filename varchar, -- 이 결과가 추출된 원본 파일명
  ocr_raw_name varchar, -- OCR이 읽은 원본 항목명 (디버깅/감사 용도)
  mapping_confidence numeric(5,2), -- AI 매칭 신뢰도 (item_mappings의 값 복사)
  user_verified boolean default false, -- 사용자가 검수 완료 여부
  created_at timestamptz default now()
);

-- 성능 최적화를 위한 인덱스
create index idx_test_results_record on test_results(record_id);
create index idx_test_results_item on test_results(standard_item_id);

-- 참고치 변경 추적을 위한 인덱스 (같은 항목의 시계열 조회 최적화)
create index idx_test_results_item_date on test_results(standard_item_id, created_at);
```

**참고치 스냅샷 예시**:
```sql
-- 2024년 12월 검사 (Hitachi 장비)
INSERT INTO test_results VALUES (
  ...,
  'Creatinine-UUID',
  1.2, -- value
  0, 10, '0-10', -- ref_min, ref_max, ref_text
  'Normal',
  'mg/dL',
  ...
);

-- 2025년 1월 검사 (장비 교체 → Fuji 장비)
INSERT INTO test_results VALUES (
  ...,
  'Creatinine-UUID', -- 같은 항목이지만
  1.2, -- 같은 값이라도
  0.5, 1.8, '0.5-1.8', -- 참고치가 다름!
  'Normal',
  'mg/dL',
  ...
);
```

## Design Principles

1. **참고치 스냅샷 (가장 중요)**:
   - 검사 당시의 참고치를 결과와 함께 저장하여 과거 데이터의 정확한 해석 보장
   - **장비별 참고치 독립성**: 같은 항목이라도 장비마다 참고치가 다를 수 있으므로, 각 `test_results` 레코드는 자체 `ref_min`, `ref_max`를 가짐
   - **글로벌 참고치 금지**: `standard_items`에 "기본 참고치"를 저장하지 않음. 모든 판정은 해당 검사의 참고치로만 수행
   - **시간 추적**: 같은 항목의 참고치가 시간에 따라 어떻게 변했는지 추적 가능 (장비 교체 감지)

2. **동의어 매핑**: 다양한 검사지 형식에 대응하기 위한 유연한 매핑 시스템

3. **데이터 무결성**: 외래 키와 체크 제약조건을 통한 데이터 품질 보장

4. **확장성**: 새로운 검사 항목과 장비를 쉽게 추가할 수 있는 구조

**v2 추가 원칙**:
5. **다중 파일 통합**: 한 번의 검사에 여러 문서가 있어도 하나의 `test_records`로 통합 저장
6. **추적성**: 각 결과가 어떤 파일에서 왔는지, OCR 원본 이름이 무엇이었는지 추적 가능
7. **AI 학습 피드백**: 사용자가 승인한 매칭 정보가 `item_mappings`에 자동 저장되어 점진적 개선
8. **신뢰도 기반 워크플로우**: 매칭 신뢰도가 낮은 항목을 우선적으로 사용자에게 제시하여 효율적인 검수

## 참고치 관리 FAQ

**Q: `standard_items` 테이블에 `default_ref_min`, `default_ref_max` 같은 필드를 추가하면 안 되나요?**
A: 절대 안 됩니다. 장비마다 참고치가 다르므로, 표준 항목에 고정 참고치를 저장하면 잘못된 판정이 발생합니다.

**Q: UI에서 "이 항목의 정상 범위는 얼마인가요?"라고 물으면 뭐라고 대답해야 하나요?**
A: "검사 장비에 따라 다릅니다. 각 검사 결과를 클릭하면 해당 검사의 참고치를 확인할 수 있습니다."

**Q: 참고치가 바뀐 것을 어떻게 감지하나요?**
A: 같은 항목(`standard_item_id`)의 연속된 검사 결과를 시간순으로 조회하여, `ref_min`과 `ref_max`가 달라진 지점을 찾습니다.

**Q: 여러 검사에 걸쳐 평균 참고치를 계산해서 보여주면 안 되나요?**
A: 안 됩니다. 각 검사는 해당 검사의 참고치로만 판정되어야 합니다. 평균은 의미가 없습니다.
