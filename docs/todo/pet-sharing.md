# 펫 공유 (Pet Sharing) 기능 구현 계획

## Context

현재 Premuto는 "1 사용자 = N 반려동물" 구조. 가족 등 여러 사용자가 하나의 반려동물을 함께 관리할 수 없음.
이 기능은 `pet_members` 테이블을 도입하여 "1 반려동물 = N 사용자" 관계를 추가한다.

**결정 사항**: 2단계 권한(owner/member), 이메일 초대, 자동 마이그레이션, API signed URL 방식

---

## Phase 1: DB 마이그레이션 (`supabase/migrations/032_pet_sharing.sql`)

### 1-1. 신규 테이블 생성

**`pet_members`** — 핵심 접근 제어 테이블
```sql
CREATE TABLE pet_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'member')) DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_pet_member UNIQUE (pet_id, user_id)
);
CREATE INDEX idx_pet_members_user ON pet_members(user_id);
CREATE INDEX idx_pet_members_pet ON pet_members(pet_id);
```

**`pet_invitations`** — 초대 관리
```sql
CREATE TABLE pet_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email VARCHAR(255) NOT NULL,
  invited_user_id UUID REFERENCES auth.users(id),
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending','accepted','declined','expired')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  responded_at TIMESTAMPTZ
);
CREATE INDEX idx_invitations_email ON pet_invitations(invited_email);
CREATE INDEX idx_invitations_status ON pet_invitations(status);
```

### 1-2. 기존 데이터 자동 변환

```sql
INSERT INTO pet_members (pet_id, user_id, role)
SELECT id, user_id, 'owner' FROM pets
WHERE user_id IS NOT NULL
ON CONFLICT (pet_id, user_id) DO NOTHING;
```

### 1-3. RLS 정책 업데이트 (안전한 순서: CREATE 먼저 → DROP 나중에)

**변경 대상 테이블 5개**:
- `pets` — SELECT: owner OR pet_members / INSERT: owner만 / UPDATE,DELETE: owner만
- `daily_logs` — 모든 CRUD: `user_id = auth.uid()` OR `pet_members` 체크
- `test_records` — 동일 패턴
- `test_results` — test_records FK 체인 통해 간접 체크
- `medicine_presets` — SELECT만 pet_members 체크 (CUD는 user_id 직접 체크 유지)

**RLS 패턴** (모든 변경 테이블 공통):
```sql
-- 기존 user_id 체크를 fast path로 유지 + pet_members OR 조건 추가
auth.uid() = user_id
OR (pet_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM pet_members pm
  WHERE pm.pet_id = {table}.pet_id AND pm.user_id = auth.uid()
))
```

**변경 불필요 테이블**: user_settings, user_standard_items, user_item_aliases, user_item_mappings, user_profiles, usage_logs, user_roles, google_drive_*, hospitals, master 테이블들

### 1-4. pet_members 자체 RLS

- SELECT: 해당 펫의 멤버만 멤버 목록 조회
- INSERT: owner만 추가 가능 (또는 본인이 owner로 자기 등록)
- DELETE: owner가 제거 또는 본인 탈퇴

---

## Phase 2: 백엔드 헬퍼 및 API

### 2-1. `lib/pet-access.ts` (신규)

```typescript
checkPetAccess(supabase, userId, petId) → { hasAccess, role }
requirePetOwner(supabase, userId, petId) → boolean
getAccessiblePetIds(supabase, userId) → string[]
```

### 2-2. 기존 API 수정 (~10개 라우트)

| 라우트 | 변경 내용 |
|--------|----------|
| `app/api/pets/route.ts` | GET: pet_members JOIN으로 role 포함 반환. POST: pet_members(owner) 자동 생성 |
| `app/api/daily-logs/route.ts` | GET/POST/PATCH/DELETE: pet_id 있으면 pet_members 체크, 없으면 user_id 폴백 |
| `app/api/daily-logs/upload/route.ts` | 업로드 전 pet_id access 체크 추가 |
| `app/api/test-results/route.ts` | daily-logs와 동일 패턴 |
| `app/api/test-results-batch/route.ts` | 저장 전 pet_id access 체크 |
| `app/api/test-results/merge/route.ts` | 병합 전 pet_id access 체크 |
| `app/api/export-excel/route.ts` | pet_id 기반 필터링 |
| `app/api/daily-logs/export-detailed/route.ts` | pet_id 기반 필터링 |
| `app/api/medicine-presets/route.ts` | GET만 pet_members 체크 (CUD는 user_id 유지) |
| `app/api/account-stats/route.ts` | accessible pet IDs 기반 카운팅 |

### 2-3. Signed URL 변경 (`app/api/daily-logs/route.ts`)

`convertPathsToSignedUrls`에서 **service_role 클라이언트** 사용:
- `lib/supabase/service.ts`의 `createServiceClient()` 활용 (이미 존재)
- API에서 pet_members 접근 확인 후 → service_role로 signed URL 생성
- 기존 파일 경로(`uploads/{user_id}/...`) 변경 없음

### 2-4. 신규 API 라우트 3개

| 라우트 | 메서드 | 설명 |
|--------|--------|------|
| `app/api/pets/[petId]/members/route.ts` | GET/DELETE | 멤버 목록 조회, 멤버 제거/탈퇴 |
| `app/api/pets/[petId]/invitations/route.ts` | GET/POST/DELETE | 초대 목록/생성/취소 (owner) |
| `app/api/pets/invitations/route.ts` | GET/POST | 내가 받은 초대 조회, 수락/거절 |

### 2-5. 초대 플로우

1. Owner가 이메일 입력 → API가 `auth.users`에서 확인
2. 미가입 이메일 → "가입된 사용자만 초대 가능" 에러
3. 가입자 → `pet_invitations(status=pending)` 생성
4. 초대받은 사용자 → 앱 로딩 시 초대 배너 표시
5. 수락 → `pet_members(role=member)` 생성, invitation status=accepted
6. 거절 → invitation status=declined

---

## Phase 3: 프론트엔드

### 3-1. 타입 추가 (`types/index.ts`)

```typescript
// Pet 인터페이스에 추가
role?: 'owner' | 'member'

// 신규 인터페이스
PetMember { id, pet_id, user_id, role, email?, created_at }
PetInvitation { id, pet_id, invited_email, status, pet_name?, inviter_email?, ... }
```

### 3-2. PetContext 확장 (`contexts/PetContext.tsx`)

- `ownedPets` / `sharedPets` derived state 추가
- `pendingInvitations` 상태 + `refreshInvitations()` 추가
- `fetchPets()` 응답에서 `role` 필드 처리

### 3-3. UI 변경

| 컴포넌트 | 변경 |
|---------|------|
| `components/layout/AppHeader.tsx` | 펫 드롭다운에 "내 반려동물" / "공유된 반려동물" 섹션 구분 + 초대 알림 배지 |
| `app/settings/page.tsx` | 펫 관리 탭에 공유 관리 섹션 (멤버 목록, 초대 폼) |
| `components/PetInvitationBanner.tsx` (신규) | 레이아웃 상단에 초대 수락/거절 배너 |
| `components/settings/PetSharingSection.tsx` (신규) | 멤버 관리 + 초대 UI |
| `components/RequirePetGuard.tsx` | 변경 불필요 (공유 펫도 pets[]에 포함되므로) |

---

## Phase 4: 엣지 케이스 처리

| 상황 | 처리 |
|------|------|
| pet_id가 NULL인 기존 레코드 | user_id 체크로만 접근 (RLS의 OR 조건) |
| owner가 member 제거 | member 접근 즉시 차단, member가 생성한 기록은 pet에 유지 |
| owner가 펫 삭제 | pet_members CASCADE 삭제, daily_logs.pet_id → NULL (creator만 접근) |
| 자기 자신 초대 | API에서 거부 |
| 중복 초대 | UNIQUE 제약조건으로 방지 |
| 만료된 초대 수락 | expires_at 체크 후 거부 |

---

## Phase 5: 배포 전략 (단계적)

**Step 1**: DB 마이그레이션만 배포 → 기존 기능 정상 동작 확인 (RLS가 기존 user_id 체크 포함)
**Step 2**: 백엔드 API 수정 배포 → 읽기 작업부터 확인
**Step 3**: 프론트엔드 배포 → 초대/공유 UI 활성화

---

## 검증 방법

1. **마이그레이션 후**: 모든 `pets.user_id`에 대응하는 `pet_members(owner)` 존재 확인
2. **기존 플로우 테스트**: 단일 사용자 일일기록 CRUD, 혈액검사 OCR→저장→조회
3. **공유 테스트 매트릭스**:

| 작업 | Owner | Member | 비멤버 |
|------|-------|--------|-------|
| 펫 프로필 조회 | O | O | X |
| 펫 프로필 수정 | O | X | X |
| 일일 기록 추가/수정/조회 | O | O | X |
| 사진 조회 (signed URL) | O | O | X |
| 혈액검사 조회 | O | O | X |
| 공유 관리 | O | X | X |

4. **`npm run build`** 성공 확인
5. **Vercel Preview** 배포 후 수동 E2E 테스트

---

## 수정 대상 파일 목록

### 신규 생성
- `supabase/migrations/032_pet_sharing.sql`
- `lib/pet-access.ts`
- `app/api/pets/[petId]/members/route.ts`
- `app/api/pets/[petId]/invitations/route.ts`
- `app/api/pets/invitations/route.ts`
- `components/PetInvitationBanner.tsx`
- `components/settings/PetSharingSection.tsx`

### 수정
- `types/index.ts` — Pet 인터페이스 + 신규 타입
- `contexts/PetContext.tsx` — 공유 펫 + 초대 상태
- `components/layout/AppHeader.tsx` — 펫 드롭다운 구분
- `app/settings/page.tsx` — 공유 관리 섹션 추가
- `app/api/pets/route.ts` — pet_members 연동
- `app/api/daily-logs/route.ts` — pet_members 체크 + service_role signed URL
- `app/api/daily-logs/upload/route.ts` — 접근 체크
- `app/api/test-results/route.ts` — pet_members 체크
- `app/api/test-results-batch/route.ts` — 접근 체크
- `app/api/medicine-presets/route.ts` — GET에 pet_members 체크
- `app/api/account-stats/route.ts` — accessible pet 기반 카운팅
