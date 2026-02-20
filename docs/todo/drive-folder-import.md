# Google Drive 폴더 가져오기 — 유실동물 전단지

> **상태**: 계획 완료, 구현 미착수
> **의존성**: Google 서비스 계정 키 설정 필요
> **작성일**: 2026-02-12

## Context

현재 유실동물 전단지 일괄 업로드는 ZIP 파일(최대 50MB) 방식만 지원한다. 이미지가 많거나 용량이 클 경우 ZIP을 만드는 과정도 번거롭고, 50MB 제한에 걸릴 수 있다.
Google Drive 특정 폴더에 이미지를 넣어두고, 관리자 페이지에서 해당 폴더 URL을 입력하면 서버가 직접 Drive에서 이미지를 다운로드하여 Supabase Storage에 저장하는 방식을 추가한다.

**기존 ZIP 업로드는 유지**, Drive 가져오기를 추가 옵션으로 제공한다.

---

## 핵심 설계 결정

### 서비스 계정(Service Account) JWT 인증

기존 Google Drive 연동은 사용자별 OAuth (`drive.file` 스코프)로, 앱이 만든 파일만 접근 가능하다. 외부 Drive 폴더를 읽으려면 다른 방식이 필요하다.

- **Google Service Account** 방식 채택 (기존 사용자 OAuth 플로우에 영향 없음)
- 환경변수 `GOOGLE_SERVICE_ACCOUNT_KEY`에 JSON 키 저장
- 관리자가 Drive 폴더를 서비스 계정 이메일에 공유하면 접근 가능
- Node.js `crypto` 모듈로 JWT 서명 → 추가 패키지 불필요

### 2단계 흐름 (조회 → 가져오기)

1. **GET**: Drive 폴더 이미지 목록 조회 + 중복 감지 (미리보기)
2. **POST**: 선택된 이미지만 다운로드 → Supabase Storage 업로드

---

## 변경 파일 목록

### 새 파일

| 파일 | 역할 |
|------|------|
| `lib/google-drive-service-account.ts` | 서비스 계정 JWT 인증 + Drive API (목록 조회, 파일 다운로드) |
| `app/api/admin/lost-animals/drive/route.ts` | GET: 폴더 조회 / POST: 이미지 가져오기 API |

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `app/api/admin/lost-animals/shared.ts` | `getExtensionFromMime()` 헬퍼 추가 |
| `app/admin/lost-animals/page.tsx` | "Google Drive 가져오기" 카드 섹션 추가 |

---

## 구현 상세

### 1. `lib/google-drive-service-account.ts` (신규)

```typescript
// 환경변수에서 서비스 계정 키 파싱
getServiceAccountKey(): ServiceAccountKey | null

// JWT 생성 → access_token 교환 (모듈 레벨 캐시, 만료 5분전 갱신)
getServiceAccountAccessToken(): Promise<string>

// Drive 폴더 내 이미지 파일 목록 (자동 페이지네이션)
// query: '{folderId}' in parents and mimeType contains 'image/' and trashed=false
listImagesInFolder(folderId: string): Promise<DriveFileInfo[]>

// 파일 바이너리 다운로드 (alt=media)
downloadFile(fileId: string): Promise<ArrayBuffer>
```

JWT 흐름:
1. `{alg: "RS256", typ: "JWT"}` 헤더
2. `{iss: client_email, scope: "drive.readonly", aud: token_uri, iat, exp}` 페이로드
3. `crypto.createSign('RSA-SHA256')` 서명
4. `POST token_uri` → `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer`
5. 응답의 `access_token` 캐시 (1시간)

### 2. `app/api/admin/lost-animals/drive/route.ts` (신규)

```
export const maxDuration = 60

GET /api/admin/lost-animals/drive?folderId=xxx
→ 관리자 권한 확인
→ 서비스 계정 설정 확인 (미설정 시 serviceAccountEmail만 반환)
→ listImagesInFolder(folderId)
→ 기존 flyer 파일명과 비교하여 isDuplicate, isOversized 플래그 첨부
→ 응답: { files, serviceAccountEmail }

POST /api/admin/lost-animals/drive
Body: { folderId, fileIds: string[], title }
→ 관리자 권한 확인
→ 각 파일 순차 처리: downloadFile → Supabase Storage 업로드 → Flyer 객체 생성
→ 파일명 패턴: {timestamp}_drive_{safeName}
→ 일괄 saveFlyerSettings
→ 응답: { data: Flyer[], failed: string[], skipped: string[] }
```

### 3. `app/admin/lost-animals/page.tsx` (수정)

ZIP 카드와 전단지 목록 카드 사이에 새 Card 추가:

**추가 state:**
```typescript
driveUrl, driveTitle, driveFiles[], driveServiceEmail
selectedDriveFiles: Set<string>
driveLoading, driveImporting
```

**UI 구조:**
```
Card: "Google Drive 가져오기"
├─ 설명: "Google Drive 폴더의 이미지를 가져옵니다"
├─ Input: Drive 폴더 URL 또는 폴더 ID
├─ Button: "폴더 조회"
├─ 서비스 계정 이메일 안내 (조회 시 표시)
├─ 이미지 목록 (체크박스 + 파일명 + 용량 + 중복/초과 뱃지)
│  ├─ 전체 선택/해제 토글
│  └─ max-h-60 overflow-y-auto 스크롤 영역
├─ Input: 공통 제목
└─ Button: "{N}개 가져오기"
```

---

## 환경변수

```
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...","client_email":"...@...iam.gserviceaccount.com","token_uri":"https://oauth2.googleapis.com/token"}
```

---

## 검증 방법

1. 서비스 계정 키를 환경변수에 설정
2. Google Drive에 테스트 폴더 생성, 서비스 계정 이메일에 "뷰어" 공유
3. 관리자 페이지에서 Drive 폴더 URL 입력 → "폴더 조회" 클릭
4. 이미지 목록이 표시되는지 확인 (중복/초과 뱃지 정상 표시)
5. 일부 이미지 선택 → "가져오기" 클릭
6. Supabase Storage에 이미지 업로드 확인
7. 전단지 목록에 새 항목 추가 확인
8. 같은 폴더 재조회 시 기존 파일에 "중복" 뱃지 표시 확인
9. `npm run build` 통과 확인
