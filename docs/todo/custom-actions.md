# 커스텀 액션 + 프리셋 설정 통합

> **상태**: 코드 구현 완료 (빌드 통과), DB 마이그레이션/배포 대기 중
> **브랜치**: `feat/custom-actions` (worktree: `premuto-1-feat-custom-actions`)
> **작성일**: 2026-02-21

## Context

사용자가 자주 기록하는 행동(구토, 양치, 눈세정 등)을 빠른 기록에서 원터치로 기록할 수 있도록 커스텀 액션 기능을 추가한다. 동시에 간식/약 프리셋 관리를 설정 페이지로 이동하여 메뉴를 정리한다.

## 변경 요약

1. **DB**: `log_category` ENUM → TEXT 변환, `custom_actions` 테이블 생성
2. **타입**: `LogCategory` 확장, `getCategoryConfig()` 헬퍼 추가
3. **API**: `/api/custom-actions` CRUD, daily-logs 커스텀 카테고리 지원
4. **Tier**: `custom_action_max_slots` 추가 (Free=1, Basic=2, Premium=4)
5. **QuickLogModal**: 호흡수→2페이지, 커스텀 버튼 1페이지에 배치
6. **설정**: 새 "프리셋" 탭 (커스텀 액션 + 간식 + 약 프리셋)
7. **네비게이션**: /manage → /settings?tab=preset 리다이렉트

---

## Step 1: DB 마이그레이션 (`supabase/migrations/040_custom_actions.sql`)

```sql
-- ENUM → TEXT
ALTER TABLE daily_logs ALTER COLUMN category TYPE TEXT;
DROP TYPE IF EXISTS log_category;

-- custom_actions 테이블
CREATE TABLE custom_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id UUID REFERENCES pets(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  icon VARCHAR(10) NOT NULL DEFAULT '⭐',
  input_type VARCHAR(20) NOT NULL DEFAULT 'one_touch', -- one_touch / amount / memo
  unit VARCHAR(20),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS, 인덱스, 유니크, 트리거 설정
-- daily_stats 뷰 재생성 (WHERE category NOT LIKE 'custom:%')
```

## Step 2: 타입 시스템 (`types/index.ts`)

- `BuiltinLogCategory` 타입 추가 (기존 9개 값)
- `LogCategory = BuiltinLogCategory | \`custom:${string}\`` 으로 확장
- `CustomAction` 인터페이스 추가
- `isCustomCategory()`, `getCustomActionName()`, `getCategoryConfig()` 헬퍼 함수 추가
  - `getCategoryConfig()`는 built-in이면 `LOG_CATEGORY_CONFIG`에서, custom이면 이름/아이콘 파싱으로 fallback

## Step 3: Tier 설정 (`lib/tier.ts`)

- `TierConfig`에 `custom_action_max_slots` 추가
- DEFAULT: free=1, basic=2, premium=4

## Step 4: API (`app/api/custom-actions/route.ts`)

- GET: 사용자의 활성 커스텀 액션 목록 (pet_id 필터)
- POST: 생성 (티어 제한 체크)
- PATCH: 수정
- DELETE: 비활성화 (is_active=false)

## Step 5: daily-logs API 수정 (`app/api/daily-logs/route.ts`)

- POST: `custom:` 카테고리 허용 (custom_actions 테이블에서 존재 확인)

## Step 6: 커스텀 액션 관리 컴포넌트 (`components/settings/CustomActionsSection.tsx`)

- 액션 목록 표시 (아이콘 + 이름 + 입력방식)
- 추가/수정/삭제 UI
- 티어 제한 표시 ("1/1 슬롯 사용 중")
- 이모지 입력, input_type 선택 (원터치/수량/메모), 단위 입력

## Step 7: 설정 페이지 수정 (`app/settings/page.tsx`)

- 탭: 4열 → 5열 (`grid-cols-5`)
- 새 "프리셋" 탭 추가 (pet과 theme 사이)
- PresetSection: CustomActionsSection + SnackPresetSection + MedicinePresetSection
- SnackPresetSection/MedicinePresetSection은 기존 컴포넌트 재사용

## Step 8: QuickLogModal 수정 (`components/daily-log/QuickLogModal.tsx`)

- **Page 1**: `['meal', 'water', 'snack', 'poop', 'pee']` + "⭐ 커스텀" 버튼
- **Page 2**: `breathing`, `medicine`, `weight`, `walk` (4개)
- 커스텀 버튼 클릭 → 커스텀 액션 슬롯 화면 (날짜/시간 + 4슬롯 그리드)
  - 활성 슬롯: 설정된 커스텀 액션 버튼
  - 비활성/빈 슬롯: 자물쇠 + 티어 안내
  - 하단: "설정에서 관리" 링크
- one_touch → 즉시 POST → 성공 토스트
- amount → 숫자 입력 폼 표시 → 저장
- memo → 메모 입력 폼 표시 → 저장
- `category: \`custom:${action.name}\`` 형태로 저장

## Step 9: 기존 컴포넌트 `LOG_CATEGORY_CONFIG[log.category]` 안전 처리

모든 직접 참조를 `getCategoryConfig()` 또는 안전한 조건부 접근으로 변경:

| 파일 | 변경 내용 |
|------|----------|
| `components/daily-log/Timeline.tsx` | `LOG_CATEGORY_CONFIG[log.category]` → `getCategoryConfig(log.category)` (7+ 위치) |
| `app/daily-log/page.tsx:303` | 클립보드 복사 시 config 조회 안전 처리 |
| `app/daily-log/page.tsx:501` | 카테고리 필터 라벨 표시 안전 처리 |
| `components/daily-log/DailyTrendChart.tsx:102` | label 조회 안전 처리 |
| `components/daily-log/DailyLogExcelExport.tsx:202` | unit 조회 이미 optional chaining 사용 — 확인만 |
| `app/trash/page.tsx:297` | 이미 fallback 있음 — `custom:` 패턴 추가 |

DailyStatsCard, MonthlyStatsCalendar, MonthlyStatsCard: built-in 카테고리만 사용하므로 변경 불필요.

## Step 10: 네비게이션 정리

- `components/layout/AppHeader.tsx`: `/manage` → `/settings?tab=preset` 변경
- `app/manage/page.tsx`: redirect('/settings?tab=preset')로 교체

---

## 구현 현황

### 완료된 파일

| 파일 | 유형 | 상태 |
|------|------|------|
| `supabase/migrations/040_custom_actions.sql` | 신규 | 완료 |
| `types/index.ts` | 수정 | 완료 |
| `lib/tier.ts` | 수정 | 완료 |
| `app/api/custom-actions/route.ts` | 신규 | 완료 |
| `app/api/daily-logs/route.ts` | 수정 | 완료 |
| `components/settings/CustomActionsSection.tsx` | 신규 | 완료 |
| `app/settings/page.tsx` | 수정 | 완료 |
| `components/daily-log/QuickLogModal.tsx` | 수정 | 완료 |
| `components/daily-log/Timeline.tsx` | 수정 | 완료 |
| `app/daily-log/page.tsx` | 수정 | 완료 |
| `components/daily-log/DailyTrendChart.tsx` | 수정 | 완료 |
| `components/layout/AppHeader.tsx` | 수정 | 완료 |

### 남은 작업

- [ ] 코드 리뷰 후 커밋/푸시
- [ ] PR 생성
- [ ] DB 마이그레이션 실행 (`npx supabase db push`)
- [ ] 기능 테스트 (설정 > 프리셋, 빠른 기록 > 커스텀 버튼)

---

## 검증 방법

1. `npm run build` — 타입 에러 없이 빌드 성공 ✅
2. DB 마이그레이션 실행 후 기존 daily_logs 데이터 정상 조회 확인
3. 설정 > 프리셋 탭에서 커스텀 액션 추가/수정/삭제
4. 빠른 기록 모달에서 커스텀 버튼 → 액션 선택 → 기록 저장
5. 타임라인에서 커스텀 기록 정상 표시 (아이콘 + 이름)
6. /manage 접근 시 /settings?tab=preset로 리다이렉트
7. 기존 카테고리(식사, 음수 등) 기록/조회 정상 작동 확인
