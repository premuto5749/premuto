# 일일 기록 복사/붙여넣기 (Copy & Paste Logs)

## 개요

일일 기록의 특정 항목들을 선택하여 다른 날짜에 복제하는 기능.
매일 반복되는 식사/약 패턴을 빠르게 기록할 수 있다.

## FR-1: 다중 선택 모드

타임라인에서 여러 기록을 선택할 수 있는 모드.

### 진입/종료
- 타임라인 상단에 "선택" 버튼 추가
- 클릭 시 각 기록 항목에 체크박스 표시
- "취소" 버튼으로 선택 모드 해제

### 선택 대상 카테고리
| 카테고리 | 선택 가능 | 이유 |
|---------|----------|------|
| meal | O | 반복 급여 패턴 |
| water | O | 반복 급여 패턴 |
| snack | O | 반복 급여 패턴 |
| medicine | O | 반복 급여 패턴 |
| poop | O | 배변 기록 복사 |
| pee | O | 배뇨 기록 복사 |
| breathing | O | 호흡수 기록 복사 |
| weight | X | 체중은 날짜별 고유값. 복사 시 carry-forward 로직과 충돌 가능 |
| walk | X | walk_end_at, walk_id 등 복잡한 상태. 복사 의미 불분명 |
| vomit | X | 건강 이벤트는 복사 대상이 아님 (실제 발생 시에만 기록) |
| note | X | memo 필드에만 의미가 있으나 memo는 복사 대상에서 제외 |

### AC (Acceptance Criteria)

**성공 시나리오**:
- "선택" 버튼 클릭 → 선택 가능 카테고리의 타임라인 항목에만 체크박스 표시
- 체크박스 클릭 → 선택/해제 토글. 하단에 "N개 선택됨" + "복사" 버튼 표시
- "전체 선택" 체크박스로 현재 날짜 선택 가능 기록 모두 선택/해제

**실패/에러 시나리오**:
- 선택 가능 기록이 0개인 날짜 → "선택" 버튼 비활성화 (disabled)
- 선택 모드에서 날짜 변경 → 선택 모드 자동 해제, 선택 초기화

**엣지케이스**:
- 삭제된(soft-deleted) 기록은 선택 목록에 표시되지 않음
- weight/walk/vomit/note 카테고리는 체크박스 없이 표시 (선택 불가 상태)

---

## FR-2: 복사 (클립보드에 저장)

선택된 항목들의 핵심 데이터를 앱 내 클립보드에 저장.

### 복사 필드
| 필드 | 포함 | 비고 |
|------|------|------|
| category | O | 카테고리 |
| pet_id | O | 원본의 반려동물 ID 보존 |
| amount | O | 양 |
| leftover_amount | O | 남긴양 (meal) |
| unit | O | 단위 |
| medicine_name | O | 약 이름 |
| snack_name | O | 간식 이름 |
| calories | O | 칼로리 (snack) |
| input_source | O | preset/manual |
| logged_at | O | 시간(HH:mm)만 추출하여 보존 |
| photo_urls | X | 제외 |
| memo | X | 제외 |
| tags | X | 제외 |
| walk_id | X | 제외 |

### 저장 방식
- React state (`clipboardLogs`) + `sessionStorage`로 영속화
- **Storage key**: `premuto_copy_clipboard`
- **저장 형식**: 복사 필드 테이블 기준의 필드만 포함한 배열 (전체 DailyLog 아님)
  ```ts
  interface ClipboardLogItem {
    category: LogCategory
    pet_id: string | null
    amount: number | null
    leftover_amount: number | null
    unit: string | null
    medicine_name: string | null
    snack_name: string | null
    calories: number | null
    input_source: 'preset' | 'manual'
    time: string  // "HH:mm" 형식 (logged_at에서 추출)
  }
  ```
- 탭 닫으면 초기화 (의도적: 오래된 클립보드 방지)

### AC (Acceptance Criteria)

**성공 시나리오**:
- 3개 항목 선택 → "복사" 클릭 → 토스트 "3개 기록이 복사되었습니다"
- 선택 모드 자동 해제
- 화면 하단에 플로팅 배지: "📋 3개 복사됨" (다른 날짜로 이동해도 유지)

**실패/에러 시나리오**:
- 0개 선택 상태에서 "복사" 버튼 → 비활성화 (disabled)

**엣지케이스**:
- 이미 복사된 항목이 있는 상태에서 새로 복사 → 기존 클립보드 덮어쓰기
- 복사 후 원본 기록이 삭제되어도 클립보드에는 영향 없음 (값 복사)
- 여러 반려동물의 기록을 섞어서 복사 → pet_id가 각각 보존됨

---

## FR-3: 붙여넣기 (다른 날짜에 생성)

클립보드의 항목들을 현재 선택된 날짜에 일괄 생성.

### 시간 처리
- 대상 날짜 + 원본의 시:분을 결합하되, **반드시 KST(+09:00) 오프셋 포함**
- 예: 원본 time `08:30` + 대상 날짜 `2026-03-15` → `2026-03-15T08:30:00+09:00`
- 기존 POST API가 `logged_at`을 ISO 문자열로 받으므로 KST 오프셋 필수

### API 처리
- 기존 `POST /api/daily-logs`를 항목별 순차 호출
- **실패 시에도 나머지 항목은 계속 시도** (중단하지 않음)
- 전체 완료 후 성공/실패 카운트를 집계하여 토스트 표시
- (향후 배치 API 추가 시 한번에 처리 가능)

### pet_id 처리
- 클립보드에 보존된 원본 pet_id를 그대로 사용
- 원본 pet이 삭제된 경우 → 현재 선택된 pet_id로 대체

### AC (Acceptance Criteria)

**성공 시나리오**:
- 날짜 이동 후 플로팅 배지의 "붙여넣기" 클릭
- 확인 다이얼로그: "3월 15일에 3개 기록을 붙여넣을까요?" + 항목 미리보기 목록
- "확인" → 순차 POST 호출 → 성공 토스트 "3개 기록이 추가되었습니다"
- 타임라인 새로고침 → 새로 생성된 항목 표시
- 클립보드 유지 (다른 날짜에도 연속 붙여넣기 가능)

**실패/에러 시나리오**:
- API 일부 실패 시 → 나머지 계속 시도 → "2개 성공, 1개 실패" 토스트. 성공한 것은 유지.
- 전체 네트워크 에러 → "기록 추가에 실패했습니다. 다시 시도해주세요." 토스트

**엣지케이스**:
- 같은 날짜에 두 번 붙여넣기 → 중복 기록 생성 허용 (사용자 책임, 삭제 가능)
- 미래 날짜에 붙여넣기 → 허용 (기존 POST API가 날짜 제한 없음)
- 클립보드 비우기: 플로팅 배지의 X 버튼으로 클립보드 초기화
- 원본 pet_id가 삭제됨 → 현재 선택된 반려동물의 pet_id로 대체하여 기록

---

## 변경 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `app/daily-log/page.tsx` | 선택 모드 상태, 클립보드 상태 관리 |
| `components/daily-log/Timeline.tsx` | 선택 모드 시 체크박스 렌더링 (선택 가능 카테고리만) |
| `components/daily-log/SelectionActionBar.tsx` | **신규** - 선택 모드 하단 액션바 ("N개 선택됨" + "복사" 버튼) |
| `components/daily-log/ClipboardFloatingBadge.tsx` | **신규** - 플로팅 배지 ("📋 N개 복사됨" + "붙여넣기" + "X" 버튼) |
| `components/daily-log/PasteConfirmDialog.tsx` | **신규** - 붙여넣기 확인 다이얼로그 (항목 미리보기) |

## 구현 순서

1. Timeline.tsx에 선택 모드 + 체크박스 추가 (카테고리별 선택 가능 여부 적용)
2. SelectionActionBar 컴포넌트 (선택 모드 하단 액션바)
3. ClipboardFloatingBadge 컴포넌트 (플로팅 배지)
4. PasteConfirmDialog 컴포넌트
5. page.tsx에 상태 관리 통합 + sessionStorage 연동
