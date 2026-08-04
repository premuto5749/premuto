# 건강 이벤트 기록 + 특이사항 태그 시스템

## Context

현재 데일리 로그는 9개 카테고리(식사, 음수, 간식, 약, 배변, 배뇨, 호흡수, 체중, 산책)를 지원하며, 각 기록에 자유 텍스트 `memo` 필드가 있음. 하지만 "혈변", "구토", "발작" 같은 건강 이벤트를 **구조화된 데이터**로 추적하기 어려움.

### 참고 앱 분석

증상 체크 앱(스크린샷 17장)에서 다음 분류 체계를 참조:
- 배설(대변/소변): 색상, 경도, 횟수, 냄새
- 섭취(식사/음수): 식사량 변화, 음수량 변화
- 구토: 색상(7종), 횟수
- 신체부위별 증상: 귀, 얼굴, 눈, 발바닥, 관절, 피부/모질, 구강/치아, 호흡기, 생식기/항문, 배(복부), 등(허리)
- 전신: 비만도(체형 5단계), 행동이상(8종)

### 설계 원칙

- **데일리 로그 확장**: 별도 서비스가 아닌 기존 데일리 로그 시스템에 자연스럽게 통합
- **구조화된 태그**: 자유 텍스트 메모와 별도로, 필터링/통계에 활용 가능한 구조화 데이터
- **순차적 오픈**: 릴리즈마다 1~2개 기능씩 추가하여 사용자에게 점진적으로 제공

---

## 전체 로드맵

### Phase 1: 배변 태그 + 구토 + 기타 카테고리 ← **1차 구현 대상**
- 배변(💩)에 색상/경도 태그 추가
- 구토(🤮) 신규 카테고리 + 색상 태그
- 기타(📝) 신규 카테고리: 빠른 메모 기록용 (카테고리에 안 맞는 일상 기록)

### Phase 2: 배뇨 태그 + 기침 카테고리
- 배뇨(🚽)에 색상/기타 태그 추가
- 기침(💨) 신규 카테고리 + 유형 태그

### Phase 3: 식사/음수 태그 + 목욕/발작 카테고리
- 식사(🍚)에 상태 태그 (식욕저하/식사거부/강제급여/과식)
- 음수(💧)에 상태 태그 (평소보다많음/적음/안마심)
- 목욕(🛁) 원터치 카테고리
- 발작(⚡) 카테고리 + 지속시간(초)

### Phase 4: 증상 기록 카테고리
- 증상(🩺) 신규 카테고리: 신체부위 선택 → 증상 태그 선택 → 사진 + 메모
- 신체부위: 눈, 귀, 구강, 발/관절, 피부/털, 호흡, 행동, 복부/등, 생식기/항문

### Phase 5: 진료 기록 (Vet Visit Notes)
- 별도 테이블 `vet_visits`로 관리
- 진료일, 병원, 진단, 처방, 다음 예약, 사진, 혈검 연결
- 데일리 타임라인에 🏥 카드로 통합 표시
- 별도 진료 이력 페이지

---

## 공통 설계: 태그 시스템

### DB 컬럼

`daily_logs` 테이블에 `tags JSONB` 컬럼 추가:

```sql
ALTER TABLE daily_logs ADD COLUMN tags JSONB DEFAULT NULL;
```

**저장 형식**:
```json
// 배변 예시
{ "color": "red", "consistency": "soft" }

// 구토 예시
{ "color": "yellow" }

// 기침 예시 (Phase 2)
{ "type": "dry" }

// 증상 예시 (Phase 4)
{ "body_part": "eye", "symptoms": ["redness", "discharge"] }
```

### 태그 정의 상수 (`lib/tag-options.ts` 신규)

프론트엔드에서 사용할 태그 옵션들을 중앙 관리:

```typescript
export const POOP_COLOR_OPTIONS = [
  { value: 'chocolate', label: '초콜릿(갈색)', color: '#8B4513' },
  { value: 'gray', label: '회색', color: '#9CA3AF' },
  { value: 'black', label: '검은색', color: '#1F2937' },
  { value: 'red', label: '붉은색', color: '#EF4444' },
  { value: 'green', label: '초록색', color: '#22C55E' },
  { value: 'yellow', label: '노란색', color: '#EAB308' },
] as const

export const POOP_CONSISTENCY_OPTIONS = [
  { value: 'watery', label: '설사(물)', icon: '💦' },
  { value: 'soft', label: '묽음', icon: '〰️' },
  { value: 'mushy', label: '부드러움', icon: '🔘' },
  { value: 'normal', label: '보통', icon: '✅' },
  { value: 'hard', label: '딱딱함', icon: '🪨' },
  { value: 'dry', label: '건조', icon: '🏜️' },
] as const

export const VOMIT_COLOR_OPTIONS = [
  { value: 'clear', label: '투명(무색)', color: '#E5E7EB' },
  { value: 'food', label: '음식물', color: '#D97706' },
  { value: 'white_foam', label: '흰색(거품)', color: '#F3F4F6' },
  { value: 'yellow', label: '노란색(담즙)', color: '#FACC15' },
  { value: 'green', label: '초록색', color: '#22C55E' },
  { value: 'brown', label: '갈색', color: '#92400E' },
  { value: 'red', label: '붉은색(혈액)', color: '#EF4444' },
] as const
```

### UI 패턴: 태그 선택 칩

모든 태그는 **선택형 칩(Chip)** UI로 통일:
- 단일 선택 (색상, 경도) 또는 다중 선택 (증상)
- 선택 시 시각적 하이라이트 (배경색 변경)
- 선택 안 해도 기록 저장 가능 (태그는 항상 선택사항)

### UI 패턴: 기준 보기 바텀 시트

각 태그 섹션 제목 옆에 **"ℹ️ 기준 보기"** 버튼을 배치.
탭하면 shadcn `Sheet` (바텀 시트)가 올라와서 **참고 이미지 + 설명 텍스트**를 함께 표시.

**구현**:
- 참고 이미지: `public/reference/` 디렉토리에 저장 (빌드 시 포함, CDN 캐시)
- 태그 옵션에 `description` 필드 추가: 건강 의미 설명 텍스트
- `TagReferenceSheet.tsx` 컴포넌트: Sheet 안에 스크롤 가능한 리스트로 이미지+텍스트 표시

**참고 이미지 목록** (Phase 1):
| 카테고리 | 참조 | 이미지 |
|---------|------|--------|
| 배변 경도 | Fecal Scoring Chart (1~7점) | 점수별 개별 이미지 7장 또는 전체 차트 1장 |
| 배변 색상 | 색상별 건강 의미 | 색상 스와치 + 텍스트 설명 (이미지 없이 가능) |
| 구토 색상 | 색상별 건강 의미 | 색상 스와치 + 텍스트 설명 (이미지 없이 가능) |

**바텀 시트 UI**:
```
┌────────────────────────────────────┐
│  ━━━━  (드래그 핸들)               │
│                                    │
│  💩 대변 경도 기준표                │
│                                    │
│  ┌──────────────────────────────┐  │
│  │ Score 1 — 건조               │  │
│  │ ┌──────┐ 매우 딱딱하고 건조.  │  │
│  │ │ 📷   │ 개별 알갱이 형태.   │  │
│  │ │      │ 배출 시 힘듬.       │  │
│  │ └──────┘                     │  │
│  ├──────────────────────────────┤  │
│  │ Score 2 — 딱딱함 ✅ 이상적   │  │
│  │ ┌──────┐ 단단하지만 유연.    │  │
│  │ │ 📷   │ 분절된 형태.       │  │
│  │ │      │ 주울 때 잔여물 없음.│  │
│  │ └──────┘                     │  │
│  ├──────────────────────────────┤  │
│  │ ...                          │  │
│  │ Score 7 — 설사               │  │
│  │ ┌──────┐ 물처럼 형태 없음.   │  │
│  │ │ 📷   │ 웅덩이 형태.       │  │
│  │ └──────┘                     │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

**태그 옵션 description 필드 예시**:
```typescript
export const POOP_CONSISTENCY_OPTIONS = [
  {
    value: 'watery', label: '설사(물)', icon: '💦',
    score: 7,
    description: '물처럼 형태가 없음. 웅덩이 형태로 나옴.',
    referenceImage: '/reference/poop-score-7.jpg'
  },
  // ...
] as const
```

---

## Phase 1 상세 구현 계획

### 변경 파일 요약

| 파일 | 작업 | 설명 |
|------|------|------|
| `supabase/migrations/044_health_tags_and_vomit.sql` | **신규** | tags 컬럼 + vomit/note enum 추가 + daily_stats 뷰 재생성 |
| `lib/tag-options.ts` | **신규** | 태그 옵션 상수 (배변 색상/경도, 구토 색상) |
| `types/index.ts` | **수정** | LogCategory에 `vomit`, `note` 추가, DailyLog/DailyLogInput에 `tags` 추가, DailyStats에 `vomit_count` 추가, LOG_CATEGORY_CONFIG에 vomit/note 추가 |
| `components/daily-log/TagSelector.tsx` | **신규** | 재사용 가능한 태그 선택 칩 컴포넌트 |
| `components/daily-log/TagReferenceSheet.tsx` | **신규** | 기준 보기 바텀 시트 (이미지+텍스트) |
| `public/reference/` | **신규** | 참고 이미지 (Fecal Scoring Chart 등) |
| `components/daily-log/QuickLogModal.tsx` | **수정** | 배변 선택 시 색상/경도 태그 UI, 구토 카테고리 입력 UI, 기타 카테고리 입력 UI |
| `components/daily-log/Timeline.tsx` | **수정** | 태그 표시 (배변 색상 dot + 경도 텍스트, 구토 색상 dot), 기타 메모 표시 |
| `app/api/daily-logs/route.ts` | **수정** | POST/PATCH에 tags 필드 처리, GET 응답에 tags 포함 |
| `components/daily-log/DailyStatsCard.tsx` | **수정** | 구토 횟수 통계 표시 |

---

### Step 1: DB 마이그레이션

**파일**: `supabase/migrations/044_health_tags_and_vomit.sql`

```sql
-- 044: 건강 태그 + 구토 카테고리 추가

-- 1. tags 컬럼 추가
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT NULL;

-- 2. vomit, note enum 추가
ALTER TYPE log_category ADD VALUE IF NOT EXISTS 'vomit';
ALTER TYPE log_category ADD VALUE IF NOT EXISTS 'note';

-- 3. daily_stats 뷰 재생성 (vomit 집계 추가)
DROP VIEW IF EXISTS daily_stats;

CREATE VIEW daily_stats AS
SELECT
  user_id,
  pet_id,
  (logged_at AT TIME ZONE 'Asia/Seoul')::date AS log_date,
  COALESCE(SUM(CASE WHEN category = 'meal' THEN COALESCE(amount, 0) - COALESCE(leftover_amount, 0) END), 0) AS total_meal_amount,
  COUNT(CASE WHEN category = 'meal' THEN 1 END) AS meal_count,
  COALESCE(SUM(CASE WHEN category = 'water' THEN amount END), 0) AS total_water_amount,
  COUNT(CASE WHEN category = 'water' THEN 1 END) AS water_count,
  COUNT(CASE WHEN category = 'medicine' THEN 1 END) AS medicine_count,
  COUNT(CASE WHEN category = 'poop' THEN 1 END) AS poop_count,
  COUNT(CASE WHEN category = 'pee' THEN 1 END) AS pee_count,
  ROUND(AVG(CASE WHEN category = 'breathing' THEN amount END)::numeric, 1) AS avg_breathing_rate,
  COUNT(CASE WHEN category = 'breathing' THEN 1 END) AS breathing_count,
  COUNT(CASE WHEN category = 'snack' THEN 1 END) AS snack_count,
  COALESCE(SUM(CASE WHEN category = 'snack' THEN amount END), 0) AS total_snack_amount,
  COALESCE(SUM(CASE WHEN category = 'snack' THEN calories END), 0) AS total_snack_calories,
  COUNT(CASE WHEN category = 'walk' THEN 1 END) AS walk_count,
  COALESCE(SUM(CASE WHEN category = 'walk' THEN amount END), 0) AS total_walk_duration,
  -- 신규: 구토 집계
  COUNT(CASE WHEN category = 'vomit' THEN 1 END) AS vomit_count,
  -- 신규: 기타 메모 집계
  COUNT(CASE WHEN category = 'note' THEN 1 END) AS note_count
FROM daily_logs
WHERE deleted_at IS NULL
GROUP BY user_id, pet_id, (logged_at AT TIME ZONE 'Asia/Seoul')::date;
```

---

### Step 2: 태그 옵션 상수

**파일**: `lib/tag-options.ts` (신규)

```typescript
// 배변 색상
export const POOP_COLOR_OPTIONS = [
  { value: 'chocolate', label: '초콜릿(갈색)', color: '#8B4513' },
  { value: 'gray', label: '회색', color: '#9CA3AF' },
  { value: 'black', label: '검은색', color: '#1F2937' },
  { value: 'red', label: '붉은색', color: '#EF4444' },
  { value: 'green', label: '초록색', color: '#22C55E' },
  { value: 'yellow', label: '노란색', color: '#EAB308' },
] as const

// 배변 경도
export const POOP_CONSISTENCY_OPTIONS = [
  { value: 'watery', label: '설사(물)', icon: '💦' },
  { value: 'soft', label: '묽음', icon: '〰️' },
  { value: 'mushy', label: '부드러움', icon: '🔘' },
  { value: 'normal', label: '보통', icon: '✅' },
  { value: 'hard', label: '딱딱함', icon: '🪨' },
  { value: 'dry', label: '건조', icon: '🏜️' },
] as const

// 구토 색상
export const VOMIT_COLOR_OPTIONS = [
  { value: 'clear', label: '투명(무색)', color: '#E5E7EB' },
  { value: 'food', label: '음식물', color: '#D97706' },
  { value: 'white_foam', label: '흰색(거품)', color: '#F3F4F6' },
  { value: 'yellow', label: '노란색(담즙)', color: '#FACC15' },
  { value: 'green', label: '초록색', color: '#22C55E' },
  { value: 'brown', label: '갈색', color: '#92400E' },
  { value: 'red', label: '붉은색(혈액)', color: '#EF4444' },
] as const

// 타입 유틸리티
export type PoopColor = typeof POOP_COLOR_OPTIONS[number]['value']
export type PoopConsistency = typeof POOP_CONSISTENCY_OPTIONS[number]['value']
export type VomitColor = typeof VOMIT_COLOR_OPTIONS[number]['value']

// 태그 구조 타입
export interface PoopTags {
  color?: PoopColor
  consistency?: PoopConsistency
}

export interface VomitTags {
  color?: VomitColor
}

export type DailyLogTags = PoopTags | VomitTags
```

---

### Step 3: 타입 수정

**파일**: `types/index.ts`

**3-1. LogCategory** (Line 202)
```typescript
// Before
export type LogCategory = 'meal' | 'water' | 'snack' | 'medicine' | 'poop' | 'pee' | 'breathing' | 'weight' | 'walk'

// After
export type LogCategory = 'meal' | 'water' | 'snack' | 'medicine' | 'poop' | 'pee' | 'breathing' | 'weight' | 'walk' | 'vomit' | 'note'
```

**3-2. DailyLog** (Line 204~223) — `tags` 추가
```typescript
export interface DailyLog {
  // ... 기존 필드 ...
  walk_id?: string | null
  tags?: Record<string, string | string[]> | null  // 태그 (JSONB)
  created_at: string
  updated_at: string
}
```

**3-3. DailyLogInput** (Line 225~240) — `tags` 추가
```typescript
export interface DailyLogInput {
  // ... 기존 필드 ...
  walk_id?: string | null
  tags?: Record<string, string | string[]> | null
}
```

**3-4. DailyStats** (Line 242~260) — `vomit_count`, `note_count` 추가
```typescript
export interface DailyStats {
  // ... 기존 필드 ...
  total_walk_duration: number
  vomit_count: number  // 신규
  note_count: number   // 신규
}
```

**3-5. LOG_CATEGORY_CONFIG** (Line 471~541) — `vomit`, `note` 추가
```typescript
vomit: {
  label: '구토',
  icon: '🤮',
  unit: '회',
  placeholder: '',
  color: 'bg-rose-100 text-rose-700'
},
note: {
  label: '기타',
  icon: '📝',
  unit: '',
  placeholder: '',
  color: 'bg-gray-100 text-gray-700'
}
```

---

### Step 4: TagSelector + TagReferenceSheet 컴포넌트

**파일 1**: `components/daily-log/TagSelector.tsx` (신규)

재사용 가능한 태그 선택 UI:

```
Props:
- title: string              // 섹션 제목 ("색상", "경도")
- options: TagOption[]        // { value, label, color?, icon?, description?, referenceImage?, score? }
- selected: string | null     // 단일 선택
- onSelect: (value) => void
- optional?: boolean          // true면 "선택 안 함" 허용 (기본 true)
- referenceTitle?: string     // 기준 보기 시트 제목 (없으면 버튼 숨김)

UI:
- 제목 + (선택) 라벨 + [ℹ️ 기준 보기] 버튼 (referenceTitle이 있을 때만)
- 2~3열 그리드의 칩 버튼
- 색상 옵션: 색상 도트(●) + 라벨
- 아이콘 옵션: 아이콘 + 라벨
- 선택 시 ring-2 하이라이트
- 이미 선택된 칩 다시 탭하면 선택 해제
```

**파일 2**: `components/daily-log/TagReferenceSheet.tsx` (신규)

기준 보기 바텀 시트:

```
Props:
- open: boolean
- onOpenChange: (open) => void
- title: string               // "대변 경도 기준표"
- items: ReferenceItem[]       // { label, description, image?, score?, color? }

UI (shadcn Sheet, side="bottom"):
- 드래그 핸들
- 제목
- 스크롤 가능한 리스트
  - 각 항목: [참고 이미지 (80x80)] + [라벨 + 설명 텍스트]
  - 이미지 없는 항목: 색상 도트 또는 아이콘 + 설명
- 닫기 영역 (시트 외부 탭 or 하단 스와이프)
```

**파일 3**: `public/reference/` (신규 디렉토리)

참고 이미지 파일:
- `poop-score-1.jpg` ~ `poop-score-7.jpg` (Fecal Scoring Chart 개별 이미지)
- 또는 `poop-consistency-chart.jpg` (전체 차트 1장)
- 추후 Phase에서 구토/배뇨 등 참고 이미지 추가 가능

---

### Step 5: QuickLogModal 수정

**파일**: `components/daily-log/QuickLogModal.tsx`

**5-1. 상태 추가**
```typescript
const [tags, setTags] = useState<Record<string, string | string[]>>({})
```

**5-2. 카테고리 선택/초기화**
- `selectedCategory` 변경 시 `setTags({})` 리셋
- 폼 리셋 함수에 `setTags({})` 추가

**5-3. 배변(poop) 입력 UI 확장**
기존 배변은 날짜/시간 + 메모만 있음. 여기에 추가:
```
[날짜/시간 선택]
── 색상 (선택) ──
[초콜릿●] [회색●] [검은색●]
[붉은색●] [초록색●] [노란색●]

── 경도 (선택) ──
[💦설사] [〰️묽음] [🔘부드러움]
[✅보통] [🪨딱딱함] [🏜️건조]

[메모 입력]
[사진]
```

**5-4. 구토(vomit) 입력 UI (신규)**
배변/배뇨와 같은 원터치 패턴 (amount 입력 없음):
```
[날짜/시간 선택]
── 색상 (선택) ──
[●투명] [●음식물] [●흰색(거품)]
[●노란색] [●초록색] [●갈색]
[●붉은색]

[메모 입력]
[사진]
```

**5-5. 기타(note) 입력 UI (신규)**
메모만 입력하는 가장 심플한 카테고리:
```
[날짜/시간 선택]
[메모 입력] ← 포커스 자동 (메모가 핵심)
[사진]
```
- amount 없음, 태그 없음
- 메모 필드가 주요 입력
- 사진 첨부 가능
- 타임라인에서 📝 아이콘 + 메모 내용 표시

**5-6. 폼 제출 수정**
```typescript
const submitData: DailyLogInput = {
  category: selectedCategory,
  // ... 기존 필드 ...
  tags: Object.keys(tags).length > 0 ? tags : null,
}
```

---

### Step 6: Timeline 수정

**파일**: `components/daily-log/Timeline.tsx`

**6-1. 타임라인 아이템 표시**

배변 기록에 태그가 있으면:
```
💩 배변  [●붉은색] [묽음]
   메모 내용...
```

구토 기록:
```
🤮 구토  [●노란색(담즙)]
   메모 내용...
```

**구현**: formatValue() 함수에서 category === 'poop' || 'vomit'일 때 tags를 읽어서 인라인 배지로 표시

**6-2. 상세/편집 모드**
- View 모드: 태그를 읽기 전용 칩으로 표시
- Edit 모드: TagSelector 컴포넌트로 태그 수정 가능
- PATCH 요청에 tags 포함

---

### Step 7: API 수정

**파일**: `app/api/daily-logs/route.ts`

**7-1. POST 핸들러**
```typescript
const insertData = {
  // ... 기존 필드 ...
  tags: tags || null,   // JSONB — null이면 저장 안 됨
}
```

**7-2. PATCH 핸들러**
```typescript
// tags 필드가 요청에 포함되어 있으면 업데이트
if ('tags' in body) {
  updateData.tags = body.tags
}
```

**7-3. GET 핸들러**
- `daily_logs` SELECT에 `tags` 필드 추가 (기존 쿼리에 컬럼만 추가)

---

### Step 8: DailyStatsCard 수정

**파일**: `components/daily-log/DailyStatsCard.tsx`

구토, 기타 통계 항목 추가:
```typescript
{ category: 'vomit', value: `${vomit_count}회`, count: vomit_count },
{ category: 'note', value: `${note_count}건`, count: note_count },
```

---

### Step 9: 카드 레이아웃 기본값

기존 사용자의 `card_layout`에 `vomit`, `note`가 없을 수 있음.
`useCardLayout()` 훅에서 **알려진 카테고리 중 레이아웃에 없는 것은 기본 visible:true로 끝에 추가**하는 로직이 이미 있는지 확인 필요. 없으면 추가.

---

## Phase 2~4 상세 (추후 구현)

### Phase 2: 배뇨 태그 + 기침 카테고리

**태그 추가**: `lib/tag-options.ts`에 추가
```typescript
export const PEE_COLOR_OPTIONS = [
  { value: 'normal', label: '정상(노란)', color: '#FDE68A' },
  { value: 'cloudy', label: '혼탁', color: '#D4B896' },
  { value: 'foamy', label: '거품', color: '#FEF3C7' },
  { value: 'dark_brown', label: '짙은 갈색(콜라색)', color: '#78350F' },
  { value: 'red', label: '붉은색', color: '#EF4444' },
] as const

export const PEE_EXTRA_OPTIONS = [
  { value: 'ammonia_smell', label: '암모니아 냄새' },
  { value: 'strong_smell', label: '심한 냄새' },
  { value: 'frequent', label: '빈뇨' },
  { value: 'small_amount', label: '소량' },
] as const

export const COUGH_TYPE_OPTIONS = [
  { value: 'dry', label: '마른 기침' },
  { value: 'wet', label: '가래 기침' },
  { value: 'goose', label: '거위 소리' },
  { value: 'mouth_breathing', label: '개구호흡' },
  { value: 'wheezing', label: '거친 숨소리' },
  { value: 'whining', label: '깅깅거림' },
] as const
```

**DB**: `ALTER TYPE log_category ADD VALUE 'cough'`
**기침 입력**: 원터치 + 유형 태그(다중 선택 가능) + 메모

### Phase 3: 식사/음수 태그 + 목욕/발작

**태그 추가**:
```typescript
export const MEAL_STATUS_OPTIONS = [
  { value: 'decreased', label: '식욕저하' },
  { value: 'refused', label: '식사거부' },
  { value: 'forced', label: '강제급여' },
  { value: 'overeating', label: '과식' },
] as const

export const WATER_STATUS_OPTIONS = [
  { value: 'increased', label: '평소보다 많음' },
  { value: 'decreased', label: '평소보다 적음' },
  { value: 'none', label: '안 마심' },
] as const
```

**DB**: `ALTER TYPE log_category ADD VALUE 'bath'`, `ALTER TYPE log_category ADD VALUE 'seizure'`
**목욕**: 원터치 + 메모
**발작**: 지속시간(초) 입력 + 메모. 수의사 보고용 필수 데이터

### Phase 4: 증상 기록

**DB**: `ALTER TYPE log_category ADD VALUE 'symptom'`

**신규 컬럼** (또는 tags에 포함):
```json
{
  "body_part": "eye",
  "symptoms": ["redness", "discharge"]
}
```

**UI**: 🩺 아이콘 탭 → 신체부위 그리드(2열) → 해당 부위 증상 태그(다중 선택) → 사진 + 메모

**신체부위 및 증상 태그 전체 목록**:

| 부위 | 아이콘 | 태그 |
|------|--------|------|
| 눈 | 👁️ | 충혈, 눈곱(노란/녹색), 눈물과다, 눈동자흐림, 돌출, 부종 |
| 귀 | 👂 | 귀지이상(황갈/검정), 악취, 과도한긁기, 고름, 붉은반점 |
| 구강 | 👄 | 구취, 치석(노란/갈/검), 잇몸색변화(하양/노랑/파랑), 이빨빠짐 |
| 발/관절 | 🐾 | 절뚝거림, 뻣뻣함, 발바닥갈라짐, 발바닥핥음, 부종, 망설임 |
| 피부/털 | 🔍 | 탈모, 발진/붉은반점, 뾰루지, 종기, 딱지, 검은반점, 털윤기저하 |
| 호흡 | 🫁 | 호흡곤란, 깅깅거림 |
| 행동 | 🐕 | 떨림, 무기력, 빙글빙글돌기, 벽에부딪침, 머리가우뚱, 공격성, 벽에머리밀기 |
| 복부/등 | 🦴 | 복부팽만, 혹, 등휘어짐, 등에혹 |
| 생식기/항문 | 🔻 | 분비물, 부종, 항문돌출, 엉덩이끌기 |
| 얼굴/코 | 🐶 | 얼굴부종, 눈아래부종, 코벗겨짐, 코마름, 얼굴긁기 |

---

## 위험 분석

### 1. 기존 카테고리 호환성 (LOW RISK)
- `tags` 컬럼은 JSONB NULL → 기존 기록에 영향 없음
- 프론트엔드에서 `tags`가 없으면 기존 UI 그대로 표시

### 2. 카드 레이아웃 (MEDIUM RISK)
- 기존 사용자의 `card_layout` 설정에 새 카테고리(`vomit`)가 없음
- **방지**: `useCardLayout()` 훅에서 미등록 카테고리를 자동으로 기본 추가하는 로직 필요

### 3. daily_stats 뷰 재생성 (LOW RISK)
- `DROP VIEW + CREATE VIEW`로 안전하게 재생성
- 기존 집계 쿼리 그대로 유지, 새 컬럼만 추가

### 4. 월간 통계 (LOW RISK)
- 월간 통계(`/api/daily-logs?stats=true`)에서 `daily_stats` 뷰를 사용하므로 자동 반영
- DailyStatsCard에서 vomit_count 표시만 추가하면 됨

### 5. Excel 내보내기 (LOW RISK)
- `DailyLogExcelExport.tsx`에서 tags 필드를 읽어 표시 추가 필요 (Phase 1에서는 생략 가능, 추후)

---

## 검증 계획

1. **빌드**: `npm run build` 성공
2. **DB**: `npx supabase db push` — 마이그레이션 정상 적용
3. **배변 태그 기록**: 배변 기록 시 색상/경도 태그 선택 → 저장 → 타임라인에서 태그 배지 확인
4. **배변 태그 미선택**: 태그 없이 배변 기록 → 기존과 동일하게 동작
5. **배변 태그 수정**: 타임라인에서 기존 기록 편집 → 태그 변경 → 저장 → 반영 확인
6. **구토 기록**: QuickLog에서 구토 카테고리 선택 → 색상 태그 + 메모 입력 → 저장 → 타임라인 표시 확인
7. **구토 통계**: DailyStatsCard에 구토 횟수 표시 확인
8. **기타 기록**: QuickLog에서 기타 카테고리 선택 → 메모 입력 → 저장 → 타임라인 표시 확인
9. **기타 + 사진**: 기타 기록에 사진 첨부 → 저장 → 타임라인에서 사진 확인
10. **카드 레이아웃**: 기존 사용자 로그인 시 구토/기타 카테고리가 QuickLog 그리드에 자동 추가되는지 확인
11. **기존 기능 회귀**: 식사/음수/간식/약/배뇨/호흡수/체중/산책 기록이 정상 동작하는지 확인

---

## Phase 1~5 UI 목업

### Phase 1: QuickLog 카테고리 그리드

**현재 (9개 카테고리, 2페이지)**:
```
┌─── 빠른 기록 ─────────────────────┐
│                                    │
│  Page 1:                           │
│  ┌────────┐ ┌────────┐ ┌────────┐ │
│  │  🍚   │ │  💧   │ │  🍪   │ │
│  │  식사  │ │  음수  │ │  간식  │ │
│  └────────┘ └────────┘ └────────┘ │
│  ┌────────┐ ┌────────┐ ┌────────┐ │
│  │  💊   │ │  💩   │ │  🚽   │ │
│  │   약   │ │  배변  │ │  배뇨  │ │
│  └────────┘ └────────┘ └────────┘ │
│            ● ○ ○                   │
│                                    │
│  Page 2:                           │
│  ┌────────┐ ┌────────┐ ┌────────┐ │
│  │  🫁   │ │  🐕   │ │        │ │
│  │ 호흡수 │ │  산책  │ │        │ │
│  └────────┘ └────────┘ └────────┘ │
│            ○ ● ○                   │
│                                    │
│  Page 3 (체중):                    │
│  ┌────────┐                        │
│  │  ⚖️   │                        │
│  │  체중  │                        │
│  └────────┘                        │
│            ○ ○ ●                   │
└────────────────────────────────────┘
```

**Phase 1 이후 (11개 카테고리, 3페이지 + 체중)**:
```
┌─── 빠른 기록 ─────────────────────┐
│                                    │
│  Page 1 (기존):                    │
│  ┌────────┐ ┌────────┐ ┌────────┐ │
│  │  🍚   │ │  💧   │ │  🍪   │ │
│  │  식사  │ │  음수  │ │  간식  │ │
│  └────────┘ └────────┘ └────────┘ │
│  ┌────────┐ ┌────────┐ ┌────────┐ │
│  │  💊   │ │  💩   │ │  🚽   │ │
│  │   약   │ │  배변  │ │  배뇨  │ │
│  └────────┘ └────────┘ └────────┘ │
│          ● ○ ○ ○                   │
│                                    │
│  Page 2 (기존+신규):               │
│  ┌────────┐ ┌────────┐ ┌────────┐ │
│  │  🫁   │ │  🐕   │ │  🤮   │ │
│  │ 호흡수 │ │  산책  │ │  구토  │ │ ← NEW
│  └────────┘ └────────┘ └────────┘ │
│  ┌────────┐                        │
│  │  📝   │                        │ ← NEW
│  │  기타  │                        │
│  └────────┘                        │
│          ○ ● ○ ○                   │
└────────────────────────────────────┘
```

### Phase 1: 배변(💩) 입력 — 태그 추가

**기존**: 시간 + 메모 + 사진만
**Phase 1 이후**:
```
┌─── 💩 배변 기록 ──────────────────┐
│                                    │
│  시간                              │
│  ┌──────────┐ ┌──────────┐        │
│  │2026-02-25│ │  14:30   │        │
│  └──────────┘ └──────────┘        │
│                                    │
│  색상 (선택)       [ℹ️ 기준 보기]  │ ← 탭→바텀시트
│  ┌────────┐ ┌────────┐ ┌────────┐ │
│  │ ● 갈색 │ │ ● 회색 │ │ ● 검정 │ │
│  └────────┘ └────────┘ └────────┘ │
│  ┌────────┐ ┌────────┐ ┌────────┐ │
│  │ ● 붉은 │ │ ● 초록 │ │ ● 노란 │ │
│  └────────┘ └────────┘ └────────┘ │
│                                    │
│  경도 (선택)       [ℹ️ 기준 보기]  │ ← 탭→Fecal Scoring Chart
│  ┌────────┐ ┌────────┐ ┌────────┐ │
│  │💦 설사 │ │〰️ 묽음│ │🔘부드럽│ │
│  └────────┘ └────────┘ └────────┘ │
│  ┌────────┐ ┌────────┐ ┌────────┐ │
│  │✅ 보통 │ │🪨 딱딱 │ │🏜️ 건조│ │
│  └────────┘ └────────┘ └────────┘ │
│                                    │
│  메모 (선택)                       │
│  ┌──────────────────────────────┐  │
│  │ 약간 물기가 많았음            │  │
│  └──────────────────────────────┘  │
│  📷 카메라  🖼️ 갤러리             │
│                                    │
│          [ 저장 ]                  │
└────────────────────────────────────┘
```

### Phase 1: 구토(🤮) 입력

```
┌─── 🤮 구토 기록 ──────────────────┐
│                                    │
│  시간                              │
│  ┌──────────┐ ┌──────────┐        │
│  │2026-02-25│ │  13:15   │        │
│  └──────────┘ └──────────┘        │
│                                    │
│  색상 (선택)                       │
│  ┌────────┐ ┌────────┐ ┌────────┐ │
│  │ ● 투명 │ │●음식물 │ │● 거품  │ │
│  └────────┘ └────────┘ └────────┘ │
│  ┌────────┐ ┌────────┐ ┌────────┐ │
│  │ ● 노란 │ │ ● 초록 │ │ ● 갈색 │ │
│  └────────┘ └────────┘ └────────┘ │
│  ┌────────┐                        │
│  │ ● 붉은 │                        │
│  └────────┘                        │
│                                    │
│  메모 (선택)                       │
│  ┌──────────────────────────────┐  │
│  │ 식후 30분 뒤 구토             │  │
│  └──────────────────────────────┘  │
│  📷 카메라  🖼️ 갤러리             │
│                                    │
│          [ 저장 ]                  │
└────────────────────────────────────┘
```

### Phase 1: 기타(📝) 입력

```
┌─── 📝 기타 기록 ──────────────────┐
│                                    │
│  시간                              │
│  ┌──────────┐ ┌──────────┐        │
│  │2026-02-25│ │  10:00   │        │
│  └──────────┘ └──────────┘        │
│                                    │
│  메모                              │
│  ┌──────────────────────────────┐  │
│  │ 오늘 좀 기운 없어 보임.       │  │
│  │ 소파 아래에서 안 나옴          │  │
│  └──────────────────────────────┘  │
│  📷 카메라  🖼️ 갤러리             │
│                                    │
│          [ 저장 ]                  │
└────────────────────────────────────┘
```

### Phase 1: 타임라인 표시

```
┌─ 2026년 2월 25일 요약 ───────────────────┐
│ 🍚 1회  💧 2회  💩 1회  🤮 1회  📝 1건   │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ 오후 │  💩  │ 배변  ●붉은색  묽음    📷1 │
│ 02:30│      │ 약간 물기가 많았음          │
├──────────────────────────────────────────┤
│ 오후 │  🤮  │ 구토  ●노란색(담즙)        │
│ 01:15│      │ 식후 30분 뒤 구토           │
├──────────────────────────────────────────┤
│ 오전 │  📝  │ 기타                        │
│ 10:00│      │ 오늘 좀 기운 없어 보임      │
├──────────────────────────────────────────┤
│ 오전 │  🍚  │ 식사  120g                  │
│ 08:30│      │                             │
└──────────────────────────────────────────┘
```

### Phase 2: 배뇨(🚽) 태그 + 기침(💨) 추가

```
┌─── 🚽 배뇨 기록 ──────────────────┐
│  시간: [2026-02-25] [16:00]       │
│                                    │
│  색상 (선택)                       │
│  ┌────────┐ ┌────────┐ ┌────────┐ │
│  │● 정상  │ │● 혼탁  │ │● 거품  │ │
│  └────────┘ └────────┘ └────────┘ │
│  ┌────────┐ ┌────────┐            │
│  │● 갈색  │ │● 붉은  │            │
│  └────────┘ └────────┘            │
│                                    │
│  기타 (선택, 다중)                 │
│  ┌──────────┐ ┌──────────┐        │
│  │암모니아냄새│ │ 심한냄새 │        │
│  └──────────┘ └──────────┘        │
│  ┌──────────┐ ┌──────────┐        │
│  │   빈뇨   │ │   소량   │        │
│  └──────────┘ └──────────┘        │
│  [메모]  📷  [ 저장 ]             │
└────────────────────────────────────┘

┌─── 💨 기침 기록 ──────────────────┐
│  시간: [2026-02-25] [20:00]       │
│                                    │
│  유형 (선택, 다중)                 │
│  ┌──────────┐ ┌──────────┐        │
│  │ 마른 기침 │ │ 가래 기침│        │
│  └──────────┘ └──────────┘        │
│  ┌──────────┐ ┌──────────┐        │
│  │ 거위 소리│ │ 개구호흡 │        │
│  └──────────┘ └──────────┘        │
│  ┌──────────┐ ┌──────────┐        │
│  │거친 숨소리│ │ 깅깅거림 │        │
│  └──────────┘ └──────────┘        │
│  [메모]  📷  [ 저장 ]             │
└────────────────────────────────────┘
```

### Phase 3: 식사/음수 태그 + 목욕(🛁) + 발작(⚡)

```
┌─── 🍚 식사 기록 ──────────────────┐
│  시간: [2026-02-25] [08:30]       │
│  급여량: [120] g                   │
│  남긴양: [ 30] g → 실섭취: 90g    │
│                                    │
│  특이사항 (선택)                   │
│  ┌──────────┐ ┌──────────┐        │
│  │ 식욕저하 │ │ 식사거부 │        │
│  └──────────┘ └──────────┘        │
│  ┌──────────┐ ┌──────────┐        │
│  │ 강제급여 │ │   과식   │        │
│  └──────────┘ └──────────┘        │
│  [메모]  📷  [ 저장 ]             │
└────────────────────────────────────┘

┌─── ⚡ 발작 기록 ──────────────────┐
│  시간: [2026-02-25] [03:20]       │
│                                    │
│  지속시간                          │
│  ┌──────────────────────┐          │
│  │         45           │ 초       │
│  └──────────────────────┘          │
│                                    │
│  메모                              │
│  ┌──────────────────────────────┐  │
│  │ 새벽에 갑자기 온몸이 경직.    │  │
│  │ 약 45초 후 멈춤. 직후 무기력  │  │
│  └──────────────────────────────┘  │
│  📷 카메라  🖼️ 갤러리             │
│          [ 저장 ]                  │
└────────────────────────────────────┘

┌─── 🛁 목욕 기록 ──────────────────┐
│  시간: [2026-02-25] [15:00]       │
│  메모 (선택)                       │
│  ┌──────────────────────────────┐  │
│  │ 발만 씻김                     │  │
│  └──────────────────────────────┘  │
│  📷 카메라  🖼️ 갤러리             │
│          [ 저장 ]                  │
└────────────────────────────────────┘
```

### Phase 4: 증상(🩺) 기록 — 2단계 입력

**Step A: 신체부위 선택**
```
┌─── 🩺 증상 기록 ──────────────────┐
│                                    │
│  어디가 이상한가요?                │
│                                    │
│  ┌────────┐ ┌────────┐ ┌────────┐ │
│  │  👁️   │ │  👂   │ │  👄   │ │
│  │   눈   │ │   귀   │ │  구강  │ │
│  └────────┘ └────────┘ └────────┘ │
│  ┌────────┐ ┌────────┐ ┌────────┐ │
│  │  🐾   │ │  🔍   │ │  🫁   │ │
│  │발/관절 │ │피부/털 │ │  호흡  │ │
│  └────────┘ └────────┘ └────────┘ │
│  ┌────────┐ ┌────────┐ ┌────────┐ │
│  │  🐕   │ │  🦴   │ │  🔻   │ │
│  │  행동  │ │복부/등 │ │생식기  │ │
│  └────────┘ └────────┘ └────────┘ │
│  ┌────────┐                        │
│  │  🐶   │                        │
│  │얼굴/코 │                        │
│  └────────┘                        │
└────────────────────────────────────┘
```

**Step B: 증상 태그 선택 (예: 눈)**
```
┌─── 🩺 증상 기록 > 👁️ 눈 ────────┐
│                                    │
│  시간: [2026-02-25] [11:00]       │
│                                    │
│  증상 (다중 선택)                  │
│  ┌──────────┐ ┌──────────┐        │
│  │  ✓ 충혈  │ │ 눈곱(노란)│        │
│  └──────────┘ └──────────┘        │
│  ┌──────────┐ ┌──────────┐        │
│  │ 눈곱(녹색)│ │ ✓ 눈물과다│        │
│  └──────────┘ └──────────┘        │
│  ┌──────────┐ ┌──────────┐        │
│  │ 눈동자흐림│ │   돌출   │        │
│  └──────────┘ └──────────┘        │
│  ┌──────────┐                      │
│  │   부종   │                      │
│  └──────────┘                      │
│                                    │
│  메모 (선택)                       │
│  ┌──────────────────────────────┐  │
│  │ 왼쪽 눈이 계속 충혈됨         │  │
│  └──────────────────────────────┘  │
│  📷 카메라  🖼️ 갤러리             │
│          [ 저장 ]                  │
└────────────────────────────────────┘
```

**타임라인 표시 (증상)**:
```
┌──────────────────────────────────────────┐
│ 오전 │  🩺  │ 증상 · 👁️눈              │
│ 11:00│      │ 충혈, 눈물과다      📷1   │
│      │      │ 왼쪽 눈이 계속 충혈됨      │
└──────────────────────────────────────────┘
```

### Phase 5: 진료 기록 (🏥)

**진료 기록 입력 (별도 페이지 또는 모달)**:
```
┌─── 🏥 진료 기록 ──────────────────────────┐
│                                            │
│  진료일                                    │
│  ┌──────────────────────┐                  │
│  │ 2026-02-25           │                  │
│  └──────────────────────┘                  │
│                                            │
│  병원  (기존 병원 연락처에서 선택/직접입력)  │
│  ┌──────────────────────────────────┐      │
│  │ 🔽 행복한 동물병원               │      │
│  └──────────────────────────────────┘      │
│                                            │
│  진료 유형                                 │
│  ┌────────┐ ┌────────┐ ┌────────┐         │
│  │정기검진 │ │ 증상   │ │ 수술   │         │
│  └────────┘ └────────┘ └────────┘         │
│  ┌────────┐ ┌────────┐                     │
│  │예방접종 │ │ 기타   │                     │
│  └────────┘ └────────┘                     │
│                                            │
│  진단 내용                                 │
│  ┌──────────────────────────────────┐      │
│  │ 췌장염 의심. 수액 치료 진행.      │      │
│  │ 3일 후 재검 필요.                 │      │
│  └──────────────────────────────────┘      │
│                                            │
│  처방 내용                                 │
│  ┌──────────────────────────────────┐      │
│  │ + 처방 추가                       │      │
│  │ ┌──────────────────────────────┐ │      │
│  │ │ 메트로니다졸 1정 × 2회/일    │ │      │
│  │ │ 기간: 5일                    │ │      │
│  │ └──────────────────────────────┘ │      │
│  │ ┌──────────────────────────────┐ │      │
│  │ │ 세레니아 주사                 │ │      │
│  │ └──────────────────────────────┘ │      │
│  └──────────────────────────────────┘      │
│                                            │
│  다음 방문 예정일                           │
│  ┌──────────────────────┐                  │
│  │ 2026-02-28           │                  │
│  └──────────────────────┘                  │
│                                            │
│  혈액검사 연결                              │
│  ┌──────────────────────────────────┐      │
│  │ 📊 2026-02-25 행복한동물병원     │      │
│  │    검사 기록이 있습니다. [연결]   │      │
│  └──────────────────────────────────┘      │
│                                            │
│  📷 사진 (처방전, 영수증 등)               │
│  📷 카메라  🖼️ 갤러리                     │
│                                            │
│            [ 저장 ]                        │
└────────────────────────────────────────────┘
```

**데일리 타임라인에 표시**:
```
┌──────────────────────────────────────────┐
│ 오후 │  🏥  │ 진료 · 행복한동물병원      │
│ 03:00│      │ 정기검진 · 췌장염 의심  📷2│
│      │      │ 다음 방문: 2/28             │
└──────────────────────────────────────────┘
```

**진료 이력 페이지 (/vet-visits)**:
```
┌─── 미모 진료 이력 ────────────────────────┐
│  ← 뒤로                                   │
├────────────────────────────────────────────┤
│                                            │
│  ┌─ 2026.02.25 ──────────────────────────┐│
│  │ 🏥 행복한동물병원                      ││
│  │ 정기검진                               ││
│  │ 췌장염 의심. 수액 치료 진행.           ││
│  │ 💊 메트로니다졸 × 5일                  ││
│  │ 📊 혈검 연결됨   📷 2장               ││
│  │ 📅 다음 방문: 2026.02.28              ││
│  └────────────────────────────────────────┘│
│                                            │
│  ┌─ 2026.01.15 ──────────────────────────┐│
│  │ 🏥 24시 동물병원                       ││
│  │ 증상                                   ││
│  │ 구토 반복으로 내원. 장염 진단.          ││
│  │ 💊 수액 + 항구토제                     ││
│  └────────────────────────────────────────┘│
│                                            │
│           [ + 진료 기록 추가 ]             │
└────────────────────────────────────────────┘
```

---

## Phase 5: 진료 기록 상세 구현 계획

### 설계 방향

진료 기록은 데일리 로그(`daily_logs`)와 성격이 다름:
- **1회 방문 = 여러 정보** (진단 + 처방 + 다음 예약 + 사진 + 혈검 연결)
- **비정기적** 기록 (매일이 아닌 방문 시만)
- **혈액검사 대시보드와 연동** 필요

따라서 **별도 테이블 `vet_visits`**로 관리하되, **데일리 타임라인에도 통합 표시**.

### DB 스키마

**신규 테이블: `vet_visits`**

```sql
CREATE TABLE vet_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,

  -- 진료 기본 정보
  visit_date DATE NOT NULL,                       -- 진료일
  hospital_id UUID REFERENCES hospitals(id),       -- 병원 연락처 연결 (선택)
  hospital_name VARCHAR(255),                      -- 병원명 (직접 입력 or hospitals에서)
  visit_type VARCHAR(50) NOT NULL DEFAULT 'other', -- 진료 유형
    -- CHECK: 'checkup'(정기검진), 'symptom'(증상), 'surgery'(수술),
    --        'vaccination'(예방접종), 'other'(기타)

  -- 진료 내용
  diagnosis TEXT,                -- 진단/소견
  treatment TEXT,                -- 치료 내용
  prescriptions JSONB,           -- 처방 목록 [{name, dosage, frequency, duration}]

  -- 후속 조치
  next_visit_date DATE,          -- 다음 방문 예정일

  -- 연결
  test_record_id UUID REFERENCES test_records(id),  -- 혈액검사 기록 연결 (선택)

  -- 사진/첨부
  photo_urls TEXT[],             -- 처방전, 영수증 등 사진

  -- 메모
  memo TEXT,

  -- 메타
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ         -- soft delete
);

-- RLS
ALTER TABLE vet_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own vet visits"
  ON vet_visits FOR ALL
  USING (auth.uid() = user_id);

-- 인덱스
CREATE INDEX idx_vet_visits_pet_date ON vet_visits(pet_id, visit_date DESC);
CREATE INDEX idx_vet_visits_user ON vet_visits(user_id);
```

**처방 JSONB 구조**:
```json
[
  {
    "name": "메트로니다졸",
    "dosage": "1정",
    "frequency": "2회/일",
    "duration": "5일",
    "notes": ""
  },
  {
    "name": "세레니아",
    "dosage": "주사",
    "frequency": "",
    "duration": "",
    "notes": "병원에서 투여"
  }
]
```

### API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/vet-visits` | 진료 기록 목록 (pet_id 필터, 날짜 범위) |
| GET | `/api/vet-visits?date=YYYY-MM-DD` | 특정 날짜의 진료 기록 (타임라인용) |
| POST | `/api/vet-visits` | 진료 기록 생성 |
| PATCH | `/api/vet-visits` | 진료 기록 수정 |
| DELETE | `/api/vet-visits` | 진료 기록 삭제 (soft delete) |

### 프론트엔드 구성

**신규 페이지**:
| 경로 | 설명 |
|------|------|
| `/vet-visits` | 진료 이력 목록 (최신순, 카드형) |
| `/vet-visits/new` | 진료 기록 작성 |
| `/vet-visits/[id]` | 진료 기록 상세/수정 |

**신규 컴포넌트**:
| 컴포넌트 | 설명 |
|---------|------|
| `VetVisitForm.tsx` | 진료 기록 입력/수정 폼 |
| `VetVisitCard.tsx` | 진료 이력 목록의 카드 |
| `PrescriptionInput.tsx` | 처방 목록 입력 (동적 추가/삭제) |

**기존 수정**:
| 파일 | 수정 내용 |
|------|----------|
| `app/daily-log/page.tsx` | 해당 날짜에 진료 기록이 있으면 타임라인 상단에 🏥 카드 표시 |
| `components/layout/AppHeader.tsx` | 햄버거 메뉴에 "진료 이력" 항목 추가 |
| `types/index.ts` | VetVisit, VetVisitInput, Prescription 인터페이스 추가 |

### 타임라인 통합 방식

데일리 로그 페이지(`/daily-log`)에서 해당 날짜의 진료 기록을 **별도 API**로 조회하여 타임라인 상단에 표시:

```typescript
// daily-log/page.tsx
const [vetVisits, setVetVisits] = useState<VetVisit[]>([])

// 날짜 변경 시
const fetchVetVisits = async (date: string) => {
  const res = await fetch(`/api/vet-visits?pet_id=${petId}&date=${date}`)
  // ...
}
```

진료 카드 클릭 시 `/vet-visits/[id]`로 이동 (별도 상세 페이지).

### 병원 연동

기존 `hospitals` 테이블과 연동:
- 진료 기록 작성 시 병원 드롭다운에서 선택 가능 (hospital_id)
- 직접 입력도 가능 (hospital_name만)
- 병원 연락처 페이지에서 등록한 병원이 자동으로 드롭다운에 표시

### 혈액검사 연동

- 진료 기록의 `visit_date`와 같은 날짜의 `test_records`가 있으면 자동 제안
- "연결" 버튼으로 `test_record_id` 설정
- 진료 이력 페이지에서 연결된 혈검 클릭 시 대시보드로 이동

### 처방 → 약 프리셋 연동 (선택적 확장)

진료 기록의 처방 내용을 약 프리셋으로 자동 등록하는 기능 (추후):
- 처방 저장 시 "약 프리셋에 추가?" 확인
- 기간 만료 시 "처방 기간이 끝났습니다" 알림 (추후)

### 네비게이션 추가

```typescript
// AppHeader.tsx 메뉴 항목 추가
{ href: '/vet-visits', label: '진료 이력', icon: '🏥' }
// /hospital-contacts 아래에 배치
```

### 변경 파일 요약 (Phase 5)

**신규 생성**:
- `supabase/migrations/0XX_vet_visits.sql`
- `app/vet-visits/page.tsx`
- `app/vet-visits/new/page.tsx`
- `app/vet-visits/[id]/page.tsx`
- `app/api/vet-visits/route.ts`
- `components/vet-visit/VetVisitForm.tsx`
- `components/vet-visit/VetVisitCard.tsx`
- `components/vet-visit/PrescriptionInput.tsx`

**수정**:
- `types/index.ts` — VetVisit, Prescription 인터페이스
- `components/layout/AppHeader.tsx` — 메뉴 항목 추가
- `app/daily-log/page.tsx` — 타임라인에 진료 카드 표시

---

## 전체 위험 분석 (Phase 5 추가)

### 6. 진료 기록-타임라인 통합 (MEDIUM RISK)
- 데일리 로그와 진료 기록은 별도 테이블 → 타임라인에 합치려면 2개 API 호출 필요
- **방지**: 진료 기록은 타임라인 "상단 고정" 카드로 표시 (시간순 정렬에 섞지 않음)

### 7. 병원 테이블 연동 (LOW RISK)
- 기존 `hospitals` 테이블이 이미 존재하므로 FK로 연결만 하면 됨
- hospital_id NULL 허용 → 직접 입력도 가능

### 8. 처방 JSONB (LOW RISK)
- JSONB로 유연하게 저장 → 스키마 변경 없이 필드 추가 가능
- 다만 처방 검색/필터는 JSONB 쿼리 필요 (추후 인덱스 고려)
