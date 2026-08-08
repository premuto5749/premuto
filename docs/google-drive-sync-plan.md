# Google Drive 동기화 기능 계획서

## 1. 개요

Premuto 사용자의 반려동물 건강 데이터를 Google Drive에 백업/동기화하는 기능.

### 목표

- 사용자가 자신의 데이터를 Google Drive에 자동/수동으로 백업
- 데이터 유실 방지 및 이동성(portability) 확보
- 기존 티어 시스템과 통합

### 동기화 전략: **단방향 백업 (Premuto → Google Drive)**

양방향 동기화는 충돌 해결이 복잡하고 데이터 무결성 위험이 높으므로, **Premuto를 원본(source of truth)으로 하는 단방향 백업** 방식을 채택한다.

---

## 2. 사용자 워크플로우

### 2-1. Google Drive 연결

```
설정 페이지 → "Google Drive 연결" 버튼 클릭
  → Google OAuth 2.0 동의 화면 (drive.file 스코프)
  → 승인 → 콜백 → 토큰 저장
  → Drive에 "Premuto" 폴더 자동 생성
  → 연결 완료 표시
```

### 2-2. 수동 백업

```
설정 페이지 → "지금 백업" 버튼 클릭
  → 백업 범위 선택 (전체 / 일일기록 / 혈액검사)
  → 진행률 표시
  → 완료 → 마지막 백업 시간 갱신
```

### 2-3. 자동 백업 (Premium 전용)

```
설정 페이지 → "자동 백업" 토글 ON
  → 주기 선택 (매일 / 매주 / 매월)
  → 백그라운드 동기화 실행
```

---

## 3. Google Drive 폴더 구조

```
내 드라이브/
└── Premuto/
    └── {pet_name}/
        ├── daily-logs/
        │   ├── 2026-01/
        │   │   ├── daily-logs-2026-01.xlsx    (월별 일일기록 Excel)
        │   │   └── photos/                     (해당 월 사진들)
        │   └── 2026-02/
        │       └── ...
        ├── blood-tests/
        │   ├── blood-tests-all.xlsx            (전체 혈액검사 피벗 Excel)
        │   └── originals/                      (원본 검사지 PDF/이미지)
        └── backup-metadata.json                (마지막 동기화 상태)
```

### backup-metadata.json 구조

```json
{
  "version": 1,
  "pet_id": "uuid",
  "pet_name": "미모",
  "last_sync_at": "2026-02-07T10:30:00+09:00",
  "sync_counts": {
    "daily_logs": 1523,
    "test_records": 12,
    "test_results": 384,
    "photos": 45
  }
}
```

---

## 4. 기술 설계

### 4-1. 신규 DB 테이블

```sql
-- 사용자별 Google Drive 연결 설정
CREATE TABLE drive_sync_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Google OAuth 토큰 (암호화 저장)
  google_access_token TEXT,
  google_refresh_token TEXT,
  google_token_expires_at TIMESTAMPTZ,
  google_email VARCHAR(255),

  -- Drive 폴더 ID
  root_folder_id TEXT,          -- "Premuto" 폴더 ID

  -- 동기화 설정
  enabled BOOLEAN DEFAULT false,
  auto_sync BOOLEAN DEFAULT false,
  auto_sync_interval VARCHAR(20) DEFAULT 'weekly',  -- 'daily' | 'weekly' | 'monthly'
  sync_scope VARCHAR(20) DEFAULT 'both',            -- 'daily_logs' | 'test_results' | 'both'

  -- 상태 추적
  last_sync_at TIMESTAMPTZ,
  last_sync_status VARCHAR(20),  -- 'success' | 'error' | 'in_progress'
  last_sync_error TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_user_drive UNIQUE(user_id)
);

-- RLS: 본인만 접근
ALTER TABLE drive_sync_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own drive config" ON drive_sync_configs
  FOR ALL USING (auth.uid() = user_id);

-- 동기화 이력 로그
CREATE TABLE drive_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  sync_type VARCHAR(30) NOT NULL,  -- 'manual_full' | 'manual_daily' | 'manual_tests' | 'auto'
  status VARCHAR(20) NOT NULL,     -- 'started' | 'success' | 'error'

  -- 동기화 통계
  files_uploaded INTEGER DEFAULT 0,
  files_updated INTEGER DEFAULT 0,
  files_skipped INTEGER DEFAULT 0,
  bytes_transferred BIGINT DEFAULT 0,

  error_message TEXT,
  duration_ms INTEGER,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE drive_sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own sync logs" ON drive_sync_logs
  FOR ALL USING (auth.uid() = user_id);

-- 인덱스
CREATE INDEX idx_drive_sync_logs_user ON drive_sync_logs(user_id, created_at DESC);
```

### 4-2. 신규 API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/drive-sync/config` | 현재 연결 상태 및 설정 조회 |
| `POST` | `/api/drive-sync/connect` | Google OAuth 시작 (redirect URL 반환) |
| `GET` | `/api/drive-sync/callback` | OAuth 콜백 (토큰 수신 및 저장) |
| `POST` | `/api/drive-sync/disconnect` | 연결 해제 (토큰 삭제) |
| `POST` | `/api/drive-sync/sync` | 수동 동기화 실행 |
| `GET` | `/api/drive-sync/status` | 진행 중인 동기화 상태 폴링 |
| `GET` | `/api/drive-sync/history` | 동기화 이력 조회 |

### 4-3. 신규 라이브러리 파일

```
lib/
├── drive/
│   ├── google-auth.ts      # OAuth 2.0 토큰 관리 (발급, 갱신, 폐기)
│   ├── drive-client.ts     # Google Drive API 래퍼 (폴더 생성, 파일 업로드/갱신)
│   └── sync-engine.ts      # 동기화 로직 (증분 감지, 백업 실행, 에러 처리)
```

### 4-4. 신규 UI 페이지

```
app/
├── settings/
│   └── drive-sync/
│       └── page.tsx         # Google Drive 동기화 설정 페이지
```

---

## 5. 핵심 구현 상세

### 5-1. Google OAuth 2.0 흐름

```
[브라우저] POST /api/drive-sync/connect
  → 서버: Google OAuth URL 생성
    - client_id, redirect_uri, scope=drive.file
    - state 파라미터에 user_id 암호화
  → 브라우저: Google 동의 화면으로 리다이렉트

[Google] 사용자 승인 후
  → GET /api/drive-sync/callback?code=xxx&state=yyy
  → 서버: code → access_token + refresh_token 교환
  → drive_sync_configs에 토큰 저장
  → /settings/drive-sync로 리다이렉트
```

**필요한 OAuth 스코프**:
- `https://www.googleapis.com/auth/drive.file` — 앱이 생성한 파일만 접근 (최소 권한)

**환경 변수**:
```bash
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=https://premuto.app/api/drive-sync/callback
```

### 5-2. 토큰 관리

```typescript
// lib/drive/google-auth.ts

interface GoogleTokens {
  access_token: string
  refresh_token: string
  expires_at: Date
}

// 토큰 갱신 (만료 5분 전 자동)
async function getValidAccessToken(userId: string): Promise<string> {
  const config = await getDriveConfig(userId)
  if (config.google_token_expires_at > new Date(Date.now() + 5 * 60 * 1000)) {
    return config.google_access_token
  }
  // refresh_token으로 새 access_token 발급
  const newTokens = await refreshGoogleToken(config.google_refresh_token)
  await updateDriveConfig(userId, newTokens)
  return newTokens.access_token
}
```

### 5-3. 동기화 엔진 (증분 백업)

```typescript
// lib/drive/sync-engine.ts

async function syncToDrive(userId: string, scope: 'both' | 'daily_logs' | 'test_results') {
  const config = await getDriveConfig(userId)
  const accessToken = await getValidAccessToken(userId)
  const drive = new DriveClient(accessToken)

  // 1. 루트 폴더 확인/생성
  const rootFolderId = config.root_folder_id || await drive.createFolder('Premuto')

  // 2. 반려동물별 처리
  const pets = await getPets(userId)
  for (const pet of pets) {
    const petFolderId = await drive.ensureFolder(rootFolderId, pet.name)

    // 3. 일일 기록 동기화
    if (scope === 'both' || scope === 'daily_logs') {
      await syncDailyLogs(drive, petFolderId, pet, config.last_sync_at)
    }

    // 4. 혈액검사 동기화
    if (scope === 'both' || scope === 'test_results') {
      await syncTestResults(drive, petFolderId, pet, config.last_sync_at)
    }
  }

  // 5. 메타데이터 갱신
  await updateSyncMetadata(drive, rootFolderId, userId)
}
```

**증분 동기화 전략**:
- `last_sync_at` 이후 변경된 레코드만 처리
- 월별 Excel 파일은 해당 월에 변경이 있으면 전체 재생성 (덮어쓰기)
- 사진은 Drive에 이미 존재하면 건너뜀 (파일명 기반 확인)

### 5-4. 일일 기록 백업 포맷

월별 Excel 파일 (`daily-logs-2026-01.xlsx`):

| Sheet | 내용 |
|-------|------|
| `요약` | 일자별 통계 (식사총량, 음수총량, 배변횟수 등) |
| `상세기록` | 개별 기록 전체 (시간, 카테고리, 양, 단위, 메모, 약이름) |

기존 `lib/export/excel-exporter.ts` 패턴을 재사용.

### 5-5. 혈액검사 백업 포맷

전체 피벗 Excel (`blood-tests-all.xlsx`):

기존 `/api/export-excel` 엔드포인트의 결과물과 동일한 포맷. 기존 `excel-exporter.ts` 함수 직접 재사용.

---

## 6. 티어 통합

| 항목 | Free | Basic | Premium |
|------|------|-------|---------|
| Google Drive 연결 | X (잠금) | O | O |
| 수동 백업 | - | 2회/월 | 무제한 |
| 자동 백업 | - | X | O |
| 자동 백업 주기 | - | - | 매일/매주/매월 |

**티어 설정 추가 (`lib/tier.ts`)**:
```typescript
// DEFAULT_TIER_CONFIG에 추가
drive_sync_enabled: boolean      // Drive 연결 허용 여부
monthly_manual_sync_limit: number // 수동 동기화 월간 제한 (-1 = 무제한)
auto_sync_enabled: boolean       // 자동 동기화 허용 여부
```

**usage_logs action 추가**:
- `drive_sync` — 동기화 실행 (월간 제한 체크용)

---

## 7. 보안 고려사항

### 토큰 보안
- Google refresh_token은 DB에 저장 시 서버사이드 암호화 (`DRIVE_TOKEN_ENCRYPTION_KEY` 환경변수)
- access_token은 짧은 수명 (1시간), 필요 시 refresh
- 연결 해제 시 Google 토큰 폐기(revoke) API 호출 + DB 삭제

### 데이터 접근 범위
- `drive.file` 스코프: 앱이 생성한 파일만 접근 가능 (사용자의 다른 Drive 파일 접근 불가)
- RLS: drive_sync_configs, drive_sync_logs 모두 user_id 기반 격리

### 에러 처리
- Google API 오류 → 재시도 (3회, 지수 백오프)
- 토큰 만료 → 자동 갱신, 갱신 실패 시 재연결 요청
- 동기화 중 앱 종료 → 다음 동기화에서 이어서 처리

---

## 8. 구현 단계 (Phase)

### Phase 1: 기반 구축
1. Google Cloud Console 프로젝트 설정 (OAuth 2.0 클라이언트 ID 발급)
2. DB 마이그레이션 (`drive_sync_configs`, `drive_sync_logs`)
3. `lib/drive/google-auth.ts` — OAuth 흐름 (connect, callback, disconnect)
4. `lib/drive/drive-client.ts` — Drive API 래퍼 (폴더 CRUD, 파일 업로드)
5. API 엔드포인트: `/api/drive-sync/connect`, `/api/drive-sync/callback`, `/api/drive-sync/disconnect`

### Phase 2: 수동 동기화
6. `lib/drive/sync-engine.ts` — 동기화 로직 (일일기록 + 혈액검사)
7. API 엔드포인트: `/api/drive-sync/sync`, `/api/drive-sync/status`, `/api/drive-sync/history`
8. 설정 UI 페이지 (`/settings/drive-sync`)
9. 티어 연동 (Basic 이상만 사용, 월간 제한)

### Phase 3: 자동 동기화 (Premium)
10. Cron/스케줄러 설정 (Vercel Cron 또는 Supabase Edge Function)
11. 자동 동기화 주기 설정 UI
12. 동기화 알림 (이메일 또는 앱 내 알림)

### Phase 4: 고급 기능
13. 사진 백업 (Supabase Storage → Google Drive)
14. 원본 검사지 백업 (업로드된 PDF/이미지)
15. 관리자 대시보드에 동기화 통계 추가

---

## 9. 환경 변수 (추가 필요)

```bash
# Google OAuth 2.0
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=https://premuto.app/api/drive-sync/callback

# 토큰 암호화 키 (32바이트 랜덤)
DRIVE_TOKEN_ENCRYPTION_KEY=xxx
```

---

## 10. 의존성 (추가 필요)

```bash
npm install googleapis        # Google Drive API 클라이언트
# 또는 직접 REST API 호출 (의존성 최소화)
```

`googleapis` 패키지는 번들 크기가 크므로, Google Drive REST API를 직접 호출하는 방식도 고려할 수 있다. 필요한 API가 폴더 생성, 파일 업로드/갱신 정도이므로 직접 구현이 충분히 가능하다.

---

## 11. 대안 검토

| 방안 | 장점 | 단점 | 판정 |
|------|------|------|------|
| **A. Google Drive API 직접 연동** | 실시간 제어, 폴더 구조 커스텀 | OAuth 구현 필요, 토큰 관리 | **채택** |
| B. 다운로드 링크 제공 (수동) | 구현 간단 | UX 불편, 자동화 불가 | 보류 |
| C. Supabase → GCS → Drive 연동 | 서버 부하 적음 | 복잡한 파이프라인 | 기각 |
| D. 양방향 동기화 | 데이터 복원 가능 | 충돌 해결 복잡, 데이터 무결성 위험 | 기각 |

---

## 12. 리스크 및 완화

| 리스크 | 영향 | 완화 방안 |
|--------|------|-----------|
| Google API 할당량 초과 | 동기화 실패 | 사용자당 동기화 빈도 제한, 증분 동기화로 API 호출 최소화 |
| 토큰 탈취 | 사용자 Drive 접근 | 서버사이드 암호화, drive.file 최소 스코프 |
| 대용량 데이터 타임아웃 | 동기화 미완료 | 청크 단위 처리, 백그라운드 작업, 이어서 동기화 |
| Google OAuth 정책 변경 | 기능 중단 | Google Cloud Console 앱 검증(Verification) 완료 |
| Vercel 함수 실행 시간 제한 (10s~60s) | 대량 백업 실패 | Supabase Edge Function 또는 외부 워커 사용 |
