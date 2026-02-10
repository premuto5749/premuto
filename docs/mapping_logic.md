# 검사항목 매핑 로직

검사 결과 입력 시 항목명을 정규 항목으로 자동 매핑하는 로직.
두 곳에서 사용:
1. **OCR 직후** — 검사 결과지 인식 후 자동 매핑
2. **Unmapped 정리** — 매핑 실패 항목을 나중에 수동/반자동 처리

참조 데이터: `standard_items_master.json` v4.3 (정규항목 129개, alias 107개 = 236개 이름 인식)

---

## 전체 플로우

```
입력: 검사지 항목명 (예: "Hct(ABL80F)")
      ↓
Step 0: 가비지 필터링 → 항목이 아닌 것 버림
      ↓
Step 1: 정규 항목 exact match → 매칭되면 저장
      ↓ 실패
Step 2: Alias 매칭 → 매칭되면 canonical로 저장
      ↓ 실패
Step 3: AI 판단 → match(기존 변형) 또는 new(신규)
      ↓ 모두 실패 또는 confidence 낮음
Unmapped로 저장 → 사용자가 나중에 매핑 메뉴에서 처리
```

---

## Step 0: 가비지 필터링

OCR에서 항목이 아닌 값이 잘못 인식되는 패턴. 매핑 시도 전에 먼저 걸러낸다.

```
필터링 대상:

1. 숫자/범위 패턴
   "< 0.25", "0.26 - 0.5", "> 2.0"
   → CRP 반정량 결과값 범위 등. 항목이 아닌 값.
   → 정규식: /^[<>≤≥]?\s*\d/ 또는 /^\d+\.?\d*\s*[-~]\s*\d/

2. 카테고리 라벨
   "기타", "결과", "항목", "단위", "참고치"
   → 표 헤더나 분류명이 OCR된 것

3. 단위 잘림 자동 보정
   "mmH" → "mmHg"
   "mg/d" → "mg/dL"
   → 단위 필드에서 보정. 항목명에 영향 없음.

4. 항목명 잘림 감지
   "CBASE(ECF,ST)(ABL80" → 끝이 잘린 경우
   → 닫히지 않은 괄호 감지 시 AI 판단(Step 3)에 정보 전달
```

---

## 문자열 정규화 (normalizeForMatching)

Step 1, 2에서 비교 전 입력명과 캐시 키 모두에 적용:

```
1. NFKC 유니코드 정규화 (전각→반각: Ｋ＋ → K+)
2. 스마트 따옴표 → 일반 따옴표 (' ' → ')
3. 제로폭 문자 제거 (ZWSP, ZWNJ, ZWJ, BOM)
4. 대시/하이픈 통일 (en-dash, em-dash, 수학 마이너스 → -)
5. 소문자 변환
```

OCR 출력의 특수문자 변형 (인코딩 차이, 장비별 출력 차이)을 통일하여
alias에 등록된 문자열과 정확히 매칭되도록 함.

---

## Step 1: 정규 항목 매칭

```
입력: normalizeForMatching(input_name)
비교: standard_items_master.json → test_items[].name (정규화됨)
방법: 정규화 후 exact match

if match:
    item_id = matched_item.item_id
    → 검사 결과 저장 (source_name = input_name)
    → 끝
else:
    → Step 2로
```

---

## Step 2: Alias 매칭

```
입력: normalizeForMatching(input_name)
비교: standard_items_master.json → aliases[].alias (정규화됨)
방법: 정규화 후 exact match

if match:
    canonical_name = matched_alias.canonical
    source_hint = matched_alias.source_hint
    item_id = test_items에서 canonical_name으로 조회
    → 검사 결과 저장 (source_name = input_name, source_hint = source_hint)
    → 끝
else:
    → Step 3로
```

---

## Step 3: AI 판단

Step 1, 2 모두 실패한 항목을 AI에게 판단 요청.

### AI 프롬프트 템플릿

```
당신은 수의학 검사 항목 전문가입니다.
다음 검사 항목명이 기존 정규 항목 중 하나와 같은 검사인지,
아니면 신규 항목인지 판단해주세요.

## 입력
- 항목명: {input_name}
- 단위: {input_unit}
- 검사지 출처 (있다면): {source_hospital}

## 판단 기준
1. 측정 대상이 같은가?
2. 단위가 호환 가능한가?
3. 임상적으로 같은 트렌드로 볼 수 있는가?

## 기존 정규 항목 목록
{canonical_list_with_units}

## 응답 형식 (JSON)

기존 항목 변형인 경우:
{
  "decision": "match",
  "canonical_name": "매칭되는 정규 항목명",
  "confidence": 0.95,
  "reason": "판단 근거",
  "source_hint": "장비/방법 힌트"
}

신규 항목인 경우:
{
  "decision": "new",
  "recommended_name": "추천 정규명",
  "display_name_ko": "한글 표시명",
  "unit": "단위",
  "exam_type": "Vital|CBC|Chemistry|Special|Blood Gas|Coagulation|뇨검사|안과검사|Echo|기타",
  "organ_tags": ["장기태그1", "장기태그2"],
  "confidence": 0.9,
  "reason": "판단 근거"
}

※ description_common/high/low는 매핑 단계에서 생성하지 않음 (비용/속도 절감).
   관리자가 표준항목 관리 페이지(/standard-items)에서 별도 입력.
```

### AI 판단 후 처리

```
if decision == "match":
    1. canonical_name으로 item_id 조회
    2. 검사 결과를 해당 item_id로 저장
    3. aliases에 새 alias 자동 등록:
       { alias: input_name, canonical: canonical_name, source_hint: source_hint }
    4. 다음에 같은 표기가 들어오면 Step 2에서 바로 매칭됨

if decision == "new":
    1. test_items에 신규 정규 항목 추가
    2. sort_orders 4가지 체계에 자동 배치:
       - by_exam_type: exam_type 카테고리 끝에 추가
       - by_organ: organ_tags 각각의 장기 그룹에 추가
       - by_clinical_priority: 가장 가까운 우선순위 그룹 끝에 추가
       - by_panel: 해당하는 패널에 추가 (없으면 미배정)
    3. 원본 입력명 ≠ recommended_name이면 alias도 등록

if confidence < 0.7:
    → Unmapped로 저장. 사용자가 수동 처리.
```

---

## 검사 결과 기록 저장 구조

```json
{
  "record_id": "REC_20250115_001",
  "item_id": "ITEM_017",
  "item_name": "HCT",
  "value": 42.5,
  "unit": "%",
  "date": "2025-01-15",
  "source_name": "Hct(ABL80F)",
  "source_hint": "ABL80F",
  "hospital": "A동물병원",
  "note": ""
}
```

- `item_id` + `item_name`: 정규 항목 → 트렌드 차트 조회 키
- `source_name`: 검사지 원본 표기 (그대로 보존)
- `source_hint`: 장비/방법 힌트 (alias에서 가져오거나 AI가 판단)
- `hospital`: 검사 병원

---

## Unmapped 정리 메뉴 동작

OCR 시점에 매핑 실패한 항목 + AI confidence 낮은 항목이 Unmapped로 쌓인다.
사용자가 나중에 매핑 메뉴에서 처리.

```
1. 미매핑 항목 목록 표시
   - Unmapped 카테고리의 항목들
   - 각 항목의 name, unit, 발생 횟수, 최근 날짜

2. 처리 옵션
   A) 기존 정규 항목에 매핑
      - 드롭다운에서 정규 항목 선택
      - 확정 시 aliases에 자동 추가
      - 이후 같은 표기는 Step 2에서 자동 매칭
   
   B) 신규 정규 항목으로 등록
      - name, display_name_ko, unit, exam_type, organ_tags 입력
      - test_items에 추가 + sort_orders에 배치
      - description은 나중에 관리 페이지에서 별도 입력
   
   C) 가비지로 삭제
      - 항목이 아닌 OCR 오류 (범위값, 라벨 등)
      - 삭제 확인 후 제거

3. 일괄 처리
   - 같은 이름의 중복 Unmapped → 하나로 합치고 매핑
   - AI 일괄 판단 요청 → 결과 검토 후 확정
```

---

## 장비별 항목 분리 (Blood Gas Overlay)

같은 검사 대상이지만 **측정 장비/방법이 달라 값이 다를 수 있는 항목**은 별도 표준항목으로 관리한다.

### 배경

CBC 장비의 HCT(임피던스)와 혈액가스 장비의 HCT(전도도)는 1~3% 차이가 나며,
Chemistry의 혈청 전해질(간접법)과 혈액가스의 전혈 전해질(직접법)도 값이 다르다.
같은 항목으로 합치면 하나가 버려지므로, 별도 항목으로 분리하여 두 값 모두 보존.

### 분리 대상 (v4.3 추가)

| CBC/Chemistry 항목 | Blood Gas 항목 | 차이 원인 |
|---|---|---|
| HCT (%) | HCT(BG) (%) | 임피던스 vs 전도도 |
| Na (mmol/L) | Na(BG) (mmol/L) | 간접 ISE vs 직접 ISE |
| K (mmol/L) | K(BG) (mmol/L) | 혈청 vs 전혈 |
| Calcium (mg/dL) | Ca(BG) (mmol/L) | 총칼슘 vs 이온화칼슘 |
| Cl (mmol/L) | Cl(BG) (mmol/L) | 간접 ISE vs 직접 ISE |
| Glucose (mg/dL) | Glucose(BG) (mg/dL) | 혈청 vs 전혈 (10~15% 차이) |
| Lactate (mmol/L) | Lactate(BG) (mmol/L) | 별도 장비 vs 혈액가스 내장 |
| HGB (g/dL) | tHb(BG) (g/dL) | 시안메트Hb법 vs CO-oximetry |
| — | Ca(7.4)(BG) (mmol/L) | pH 7.4 보정 이온화칼슘 (BG 전용) |

### 매핑 예시

```
검사지: 서울대 동물병원 GEM5000 결과
  "HCT (GEM)" → Step 2 alias 매칭 → HCT(BG) (Blood Gas)
  "Na (GEM)"  → Step 2 alias 매칭 → Na(BG) (Blood Gas)

검사지: 서울대 동물병원 CBC 결과
  "PCV-"      → Step 3 AI 매칭 → HCT (CBC)
  "Hb-"       → Step 2 alias 매칭 → HGB (CBC)
```

같은 날 같은 병원이지만 장비별로 다른 표준항목에 매핑되어, 대시보드에서 별도 행으로 표시됨.

### 등록된 별칭 (GEM 장비)

각 항목에 공백 유무 2가지 변형 등록:
- `HCT (GEM)` / `HCT(GEM)` → `HCT(BG)`
- `Na (GEM)` / `Na(GEM)` → `Na(BG)`
- `K (GEM)` / `K(GEM)` → `K(BG)`
- `Ca (GEM)` / `Ca(GEM)` → `Ca(BG)`
- `Cl (GEM)` / `Cl(GEM)` → `Cl(BG)`
- `GLU (GEM)` / `GLU(GEM)` → `Glucose(BG)`
- `LAC (GEM)` / `LAC(GEM)` → `Lactate(BG)`
- `tHb (GEM)` / `tHb(GEM)` → `tHb(BG)`
- `Ca(7.4) (GEM)` / `Ca(7.4)(GEM)` → `Ca(7.4)(BG)`

---

## 사용 컨텍스트별 요약

### OCR 직후 (자동, 실시간)
```
Step 0 → Step 1 → Step 2 → Step 3(AI) → 성공 or Unmapped
전부 자동. 사용자 개입 없음.
```

### Unmapped 정리 (수동, 비동기)
```
Unmapped 목록 → 사용자 선택 → 매핑/신규등록/삭제
AI 보조 가능하지만 최종 확정은 사용자.
```
