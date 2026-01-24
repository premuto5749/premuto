# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Project: Mimo Health Log (미모 맞춤형 혈액검사 아카이브)

## 1. 프로젝트 목표
반려동물 '미모'의 다년간 누적된 혈액검사지(PDF/이미지)를 OCR로 판독하여 DB화하고, 병원/장비마다 다른 참고치(Reference Range)와 항목명(Alias)을 표준화하여 시계열 트렌드를 분석한다.

**v2 핵심 개선사항**:
- 여러 날짜의 검사를 한 번에 업로드하고 자동으로 날짜별 그룹화
- 날짜별 탭 UI로 각 검사를 독립적으로 확인 및 저장
- GPT-4o 기반 지능형 매칭으로 사용자 개입 최소화
- 결과 우선 확인 방식으로 빠른 피드백 제공
- 병렬 처리 (OCR, AI 매칭, 저장)로 성능 극대화

## 2. 프로젝트 문서 구조

이 프로젝트는 다음 문서들로 구성되어 있습니다:
- **CLAUDE.md** (이 파일): 개발 가이드라인 및 핵심 도메인 규칙
- **PRD.md**: 제품 요구사항 명세서 - 사용자 워크플로우(Upload → AI Parsing → Staging & Mapping → Save)와 UI 요구사항
- **SCHEMA.md**: 데이터베이스 스키마 - 4개 핵심 테이블(standard_items, item_mappings, test_records, test_results)
- **README.md**: 프로젝트 개요 및 Claude Code 설정 가이드
- **settings.json**: Claude Code 자동 실행 권한 설정

## 3. 아키텍처 개요

### 데이터 흐름 (Data Flow) - v2 개선 버전

#### Phase 1: 다중 파일 업로드 및 일괄 분석
1. **다중 파일 입력**: 사용자가 여러 검사의 문서들을 한 번에 업로드 (최대 10개)
   - 예: 2025-12-02 CBC.pdf, 2025-12-02 Chemistry.jpg, 2025-12-08 cPL.pdf (서로 다른 날짜 OK)
   - 같은 날짜의 검사든, 다른 날짜의 검사든 모두 업로드 가능
2. **병렬 OCR 처리**: 각 파일을 GPT-4o Vision API로 **동시 처리**하여 추출
   - 항목명, 결과값, 단위, 참고치 추출
   - 검사일자, 병원명 자동 추출 (각 파일마다 독립적으로)
3. **날짜별 자동 그룹화**: 추출 완료 후 검사 날짜 + 병원명 기준으로 자동 분류
   - 같은 날짜의 파일들끼리 그룹화
   - 그룹별로 탭 UI 생성

#### Phase 2: 결과 우선 확인 (Preview Before Mapping)
4. **원본 데이터 미리보기**: OCR 추출 결과를 매칭 **전에** 먼저 사용자에게 제시
   - 날짜별 탭으로 구분하여 표시 (예: "2025-12-08 (병원명)")
   - 목적: 숫자 오인식, 누락 등을 조기 발견
   - 사용자가 각 탭에서 OCR 결과를 즉시 수정 가능
   - 같은 날짜에 여러 병원 검사 시 순번 표시 (1, 2, ...)

#### Phase 3: AI 기반 지능형 매핑
5. **날짜 그룹별 병렬 매칭**: 각 날짜 그룹의 OCR 결과를 독립적으로 AI 매칭
   - 컨텍스트 기반 매칭: GPT-4o에게 다음 정보를 전달
     - DB의 전체 `standard_items` 목록
     - 기존 `item_mappings` 매핑 히스토리
     - 해당 그룹의 OCR 결과 (raw_name, value, unit)
   - AI가 각 매칭에 대해 신뢰도 점수(0-100%) 반환

6. **불일치 항목 우선 처리**: 모든 날짜 그룹의 결과를 통합하여 신뢰도 낮은 항목을 상단에 배치

#### Phase 4: 검수 및 학습
7. **사용자 검수 및 승인** (모든 날짜 그룹 통합 화면):
   - 🟢 신뢰도 높음 (≥90%): 원클릭 승인
   - 🟡 신뢰도 보통 (70-89%): 사용자가 확인 후 승인 또는 수정
   - 🔴 신뢰도 낮음 (<70%): 수동 선택 또는 신규 항목 생성
8. **자동 학습**: 사용자가 승인/수정한 매핑을 `item_mappings`에 저장하여 다음번 자동 적용

#### Phase 5: 날짜별 독립 저장
9. **날짜 그룹별 트랜잭션**: 각 날짜 그룹마다 별도의 `test_records` + `test_results` 생성
   - 예: 2025-12-02 검사 → test_record #1 + results, 2025-12-08 검사 → test_record #2 + results
   - 각 그룹은 독립적인 트랜잭션으로 저장 (한 그룹 실패가 다른 그룹에 영향 없음)
   - 각 결과에 출처 파일명, 매칭 신뢰도, 검사 날짜 함께 저장
10. **병렬 저장**: 여러 날짜 그룹을 동시에 저장하여 성능 최적화

#### Phase 6: 시각화
11. **피벗 테이블**: 날짜×항목 매트릭스로 트렌드 시각화
    - 각 날짜 그룹이 독립적인 열로 표시
    - 같은 날짜 여러 병원 검사 시: "2025-12-08 (병원1)", "2025-12-08 (병원2) (2)"
12. **시계열 그래프**: 주요 항목 클릭 시 모달 차트 표시

### 핵심 설계 원칙
- **참고치 스냅샷**: 참고치는 시간에 따라 변하므로, 검사 당시의 값을 결과와 함께 저장
- **동의어 매핑 시스템**: 병원/장비마다 다른 항목명을 표준화 (예: ALP/Alk Phos/ALKP → 단일 표준 항목)
- **유연한 확장성**: 새로운 검사 항목이나 장비 추가 시 사용자 승인 후 자동 매핑

**v2 추가 원칙**:
- **다중 날짜 동시 처리**: 여러 날짜의 검사를 한 번에 업로드하고 날짜별로 자동 그룹화
- **날짜 그룹별 독립 저장**: 각 날짜 그룹은 별도의 검사 기록으로 저장되어 서로 독립적
- **결과 우선 피드백**: 매핑 전에 OCR 결과를 먼저 보여줘 조기 오류 발견
- **AI 기반 점진적 학습**: 사용자 피드백이 쌓일수록 매칭 정확도 향상
- **신뢰도 중심 UX**: 신뢰도가 낮은 항목에 사용자 주의를 집중시켜 효율적 검수
- **병렬 처리 최적화**: OCR, AI 매칭, 저장 모두 병렬로 처리하여 성능 극대화

## 4. 핵심 도메인 규칙 (Business Rules)

### A. 데이터 매핑 및 표준화 (Mapping Strategy) - v2 AI 기반 프로세스

#### A-1. 2단계 매핑 프로세스
OCR 결과는 반드시 '표준 항목'으로 매핑되어야 하며, 이제 **AI가 1차 매칭을 수행**한다.

**단계 1: 기존 매핑 사전 조회** (빠른 경로)
- `item_mappings` 테이블에서 `raw_name`을 검색
- 매칭 발견 시 → 즉시 해당 `standard_item_id` 반환 (신뢰도 100%)

**단계 2: AI 휴리스틱 매칭** (새로운 항목)
- 매핑 사전에 없는 경우, GPT-4o에게 다음 컨텍스트 전달:
  ```
  [System] 당신은 수의학 혈액검사 항목 매칭 전문가입니다.

  [DB의 표준 항목 목록]
  - Creatinine (크레아티닌) / 단위: mg/dL / 카테고리: Chemistry
  - White Blood Cell (백혈구) / 단위: 10^3/μL / 카테고리: CBC
  ... (전체 목록)

  [OCR 추출 결과]
  항목명: "Creatine" (오타 가능성)
  결과값: 1.2
  단위: mg/dL

  [질문] 이 OCR 결과가 어떤 표준 항목과 가장 일치하나요?
  응답 형식: {"standard_item_id": "...", "confidence": 95, "reasoning": "..."}
  ```

- AI 응답 예시:
  ```json
  {
    "standard_item_id": "uuid-of-creatinine",
    "confidence": 95,
    "reasoning": "항목명이 Creatine이지만 단위가 mg/dL이고 결과값 범위가 신장 기능 검사에 부합하여 Creatinine(크레아티닌)으로 판단"
  }
  ```

#### A-2. 신뢰도 기반 사용자 개입
- **🟢 신뢰도 ≥ 90%**: 자동 승인 (사용자에게 확인만 표시)
- **🟡 신뢰도 70~89%**: 주의 표시 (사용자가 승인 또는 수정)
- **🔴 신뢰도 < 70% 또는 매칭 실패**: 필수 사용자 개입 (수동 선택 또는 신규 생성)

#### A-3. 학습 피드백 루프
- 사용자가 AI 제안을 **승인**하면:
  - `item_mappings`에 새 레코드 생성 (mapping_source='user', confidence_score=AI가 제시한 값)
  - 다음번 동일 `raw_name` 발견 시 단계 1에서 즉시 매칭 (신뢰도 100%)

- 사용자가 AI 제안을 **수정**하면:
  - 수정된 매핑을 `item_mappings`에 저장 (mapping_source='manual', confidence_score=100)
  - AI 모델에게 피드백 (향후 fine-tuning 가능)

### B. 참고치(Reference Range) 스냅샷 (Snapshot Rule)
**가장 중요한 규칙**: 참고치는 고정불변이 아니다.

**핵심 원칙**:
- 검사 결과 저장 시, **그 당시 검사지에 적힌 참고치(Min/Max)**를 결과 데이터와 함께 저장해야 한다.
- **장비별 참고치 차이**: 같은 항목(예: Creatinine)이라도 검사 장비에 따라 참고치가 다르다.
  - 예: Hitachi 장비 → 0~10
  - 예: IDEXX 장비 → 0~<9 (9 미만)
  - 예: Fuji 장비 → 0.5~1.8
- **각 결과마다 독립적인 참고치**: `test_results` 테이블의 각 레코드는 자체 `ref_min`, `ref_max`, `ref_text`를 가진다.
- **절대 글로벌 참고치 사용 금지**: `standard_items` 테이블에 "기본 참고치"를 저장하더라도, 실제 판정은 **해당 검사 당시의 참고치**로만 해야 한다.

**판정 로직**:
- `Value`가 `Ref_Min`보다 낮으면 → `Low(🔵)`
- `Value`가 `Ref_Max`보다 높으면 → `High(🔴)`
- `Ref_Min ≤ Value ≤ Ref_Max` → `Normal(🟢)`
- 참고치가 없는 경우 → `Unknown` (아이콘 표시 안 함)

**UI 표시 규칙**:
1. **피벗 테이블 헤더**: 항목명 아래에 "여러 참고치 적용됨" 또는 "Multiple ref ranges" 표시
2. **Tooltip(마우스 오버)**: 각 셀에 마우스를 올리면 풍선 팝업으로 표시
   ```
   검사일: 2025-01-15
   결과값: 1.2 mg/dL
   참고치: 0.5-1.8 (Hitachi)
   상태: Normal ✓
   ```
3. **참고치 변경 표시**: 같은 항목이지만 이전 검사와 참고치가 바뀐 경우 ⚠️ 아이콘 표시
   - 예: 2024-12-01의 Creatinine 참고치가 0-10이었는데, 2025-01-15에는 0.5-1.8로 변경됨
   - Tooltip에 "참고치 변경됨 (이전: 0-10)" 메시지 추가

### C. 다중 파일 및 다중 날짜 처리 규칙 (Multi-File & Multi-Date Handling)
한 번의 업로드에 여러 문서가 있을 때의 처리 규칙 (v2: 여러 날짜의 검사 동시 지원):

**규칙 1: 날짜별 자동 그룹화**
- 업로드된 모든 파일에서 `검사 날짜`와 `병원명`을 추출
- **같은 날짜 + 같은 병원**의 문서들을 하나의 그룹으로 자동 분류
- 여러 날짜의 검사가 섞여 있어도 OK (예: 2025-12-02, 2025-12-08 동시 업로드 가능)
- 같은 날짜에 여러 병원에서 검사한 경우 순번 부여 (1, 2, 3...)

**규칙 2: 날짜별 탭 UI**
- Preview 페이지에서 날짜별 탭으로 구분하여 표시
- 탭 제목 형식: `2025-12-08 (병원명)` 또는 `2025-12-08 (병원명) (2)` (같은 날짜 2번째)
- 각 탭에서 해당 날짜의 OCR 결과를 독립적으로 확인 및 수정 가능

**규칙 3: 날짜 그룹별 독립 처리**
- 각 날짜 그룹은 별도의 `test_records`로 저장됨 (독립적인 검사 기록)
- AI 매칭도 날짜 그룹별로 병렬 처리
- 저장 시 각 날짜 그룹에 대해 별도의 트랜잭션 실행

**규칙 4: 중복 항목 처리 (같은 날짜 그룹 내에서)**
- 같은 날짜 그룹 내에서 **같은 항목**이 여러 파일에 있는 경우:
  - 값이 동일하면 → 1개만 저장 (자동 병합)
  - 값이 다르면 → 경고 표시 및 사용자 선택 유도

**규칙 5: 파일별 추적성 유지**
- 각 `test_results` 레코드에 `source_filename` 저장
- 나중에 "이 결과가 어느 파일에서 왔는지" 확인 가능

**규칙 6: 트랜잭션 단위**
- 각 날짜 그룹은 독립적인 트랜잭션으로 저장
- 한 그룹의 저장 실패가 다른 그룹에 영향을 주지 않음
- [모두 저장] 버튼 클릭 시 모든 날짜 그룹을 병렬로 저장

### D. OCR 결과 우선 확인 규칙 (Preview Before Mapping)
**중요**: 매핑 프로세스를 거치기 **전에** 먼저 사용자에게 OCR 원본 결과를 보여줘야 한다.

**이유**:
1. OCR 오류를 조기 발견 (예: "1.2"를 "12"로 인식)
2. 사용자가 AI 매칭의 입력값을 미리 확인하여 신뢰도 향상
3. 불필요한 매핑 작업 방지 (잘못 읽힌 데이터로 매칭하는 것 방지)

**프로세스**:
1. OCR 추출 완료 → 즉시 "원본 데이터 테이블" 표시
2. 사용자가 각 셀을 클릭하여 수정 가능
3. [다음: AI 매칭 시작] 버튼 클릭 → 수정된 데이터로 매칭 수행

### E. 미모 주요 관리 항목 (Priority Items)
소스 데이터 분석 결과, 다음 항목들은 UI에서 강조해서 보여줘야 한다.
- **Pancreas (췌장)**: `Lipase`, `cPL` (미모의 경우 cPL 변동폭이 크므로 그래프 시각화 필수)
- **Kidney (신장)**: `BUN`, `Creatinine`, `SDMA`, `Phosphorus`
- **Liver (간)**: `ALT`, `ALKP`, `GGT`
- **CBC**: `HCT`, `PLT` (혈소판 수치 변동 주의)

## 5. 기술 스택
- **Frontend**: Next.js 14, Tailwind CSS, Shadcn/ui (Data Table 필수)
  - **v2 추가**: react-dropzone (다중 파일 업로드)
- **Backend/DB**: Supabase (PostgreSQL)
  - **v2 추가**: JSONB 타입 활용 (업로드 파일 메타데이터 저장)
- **AI/OCR**: GPT-4o (Vision API) - 복잡한 표 인식에 최적화
  - **v2 추가**: GPT-4o Chat Completion API (지능형 매칭용)
  - 프롬프트 엔지니어링: 컨텍스트 기반 매칭, 신뢰도 점수 반환

## 6. 코딩 컨벤션

### 상태 판정 및 시각화
- **상태 아이콘**:
  - 🔴 High (수치 > Max)
  - 🔵 Low (수치 < Min)
  - 🟢 Normal (Min <= 수치 <= Max)
  - 검사지에 참고치가 없는 경우(예: `mOsm`)는 아이콘을 표시하지 않는다.

### AI 매칭 신뢰도 시각화
- **신뢰도 배지**:
  - 🟢 ≥ 90%: "높음" (녹색 배지)
  - 🟡 70-89%: "보통" (노란색 배지)
  - 🔴 < 70%: "낮음" (빨간색 배지)
- **매칭 소스 표시**:
  - 🤖 AI 자동 매칭
  - ✓ 사용자 승인
  - ✏️ 사용자 수동 입력

### UI 구현 원칙
- **반응형 테이블**: 모바일에서도 가로 스크롤로 전체 데이터 접근 가능
- **피벗 테이블 레이아웃**: 가로축(날짜/검사차수), 세로축(검사 항목)
- **하이라이트 규칙**: High/Low 상태인 셀은 배경색 변경 (붉은색/파란색)

### v2 추가 UI 규칙
- **다중 파일 업로드 영역**:
  - 드래그앤드롭 시 배경색 변경 (파란색 테두리)
  - 업로드된 파일 썸네일은 Grid 레이아웃 (모바일: 2열, 데스크톱: 4열)
- **매핑 테이블 정렬**:
  - 신뢰도 낮은 항목 → 상단 우선 배치 (빨간색 → 노란색 → 녹색 순)
  - 같은 신뢰도 내에서는 알파벳 순 정렬
- **프로그레스 피드백**:
  - OCR 분석 중: 각 파일별 진행률 표시 ("파일 2/5 분석 중...")
  - AI 매칭 중: 전체 진행률 표시 ("30개 항목 중 25개 매칭 완료")
- **불일치 경고 모달**:
  - 중복 항목 발견 시: 2개 값을 나란히 비교 표시, 라디오 버튼으로 선택
  - 검사 날짜 불일치 시: 각 파일별 추출된 날짜 표시, 올바른 날짜 선택 유도

### 장비별 참고치 표시 규칙
- **피벗 테이블 헤더**:
  - 항목명 아래 작은 회색 글씨로 "여러 참고치 적용됨" 표시
  - 예:
    ```
    Creatinine
    (크레아티닌)
    여러 참고치 적용됨
    ```
- **Tooltip (마우스 오버)**:
  - 각 데이터 셀에 마우스 올리면 풍선 팝업 표시
  - 필수 포함 정보: 검사일, 결과값, 참고치, 상태, 장비명(있는 경우)
  - 참고치 변경 시 추가 정보: "⚠️ 참고치 변경됨 (이전: 0-10)"
- **시계열 그래프**:
  - 참고치 범위가 검사마다 다를 수 있으므로, 가장 최근 검사의 참고치를 기본 밴드로 표시
  - 참고치 변경 지점에 수직 점선 표시
  - 그래프 하단 범례: "참고치: 검사마다 상이함 (자세한 내용은 각 데이터 포인트 클릭)"

## 7. API 엔드포인트 명세 (v2 업데이트)

### POST /api/ocr-batch
**목적**: 여러 파일을 한 번에 OCR 처리

**요청**:
```typescript
// FormData
files: File[] // 최대 10개
```

**응답**:
```typescript
{
  success: boolean
  data: {
    test_date: string // 첫 번째 파일에서 추출
    hospital_name: string
    batch_id: string // 배치 식별자
    results: Array<{
      filename: string
      items: OcrResult[]
      metadata: {
        pages: number
        processingTime: number
      }
    }>
    warnings: Array<{
      type: 'date_mismatch' | 'duplicate_item'
      message: string
      files: string[]
    }>
  }
}
```

### POST /api/ai-mapping
**목적**: OCR 결과를 AI로 자동 매핑

**요청**:
```typescript
{
  batch_id: string
  ocr_results: OcrResult[]
}
```

**응답**:
```typescript
{
  success: boolean
  data: Array<{
    ocr_item: OcrResult
    suggested_mapping: {
      standard_item_id: string
      standard_item_name: string
      display_name_ko: string
      confidence: number // 0-100
      reasoning: string
    } | null
  }>
}
```

### POST /api/test-results-batch
**목적**: 검수 완료된 데이터 일괄 저장

**요청**:
```typescript
{
  batch_id: string
  test_date: string
  hospital_name: string
  uploaded_files: Array<{filename: string, size: number, type: string}>
  results: Array<{
    standard_item_id: string
    value: number
    unit: string
    ref_min: number | null
    ref_max: number | null
    ref_text: string | null
    source_filename: string
    ocr_raw_name: string
    mapping_confidence: number
    user_verified: boolean
  }>
}
```

**응답**:
```typescript
{
  success: boolean
  data: {
    record_id: string
    saved_count: number
  }
}
```

## 8. 개발 명령어 (Development Commands)

### 개발 서버
```bash
npm run dev          # http://localhost:3000에서 개발 서버 실행
npm run build        # 프로덕션 빌드
npm start            # 프로덕션 서버 실행
```

### 코드 품질
```bash
npm run lint         # ESLint 실행
```

### Supabase 설정
Supabase 프로젝트 설정은 **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** 참고

데이터베이스 마이그레이션:
1. Supabase Dashboard → SQL Editor
2. `supabase/migrations/001_initial_schema.sql` 내용 복사 및 실행

또는 CLI 사용:
```bash
npx supabase db push              # 마이그레이션 적용
npx supabase gen types typescript # TypeScript 타입 생성
```
