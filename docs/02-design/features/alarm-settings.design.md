# 알림 설정 (Alarm Settings)

> **상태: 설계 초안 (아키텍처 미결)**
> 알림 전달 방식(클라이언트 타이머 vs 서버 Web Push)이 미결.
> 복사/붙여넣기 기능 구현 후 별도 결정 예정.

## 개요

요일/시간별 반복 알림을 설정하고, 알림에서 원터치로 일일 기록을 생성하는 기능.

### 미결 사항: 알림 전달 아키텍처

| 방식 | 앱 열림 | 앱 닫힘 (Android PWA) | 앱 닫힘 (iOS) | 비용 |
|------|---------|----------------------|--------------|------|
| 클라이언트 SW 타이머 | O | X (SW 종료됨) | X | 0원 |
| 서버 Web Push (VAPID) | O | O | △ (iOS 16.4+) | cron 서비스 필요 |

구현 시 둘 중 하나를 선택. DB 테이블/API/UI 구조는 동일.

## FR-1: 알림 설정 페이지 (`/alarm-settings`)

햄버거 메뉴에서 접근하는 알림 관리 페이지.

### 알림 규칙 구조
- **이름**: 자유 입력 (예: "아침 식사", "저녁 약")
- **요일**: 월~일 다중 선택 (토글 버튼 그룹)
- **시간**: 여러 개 등록 가능 (예: 08:00, 18:00)
- **항목**: 카테고리 + 기본 양 + (약/간식 이름). 여러 개 등록 가능
- **활성/비활성**: 토글 스위치

### 지원 카테고리
meal, water, snack, medicine만 지원.
(poop, pee, breathing, walk, vomit, note는 "급여" 개념이 아니므로 제외)

### AC (Acceptance Criteria)

**성공 시나리오**:
- "새 알림" 버튼 → 알림 편집 폼 표시
- 이름 입력, 요일 선택(복수), 시간 추가(복수), 항목 추가(복수)
- "저장" → DB 저장 + 목록에 표시 + 토스트 "알림이 설정되었습니다"
- 목록에서 항목 클릭 → 편집 모드 → 수정 후 "저장" → PATCH 호출 + 토스트 "알림이 수정되었습니다"
- 스와이프/삭제 버튼 → 삭제 확인 → 삭제

**실패/에러 시나리오**:
- 이름 미입력 → "알림 이름을 입력해주세요" 유효성 검사
- 요일 0개 선택 → "최소 1개 요일을 선택해주세요"
- 시간 0개 → "최소 1개 시간을 추가해주세요"
- 항목 0개 → "최소 1개 기록 항목을 추가해주세요"
- 네트워크 에러 → "저장에 실패했습니다. 다시 시도해주세요."

**엣지케이스**:
- 같은 시간에 여러 알림 → 각각 독립적으로 발송
- 반려동물 여러 마리 → 각 알림에 pet_id 지정 (현재 선택된 반려동물 기본값)
- 반려동물 삭제 시 → 해당 pet_id의 알림은 유지하되 발송 시 유효성 체크
- 이미 오늘 발송된 알림을 편집 → 다음 발송 시점부터 적용

---

## FR-2: 브라우저 알림 권한 및 PWA

### 알림 권한 요청
- 알림 설정 페이지 첫 진입 시 → `Notification.requestPermission()` 호출
- 권한 거부 시 → "알림을 받으려면 브라우저 설정에서 알림을 허용해주세요" 안내

### PWA 구성
- `public/manifest.json` — 앱 이름, 아이콘, display: standalone
- `public/sw.js` — Service Worker
- `next.config.js` — SW 등록 헬퍼 (next-pwa 미사용, 수동 등록)

### AC (Acceptance Criteria)

**성공 시나리오**:
- 첫 알림 설정 저장 시 → 브라우저 알림 권한 요청 팝업
- "허용" → SW 등록 + 알림 활성화
- PWA 설치 가능 상태 → 설치 유도 배너 표시 (선택적)

**실패/에러 시나리오**:
- 알림 권한 "차단" → 기능 안내 메시지 + 알림 설정 저장은 가능 (나중에 권한 허용 시 동작)
- SW 등록 실패 → 콘솔 에러 로그 + "알림 기능을 사용할 수 없습니다" 안내

**엣지케이스**:
- iOS Safari → PWA 설치(홈 화면 추가) 필요 안내
- HTTP 환경 → SW 등록 불가. HTTPS 필요 안내 (개발 시 localhost는 허용)

---

## FR-3: 알림 발송 및 자동 기록

> 알림 전달 방식(클라이언트/서버)은 미결. 아래는 공통 UX 흐름.

### Notification 구성
```
제목: "🐾 {반려동물이름} {알림이름} 시간이에요!"
본문: "식사 80g, 심장약 1정"
아이콘: 앱 아이콘
액션: ["급여하기", "수정 후 기록"]
```

### 알림 액션 처리
- **"급여하기"** → 앱 열기 + URL 파라미터로 자동기록 지시
  - `/daily-log?alarm_action=auto&alarm_id={id}&scheduled_time={HH:mm}`
  - page.tsx에서 파라미터 감지 → 설정된 항목들 POST 자동 호출
  - `logged_at`은 `scheduled_time` 기준 (클릭 시점이 아님)
- **"수정 후 기록"** → 앱 열기 + QuickLogModal 프리필
  - `/daily-log?alarm_action=edit&alarm_id={id}&scheduled_time={HH:mm}`
  - page.tsx에서 파라미터 감지 → QuickLogModal 오픈 (카테고리+양 프리필)

### AC (Acceptance Criteria)

**성공 시나리오**:
- 설정 시간 도달 → 알림 표시
- "급여하기" 클릭 → 앱 열림 → 자동으로 POST 호출 → 토스트 "기록되었습니다"
- "수정 후 기록" 클릭 → 앱 열림 → QuickLogModal 오픈 (카테고리+양 프리필)
- 알림 설정 변경 시 → 즉시 반영

**실패/에러 시나리오**:
- 자동 기록 POST 실패 → "기록에 실패했습니다. 수동으로 기록해주세요." 토스트
- 알림 설정에 매핑된 pet_id가 삭제됨 → 알림은 표시하되 기록 시 현재 선택된 pet 사용

**엣지케이스**:
- 여러 항목(meal+medicine)이 매핑된 알림 → "급여하기" 시 모든 항목 일괄 POST
- 중복 클릭 방지: `alarm_action` URL 파라미터 처리 후 즉시 URL에서 제거. 새로고침 시 재실행 방지.
- 오래된 알림 클릭 (2시간+ 경과): "급여하기" 대신 "수정 후 기록"으로 폴백 (시간 확인 필요)
- 시간은 KST(UTC+9) 기준으로만 동작. 다중 시간대 미지원.

---

## DB 테이블: `alarm_settings`

```sql
CREATE TABLE alarm_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  pet_id UUID REFERENCES pets(id),
  name VARCHAR(100) NOT NULL,
  days_of_week INTEGER[] NOT NULL,  -- [0..6] 일~토
  times TIME[] NOT NULL,            -- ['08:00', '18:00'] KST 기준
  items JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS (프로젝트 표준 패턴)
ALTER TABLE alarm_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alarm_settings_select" ON alarm_settings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "alarm_settings_insert" ON alarm_settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "alarm_settings_update" ON alarm_settings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "alarm_settings_delete" ON alarm_settings
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
```

> `times`는 timezone 없는 `TIME[]` 타입. KST(UTC+9) 기준으로만 사용.
> 다중 시간대 지원은 향후 스코프.

## TypeScript 타입 (`types/index.ts`에 추가)

```typescript
export interface AlarmItem {
  category: 'meal' | 'water' | 'snack' | 'medicine'
  amount: number | null
  unit: string | null
  medicine_name?: string | null
  snack_name?: string | null
}

export interface AlarmSetting {
  id: string
  user_id: string
  pet_id: string | null
  name: string
  days_of_week: number[]  // 0=Sun..6=Sat
  times: string[]         // 'HH:mm' KST
  items: AlarmItem[]
  is_active: boolean
  created_at: string
  updated_at: string
}
```

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/alarm-settings` | 현재 사용자의 알림 목록 |
| POST | `/api/alarm-settings` | 알림 생성 |
| PATCH | `/api/alarm-settings` | 알림 수정 |
| DELETE | `/api/alarm-settings` | 알림 삭제 |

## 변경 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `app/alarm-settings/page.tsx` | **신규** - 알림 설정 페이지 |
| `components/alarm/AlarmForm.tsx` | **신규** - 알림 편집 폼 |
| `components/alarm/AlarmList.tsx` | **신규** - 알림 목록 |
| `components/alarm/AlarmItemRow.tsx` | **신규** - 알림 항목 행 |
| `app/api/alarm-settings/route.ts` | **신규** - CRUD API |
| `public/sw.js` | **신규** - Service Worker |
| `public/manifest.json` | **신규** - PWA manifest |
| `app/layout.tsx` | SW 등록 스크립트 추가 |
| `app/daily-log/page.tsx` | alarm_action URL 파라미터 처리 |
| `types/index.ts` | AlarmItem, AlarmSetting 타입 추가 |
| `components/layout/AppHeader.tsx` | 햄버거 메뉴 navItems에 "알림 설정" 추가 |
| `supabase/migrations/049_alarm_settings.sql` | **신규** - 테이블 + RLS |

## 구현 순서

1. DB 마이그레이션 (alarm_settings 테이블)
2. TypeScript 타입 추가
3. API CRUD 엔드포인트
4. 알림 설정 페이지 + 폼 UI
5. PWA manifest + Service Worker 기본 구조
6. 알림 전달 로직 (아키텍처 결정 후)
7. daily-log page.tsx에 alarm_action 파라미터 처리
8. 햄버거 메뉴 업데이트
