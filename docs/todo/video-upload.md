# 동영상 업로드 기능 구현

> **상태**: 계획 완료, 구현 미착수
> **의존성**: Google Drive 연동 (완료됨)
> **작성일**: 2026-02-21

## Context

Google Drive 연동은 완료되었으나, 현재 앱은 이미지만 업로드 가능하여 Drive 연동의 실질적 가치가 낮음.
동영상(발작, 호흡 패턴, 걸음걸이 등) 기록이 반려동물 건강 관리에 핵심적이므로, 동영상 업로드를 추가한다.

**핵심 설계**: 동영상은 Google Drive에만 저장 (Supabase에는 썸네일만). Vercel 4.5MB 제한을 우회하기 위해 Google Drive Resumable Upload 사용.

## 요구사항 요약

- 동영상: Google Drive에만 저장, 썸네일만 Supabase Storage
- 기록당 최대 2개, 파일당 100MB 제한
- Basic+ 티어 전용 (Drive 연결 필수)
- 앱 내 `<video>` 재생 (서버 프록시)

---

## Phase 1: Foundation (DB + 타입 + 티어)

### 1-1. DB 마이그레이션 (`supabase/migrations/031_daily_logs_video.sql`)

```sql
ALTER TABLE daily_logs
ADD COLUMN video_urls JSONB DEFAULT '[]'::jsonb;

-- google_drive_sync_log source_type CHECK 확장
ALTER TABLE google_drive_sync_log
DROP CONSTRAINT google_drive_sync_log_source_type_check;

ALTER TABLE google_drive_sync_log
ADD CONSTRAINT google_drive_sync_log_source_type_check
CHECK (source_type IN ('daily_log_photo', 'ocr_source', 'daily_log_video'));
```

### 1-2. 타입 정의 (`types/index.ts`)

```typescript
export interface VideoMeta {
  drive_file_id: string      // Google Drive 파일 ID
  thumbnail_path: string     // Supabase Storage 경로
  file_name: string          // 원본 파일명
  mime_type: string          // video/mp4 등
  size_bytes: number
}
```

- `DailyLog`에 `video_urls: VideoMeta[]` 추가
- `DailyLogInput`에 `video_urls?: VideoMeta[]` 추가

### 1-3. 티어 설정 (`lib/tier.ts`)

`TierConfig`에 2개 필드 추가:
- `daily_log_max_videos: number` — free: 0, basic: 2, premium: 2
- `daily_log_max_video_size_mb: number` — free: 0, basic: 100, premium: 100

---

## Phase 2: Server (Drive 함수 + API)

### 2-1. Resumable Upload 함수 (`lib/google-drive.ts`)

새 함수 `createResumableUpload(accessToken, folderId, fileName, mimeType, fileSize)`:
- `POST ${GOOGLE_UPLOAD_API}/files?uploadType=resumable` (기존 상수 재사용)
- `X-Upload-Content-Type`, `X-Upload-Content-Length` 헤더
- Response의 `Location` 헤더 반환 (pre-authenticated upload URL)

### 2-2. Sync 로그 함수 export (`lib/google-drive-upload.ts`)

- `createSyncLog`, `updateSyncLog`, `updateLastSyncAt` 를 export로 변경
- `createSyncLog`의 sourceType 유니언에 `'daily_log_video'` 추가

### 2-3. API: 업로드 시작 (`app/api/daily-logs/upload-video/route.ts`)

**POST** — Resumable upload 세션 생성

Request:
```json
{ "fileName": "video.mp4", "mimeType": "video/mp4", "fileSize": 52428800, "petId": "uuid", "loggedAt": "2026-02-10" }
```

로직:
1. Auth + 티어 확인 (daily_log_max_videos > 0)
2. Drive 연결 확인 (hasActiveDriveConnection)
3. 파일 크기 검증 (≤ 100MB)
4. 반려동물 이름 조회 → Drive 폴더 생성 (`ensureFolderPath`)
5. `createResumableUpload()` 호출
6. Sync log 생성 (status: 'uploading')
7. `{ uploadUrl, syncLogId }` 반환

### 2-4. API: 업로드 완료 (`app/api/daily-logs/upload-video/complete/route.ts`)

**POST** — 클라이언트가 Drive 업로드 완료 후 호출

Request: `{ "syncLogId": "uuid", "driveFileId": "drive-id" }`

로직: sync log 상태 → 'success', drive_file_id 기록, last_sync_at 갱신

### 2-5. API: 비디오 스트리밍 프록시 (`app/api/daily-logs/video/[fileId]/route.ts`)

**GET** — Drive에서 영상을 프록시 스트리밍

로직:
1. Auth → `getClient(userId)` 로 Drive 토큰 획득
2. `GET https://www.googleapis.com/drive/v3/files/{fileId}?alt=media` (Authorization 헤더)
3. Range 헤더 포워딩 (시킹 지원, 206 Partial Content)
4. `Accept-Ranges: bytes`, `Cache-Control: private, max-age=3600`
5. `maxDuration: 60` 설정

### 2-6. daily-logs API 수정 (`app/api/daily-logs/route.ts`)

- **GET**: `video_urls`의 `thumbnail_path` → Signed URL 변환
- **POST**: `video_urls` 저장
- **PATCH**: `video_urls` 업데이트 지원

---

## Phase 3: Client (썸네일 + UI)

### 3-1. 동영상 썸네일 생성 (`lib/video-thumbnail.ts`)

새 유틸리티:
- `<video>` 엘리먼트로 파일 로드
- `currentTime = 1초` (또는 영상 길이의 10%)
- Canvas로 프레임 캡처, max 640px, JPEG 70%
- 실패 시 null 반환 (기본 아이콘 폴백)

### 3-2. QuickLogModal 수정 (`components/daily-log/QuickLogModal.tsx`)

**새 상태**:
- `videos: File[]`, `videoThumbnails: File[]`, `videoUploadProgress: number[]`
- `canUploadVideo: boolean` (tier + Drive 연결 확인)

**UI 추가** (사진 영역 아래):
- 동영상 버튼 (`accept="video/*"`, 최대 2개)
- 썸네일 미리보기 + 삭제 버튼
- 업로드 진행률 바 (XMLHttpRequest `upload.onprogress`)
- Drive 미연결 시 비활성 힌트 표시

**업로드 플로우**:
1. 썸네일 → 기존 `/api/daily-logs/upload` 으로 Supabase에 저장
2. `POST /api/daily-logs/upload-video` → `{ uploadUrl, syncLogId }` 받기
3. `XMLHttpRequest` PUT으로 Drive에 직접 업로드 (진행률 추적)
4. Google 응답에서 `driveFileId` 추출
5. `POST /api/daily-logs/upload-video/complete` 호출
6. `VideoMeta` 구성 → daily log POST에 포함

### 3-3. Timeline 수정 (`components/daily-log/Timeline.tsx`)

**카드 표시**:
- 동영상 아이콘 + 개수 배지 (사진 아이콘 옆)

**상세 보기**:
- 사진 그리드 아래 동영상 썸네일 (play 아이콘 오버레이)
- 클릭 → 비디오 플레이어 Dialog

**비디오 플레이어**:
```html
<video controls autoPlay src="/api/daily-logs/video/{driveFileId}" />
```

---

## 수정 파일 목록

| 파일 | 변경 | 유형 |
|------|------|------|
| `supabase/migrations/031_daily_logs_video.sql` | video_urls 컬럼 + CHECK 확장 | 신규 |
| `types/index.ts` | VideoMeta, DailyLog/Input 확장 | 수정 |
| `lib/tier.ts` | 동영상 제한 필드 추가 | 수정 |
| `lib/google-drive.ts` | createResumableUpload() | 수정 |
| `lib/google-drive-upload.ts` | export + source_type 확장 | 수정 |
| `lib/video-thumbnail.ts` | 썸네일 생성 유틸 | 신규 |
| `app/api/daily-logs/upload-video/route.ts` | 업로드 세션 생성 | 신규 |
| `app/api/daily-logs/upload-video/complete/route.ts` | 업로드 완료 확인 | 신규 |
| `app/api/daily-logs/video/[fileId]/route.ts` | 스트리밍 프록시 | 신규 |
| `app/api/daily-logs/route.ts` | video_urls 처리 | 수정 |
| `components/daily-log/QuickLogModal.tsx` | 동영상 선택/업로드 UI | 수정 |
| `components/daily-log/Timeline.tsx` | 동영상 표시/재생 | 수정 |

---

## 검증 방법

1. `npx supabase db push` → video_urls 컬럼 확인
2. Basic 유저 + Drive 연결 → 동영상 선택 → 썸네일 생성 확인
3. 업로드 진행률 → Drive에 파일 저장 확인
4. Timeline에서 동영상 썸네일 + play 아이콘 확인
5. 클릭 → 앱 내 비디오 재생 + 시킹 동작 확인
6. Free 유저 → 동영상 버튼 비활성 확인
7. Drive 미연결 Basic 유저 → "Drive 연결 필요" 안내 확인
