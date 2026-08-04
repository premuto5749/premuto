# Design: 진료 녹음 기록 기능 (Vet Visit Recording)

## FR-1: DB 스키마 (vet_visits, consent_logs)

### 설명

진료 기록 메인 테이블과 면책 동의 로그 테이블을 생성한다.

### vet_visits 테이블

```sql
CREATE TABLE vet_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL,
  hospital_name TEXT,
  vet_name TEXT,
  diagnosis TEXT[],                    -- 진단명 배열
  prescriptions JSONB DEFAULT '[]',   -- [{drug_name, dosage, frequency, duration}]
  procedures TEXT,                     -- 시술/처치 내용
  next_visit_date DATE,
  vet_instructions TEXT,               -- 수의사 지시사항
  cost INTEGER,                        -- 비용 (원)
  transcript TEXT,                     -- Whisper 전사 원문
  audio_file_path TEXT,                -- Supabase Storage 경로
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ               -- soft delete
);
```

### consent_logs 테이블

```sql
CREATE TABLE consent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL,          -- 'vet_visit_recording'
  agreed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'
);
```

### RLS 정책

- vet_visits: `auth.uid() = user_id` (SELECT, INSERT, UPDATE, DELETE)
- consent_logs: `auth.uid() = user_id` (SELECT, INSERT)
- Admin은 모든 레코드 SELECT 가능

### AC (Acceptance Criteria)

**성공**:
- [ ] `vet_visits` 테이블이 생성되고, RLS가 활성화됨
- [ ] `consent_logs` 테이블이 생성되고, RLS가 활성화됨
- [ ] user_id, pet_id에 인덱스가 설정됨
- [ ] visit_date + user_id + pet_id 조합으로 조회 가능
- [ ] soft delete (deleted_at) 동작

**실패/에러**:
- [ ] 다른 사용자의 vet_visits를 조회하면 빈 결과 반환 (RLS)
- [ ] consent_logs에 다른 사용자의 동의를 INSERT 시도하면 거부

**엣지케이스**:
- [ ] pet 삭제 시 관련 vet_visits도 CASCADE 삭제
- [ ] prescriptions가 빈 배열 `[]`일 때 정상 저장/조회

---

## FR-2: Storage 버킷 (vet-recordings)

### 설명

오디오 파일 저장을 위한 Supabase Storage 버킷을 생성한다.

### 경로 규칙

`vet-recordings/{user_id}/{uuid}.{ext}`

### AC

**성공**:
- [ ] `vet-recordings` 버킷이 생성됨
- [ ] 본인 폴더에 파일 업로드 가능
- [ ] 본인 파일에 대해 Signed URL 생성 가능

**실패/에러**:
- [ ] 다른 사용자의 폴더에 업로드 시도 → 거부
- [ ] 25MB 초과 파일 업로드 시 → 413 에러

**엣지케이스**:
- [ ] 같은 이름의 파일을 다시 업로드 → UUID 기반이므로 충돌 없음

---

## FR-3: STT + 구조화 API (`POST /api/vet-visits/transcribe`)

### 설명

오디오 파일을 받아 Whisper API로 전사하고, Claude API로 진료 정보를 구조화 추출한다.

### 요청

```
POST /api/vet-visits/transcribe
Content-Type: multipart/form-data

- file: 오디오 파일 (mp3, m4a, wav, webm, ogg, flac)
- pet_id: UUID
- consent_agreed: "true" (면책 동의 확인)
```

### 응답 (200)

```json
{
  "transcript": "전사 텍스트 전문...",
  "structured": {
    "visit_date": "2026-03-16",
    "hospital_name": "○○동물병원",
    "vet_name": "김수의사",
    "diagnosis": ["췌장염", "탈수"],
    "prescriptions": [
      {"drug_name": "세레니아", "dosage": "1mg/kg", "frequency": "1일 1회", "duration": "3일"}
    ],
    "procedures": "수액 치료 500ml",
    "next_visit_date": "2026-03-19",
    "vet_instructions": "3일간 금식 후 처방식이 소량 급여",
    "cost": 350000
  },
  "audio_file_path": "vet-recordings/{user_id}/{uuid}.m4a"
}
```

### 처리 흐름

1. 인증 확인
2. consent_agreed 확인 → consent_logs INSERT
3. 티어 월간 사용량 체크 → 초과 시 403
4. 파일 유효성 (크기 25MB, 형식, 길이 추정)
5. Supabase Storage 업로드
6. OpenAI Whisper API 호출 (language: "ko")
7. Claude API 호출 (구조화 프롬프트)
8. 결과 반환 (아직 DB 저장하지 않음 — 사용자 검수 후 저장)

### AC

**성공**:
- [ ] m4a 파일 업로드 → 전사 텍스트 + 구조화 결과 반환
- [ ] consent_logs에 동의 기록이 저장됨 (user_id, consent_type, ip, user_agent)
- [ ] usage_logs에 `vet_visit_transcribe` 액션이 기록됨
- [ ] 오디오 파일이 Supabase Storage에 저장됨

**실패/에러**:
- [ ] consent_agreed 미전송 → 400 "면책 동의가 필요합니다"
- [ ] 25MB 초과 → 400 "파일이 너무 큽니다 (최대 25MB)"
- [ ] 지원하지 않는 형식 → 400 "지원하지 않는 파일 형식입니다"
- [ ] 티어 한도 초과 → 403 `{ used, limit, tier }` 반환
- [ ] Whisper API 실패 → 502 "음성 인식에 실패했습니다. 다시 시도해주세요"
- [ ] Claude API 실패 → 구조화 없이 전사 텍스트만 반환 (degraded response)

**엣지케이스**:
- [ ] 진료 내용이 아닌 녹음 → AI가 추출 가능한 필드만 채우고 나머지 빈 값
- [ ] 아주 짧은 녹음 (5초) → 전사 텍스트가 거의 없어도 정상 처리
- [ ] 노이즈가 심한 녹음 → 전사 품질 낮지만 에러 없이 반환

---

## FR-4: CRUD API (`/api/vet-visits`)

### 설명

진료 기록의 생성/조회/수정/삭제를 처리한다.

### 엔드포인트

| Method | 경로 | 설명 |
|--------|------|------|
| GET | `/api/vet-visits?pet_id=&date=` | 목록 조회 (pet별, 날짜 필터) |
| POST | `/api/vet-visits` | 새 기록 저장 |
| PATCH | `/api/vet-visits?id=` | 기록 수정 |
| DELETE | `/api/vet-visits?id=` | soft delete |

### AC

**성공**:
- [ ] POST: 구조화 결과를 수정 후 저장 → vet_visits INSERT, 201 반환
- [ ] GET: pet_id로 조회 → 해당 반려동물의 진료기록 목록 반환 (deleted_at IS NULL)
- [ ] GET: date 파라미터로 특정 날짜 기록 조회
- [ ] PATCH: 진단명, 처방, 지시사항 등 수정 → updated_at 갱신
- [ ] DELETE: deleted_at 설정 (soft delete)

**실패/에러**:
- [ ] pet_id 없이 GET → 400
- [ ] 존재하지 않는 id로 PATCH/DELETE → 404
- [ ] 다른 사용자의 기록 수정 시도 → RLS에 의해 404 (빈 결과)

**엣지케이스**:
- [ ] prescriptions에 빈 배열 저장 → 정상
- [ ] diagnosis에 빈 배열 저장 → 정상
- [ ] cost가 null → 비용 미입력으로 정상 처리

---

## FR-5: 진료기록 페이지 UI (`/vet-visits`)

### 설명

진료 기록 목록 + 업로드 + 상세 보기/편집 페이지.

### UI 구성

1. **상단**: 페이지 타이틀 + 녹음 업로드 버튼
2. **목록**: 날짜별 카드 리스트 (진료일, 병원, 진단 요약)
3. **업로드 플로우**:
   - 면책 동의 체크박스 + 파일 선택
   - 업로드 → 로딩 (STT 진행 중...)
   - 결과 미리보기 (구조화 양식 + 전사 원문 토글)
   - 검수/수정 → 저장
4. **상세 보기**: 카드 클릭 → 진료 기록 상세 (수정/삭제 가능)

### AC

**성공**:
- [ ] 녹음 업로드 버튼 클릭 → 면책 동의 + 파일 선택 UI 표시
- [ ] 동의 체크 + 파일 선택 → 업로드 시작, 로딩 스피너 표시
- [ ] STT 완료 → 구조화 양식이 자동 채워진 편집 폼 표시
- [ ] 사용자가 필드를 수정하고 저장 → 목록에 새 카드 추가
- [ ] 기존 기록 카드 클릭 → 상세 보기, 수정 버튼 표시
- [ ] 삭제 버튼 → confirm 다이얼로그 → soft delete → 목록에서 제거

**실패/에러**:
- [ ] 티어 초과 시 → "이번 달 녹음 분석 횟수를 모두 사용했습니다 (Free: 1회/월)" 토스트
- [ ] 업로드 중 네트워크 에러 → "업로드에 실패했습니다. 다시 시도해주세요" 토스트
- [ ] STT 결과가 비어있을 때 → 빈 양식 표시 + "녹음 내용을 인식하지 못했습니다" 안내

**엣지케이스**:
- [ ] 진료 기록이 없는 상태 → "아직 진료 기록이 없습니다" 빈 상태 표시
- [ ] 전사 원문 토글 → 긴 텍스트를 접기/펼치기로 처리
- [ ] 모바일에서 파일 선택 → 기기의 오디오 파일 선택기 동작

---

## FR-6: 면책 동의 시스템

### 설명

업로드 시 면책 조항에 동의해야만 진행 가능. 동의 내역은 DB에 기록.

### 면책 문구

> 본 녹음 파일은 상호 동의하에 적법하게 녹음된 것이며, 미모의 하루는 녹음 내용의 정확성, 완전성, 또는 녹음 행위의 적법성에 대해 어떠한 책임도 지지 않습니다. AI 분석 결과는 참고용이며 의료적 판단의 근거로 사용할 수 없습니다.

### AC

**성공**:
- [ ] 체크박스 미체크 → 업로드 버튼 비활성화
- [ ] 체크박스 체크 → 업로드 버튼 활성화
- [ ] 업로드 시 consent_logs에 기록: user_id, consent_type='vet_visit_recording', ip_address, user_agent, agreed_at

**실패/에러**:
- [ ] consent_agreed 없이 API 호출 → 400

**엣지케이스**:
- [ ] 같은 사용자가 여러 번 동의 → 매번 새 로그 INSERT (중복 허용)

---

## FR-7: 티어 제한 연동

### 설명

`lib/tier.ts`에 `monthly_vet_visit_limit` 필드를 추가하고, 월간 사용량을 체크한다.

### 티어별 제한

| 티어 | 월간 횟수 |
|------|----------|
| Free | 1 |
| Basic | 5 |
| Premium | -1 (무제한) |

### 변경 파일

- `lib/tier.ts`: TierConfig에 `monthly_vet_visit_limit` 추가, `checkMonthlyUsageLimit`에 분기 추가
- `app/api/admin/tier-config`: 관리자 설정 UI에 필드 추가

### AC

**성공**:
- [ ] Free 사용자가 월 1회 사용 후 → 2번째 시도 시 403
- [ ] Basic 사용자가 월 5회 사용 후 → 6번째 시도 시 403
- [ ] Premium 사용자 → 무제한 사용 가능
- [ ] GET /api/tier 응답에 vet_visit 사용량/한도 포함

**실패/에러**:
- [ ] 한도 초과 시 → `{ allowed: false, used: N, limit: M, tier: "free" }` 반환

**엣지케이스**:
- [ ] 월 경계 (3/31 → 4/1) → 사용량 리셋 확인
- [ ] 관리자가 tier_config에서 한도를 변경 → 즉시 반영

---

## FR-8: 양방향 참조 연동

### 설명

대시보드, 일일기록 페이지에서 동일 날짜의 진료 기록 링크를 표시하고, 진료기록 페이지에서도 역방향 링크를 표시한다.

### UI

- **대시보드**: 검사 날짜와 동일한 vet_visits가 있으면 🩺 아이콘 + "진료기록 보기" 링크
- **일일기록**: 해당 날짜에 vet_visits가 있으면 상단에 "진료기록 있음" 배너 + 링크
- **진료기록**: 해당 날짜의 혈액검사/일일기록 존재 여부 표시 + 각 페이지 링크

### AC

**성공**:
- [ ] 대시보드에서 진료일과 동일한 날짜의 검사 결과 옆에 🩺 링크 표시
- [ ] 일일기록에서 진료일과 동일한 날짜면 상단 배너 표시
- [ ] 진료기록 상세에서 "혈액검사 결과 보기", "일일기록 보기" 링크 표시
- [ ] 링크 클릭 → 해당 페이지로 이동 (날짜 파라미터 포함)

**실패/에러**:
- [ ] 연동 데이터 조회 실패 → 링크만 숨김, 페이지 자체는 정상 동작

**엣지케이스**:
- [ ] 같은 날 진료기록이 여러 개 → "N건의 진료기록" 으로 표시
- [ ] 진료기록은 있으나 혈액검사/일일기록이 없는 날 → 해당 링크만 미표시

---

## 구현 순서

| 순서 | FR | 변경 파일 | 비고 |
|------|-----|----------|------|
| 1 | FR-1 | `supabase/migrations/049_vet_visits.sql` | DB 스키마 |
| 2 | FR-2 | Migration 내 Storage 설정 | 버킷 생성 |
| 3 | FR-7 | `lib/tier.ts` | 티어 필드 추가 (구현 초기에 필요) |
| 4 | FR-3 | `app/api/vet-visits/transcribe/route.ts` | 핵심 API |
| 5 | FR-4 | `app/api/vet-visits/route.ts` | CRUD API |
| 6 | FR-6 | FR-3, FR-5에 통합 | 면책 로직 |
| 7 | FR-5 | `app/vet-visits/page.tsx`, 컴포넌트들 | 메인 UI |
| 8 | FR-8 | `app/dashboard/page.tsx`, `app/daily-log/page.tsx` 등 | 연동 |
| 9 | - | `components/layout/Sidebar.tsx` | 메뉴 추가 |
