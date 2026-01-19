# Database Schema: Mimo Health Log

## Overview
참고치(Reference)를 장비마다 다르게 저장하고, 이름이 달라도 같은 항목으로 처리하기 위한 고도화된 DB 구조입니다.

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

### 2. 항목 매핑 사전 (Item Synonyms)
OCR 결과가 다양하게 나와도 표준 항목으로 연결해주는 사전
- 예: raw_name='Cre' -> standard_item_id='Creatinine의 ID'
- 예: raw_name='CREA' -> standard_item_id='Creatinine의 ID'

```sql
create table item_mappings (
  id uuid primary key default gen_random_uuid(),
  raw_name varchar not null, -- 검사지에 적힌 날것의 이름
  standard_item_id uuid references standard_items(id)
);
```

### 3. 검사 기록 헤더 (Test Records)
병원 방문 1회당 1개의 레코드 생성

```sql
create table test_records (
  id uuid primary key default gen_random_uuid(),
  test_date date not null, -- 검사 날짜 (2025-12-02 등)
  hospital_name varchar, -- 병원명 (타임즈, 서동심 등)
  machine_type varchar, -- 장비명 (선택사항, 예: Fuji, IDEXX)
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
  unit varchar -- 그 당시 검사지의 단위 (단위가 바뀔 수도 있으므로 저장)
);
```

## Design Principles

1. **참고치 스냅샷**: 검사 당시의 참고치를 결과와 함께 저장하여 과거 데이터의 정확한 해석 보장
2. **동의어 매핑**: 다양한 검사지 형식에 대응하기 위한 유연한 매핑 시스템
3. **데이터 무결성**: 외래 키와 체크 제약조건을 통한 데이터 품질 보장
4. **확장성**: 새로운 검사 항목과 장비를 쉽게 추가할 수 있는 구조
