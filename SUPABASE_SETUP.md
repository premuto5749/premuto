# Supabase 설정 가이드

## 1. Supabase 프로젝트 생성

1. https://supabase.com 접속 및 로그인
2. "New Project" 클릭
3. 프로젝트 설정:
   - **Name**: `mimo-health-log`
   - **Database Password**: 안전한 비밀번호 생성 (저장 필수)
   - **Region**: `Northeast Asia (Seoul)` 선택
   - **Pricing Plan**: Free tier (개발용)
4. "Create new project" 클릭 (약 2분 소요)

## 2. API 키 확인

프로젝트 생성 완료 후:
1. 좌측 메뉴에서 **Settings** > **API** 클릭
2. 다음 정보 복사:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public** key: `eyJhbGci...` (공개 키)
   - **service_role** key: `eyJhbGci...` (서버 전용 키, 절대 노출 금지)

## 3. 환경변수 설정

프로젝트 루트에 `.env.local` 파일 생성:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# OpenAI (Phase 3에서 사용)
OPENAI_API_KEY=sk-your-openai-key-here
```

**⚠️ 주의**: `.env.local` 파일은 `.gitignore`에 포함되어 있어 Git에 커밋되지 않습니다.

## 4. 데이터베이스 마이그레이션 실행

### 방법 1: Supabase Dashboard (권장)

1. Supabase Dashboard에서 **SQL Editor** 클릭
2. "New query" 클릭
3. `supabase/migrations/001_initial_schema.sql` 파일 내용 복사
4. SQL Editor에 붙여넣기
5. "Run" 버튼 클릭
6. 성공 메시지 확인

### 방법 2: Supabase CLI (고급)

```bash
# Supabase CLI 설치
npm install -g supabase

# 로그인
npx supabase login

# 프로젝트 연결
npx supabase link --project-ref your-project-id

# 마이그레이션 실행
npx supabase db push
```

## 5. 데이터 확인

마이그레이션 실행 후 Supabase Dashboard에서 확인:

1. **Table Editor** 클릭
2. 생성된 테이블 확인:
   - `standard_items` (11개 행 - 미모 주요 관리 항목)
   - `item_mappings` (동의어 매핑 데이터)
   - `test_records` (빈 테이블)
   - `test_results` (빈 테이블)

## 6. TypeScript 타입 생성 (선택사항)

```bash
# Supabase CLI로 TypeScript 타입 자동 생성
npx supabase gen types typescript --project-id your-project-id > lib/supabase/database.types.ts
```

현재는 `lib/supabase/types.ts`에 수동으로 작성된 타입이 있으므로 선택사항입니다.

## 7. 연결 테스트

개발 서버 실행:

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속하여 Next.js 앱이 정상 작동하는지 확인.

## 트러블슈팅

### 마이그레이션 실패 시

- SQL 구문 오류: SQL Editor에서 오류 메시지 확인
- 권한 문제: Database Password가 올바른지 확인
- 테이블 이미 존재: 기존 테이블 삭제 후 재시도

### 연결 오류 시

- `.env.local` 파일 경로 확인 (프로젝트 루트에 위치)
- 환경변수 이름 확인 (`NEXT_PUBLIC_` 접두사 필수)
- 개발 서버 재시작 (`npm run dev` 종료 후 재실행)

## 다음 단계

Phase 2 완료 후 Phase 3로 진행:
- Upload & OCR 기능 구현
- GPT-4o Vision API 통합
