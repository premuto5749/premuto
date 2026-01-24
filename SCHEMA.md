# Database Schema: Mimo Health Log

## Overview
참고치(Reference)를 장비마다 다르게 저장하고, 이름이 달라도 같은 항목으로 처리하기 위한 고도화된 DB 구조입니다.

**v2 업데이트**: 다중 파일 업로드 지원 및 AI 기반 매칭 신뢰도 저장 기능 추가

## Tables

### 1. 표준 항목 마스터 (Standard Items)
미모 데이터의 'Category'와 'Item'을 관리하는 기준 테이블

```sql
create table standard_items (
  id uuid primary key default gen_random_uuid(),
  category varchar, -- 예: CBC, Chemistry, Electrolyte, Special
  name varchar not null, -- 표준명 (예: 'Creatinine', 'cPL')
  display_name_ko varchar, -- 한글명 (예: '크레아티닌', '췌장특이효소')
  default_unit varchar, -- 기본 단위 (예: mg/dL, ng/ml)
  description text -- 해석 가이드 내용 (예: '신장 기능 지표...')
);
```

### 2. 항목 매핑 사전 (Item Synonyms) - **AI 학습 기반**
OCR 결과가 다양하게 나와도 표준 항목으로 연결해주는 사전
- 예: raw_name='Cre' -> standard_item_id='Creatinine의 ID'
- 예: raw_name='CREA' -> standard_item_id='Creatinine의 ID'
- **v2 추가**: AI가 제안한 매칭을 사용자가 승인하면 자동으로 이 테이블에 추가되어 다음번 학습에 활용

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

### 3. 검사 기록 헤더 (Test Records) - **다중 파일 통합**
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

### 4. 검사 상세 결과 (Test Results) - **핵심 테이블**
**중요**: 검사 당시의 참고치(Snapshot)를 여기에 직접 저장합니다.

```sql
create table test_results (
  id uuid primary key default gen_random_uuid(),
  record_id uuid references test_records(id) on delete cascade,
  standard_item_id uuid references standard_items(id), -- 어떤 항목인가

  value numeric not null, -- 검사 결과 수치

  -- **참고치 스냅샷 (Dynamic Reference Range)**
  ref_min numeric, -- 그 당시 검사지의 최소값 (Low 기준)
  ref_max numeric, -- 그 당시 검사지의 최대값 (High 기준)
  ref_text varchar, -- 참고치 텍스트 원본 (예: "5.0-16.0")

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
```

## Design Principles

1. **참고치 스냅샷**: 검사 당시의 참고치를 결과와 함께 저장하여 과거 데이터의 정확한 해석 보장
2. **동의어 매핑**: 다양한 검사지 형식에 대응하기 위한 유연한 매핑 시스템
3. **데이터 무결성**: 외래 키와 체크 제약조건을 통한 데이터 품질 보장
4. **확장성**: 새로운 검사 항목과 장비를 쉽게 추가할 수 있는 구조

**v2 추가 원칙**:
5. **다중 파일 통합**: 한 번의 검사에 여러 문서가 있어도 하나의 `test_records`로 통합 저장
6. **추적성**: 각 결과가 어떤 파일에서 왔는지, OCR 원본 이름이 무엇이었는지 추적 가능
7. **AI 학습 피드백**: 사용자가 승인한 매칭 정보가 `item_mappings`에 자동 저장되어 점진적 개선
8. **신뢰도 기반 워크플로우**: 매칭 신뢰도가 낮은 항목을 우선적으로 사용자에게 제시하여 효율적인 검수
