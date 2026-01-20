# Deployment Guide - Mimo Health Log

이 문서는 Mimo Health Log 애플리케이션을 Vercel에 배포하는 방법을 설명합니다.

## 📋 사전 요구사항

배포하기 전에 다음을 준비해주세요:

1. **Supabase 프로젝트 설정 완료**
   - [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) 가이드를 따라 데이터베이스 마이그레이션 완료
   - Supabase Project URL 및 Anon Key 확보

2. **OpenAI API Key**
   - GPT-4o 모델 접근 권한이 있는 OpenAI API Key

3. **Vercel 계정**
   - https://vercel.com 에서 무료 계정 생성

## 🚀 Vercel 배포 방법

### Option 1: GitHub 연동 배포 (권장)

#### 1단계: GitHub 저장소 연결

1. Vercel 대시보드 접속: https://vercel.com/dashboard
2. **"Add New..." → "Project"** 클릭
3. GitHub 저장소 연결
4. `premuto` 저장소 선택 후 **Import** 클릭

#### 2단계: 프로젝트 설정

**Framework Preset**: Next.js (자동 감지)

**Root Directory**: `./` (프로젝트 루트)

**Build Command**: `npm run build` (기본값)

**Output Directory**: `.next` (기본값)

**Install Command**: `npm install` (기본값)

#### 3단계: 환경 변수 설정

"Environment Variables" 섹션에서 다음 변수들을 추가:

| Variable Name | Value | Description |
|--------------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGc...` | Supabase Anonymous Key |
| `OPENAI_API_KEY` | `sk-...` | OpenAI API Key (GPT-4o) |

**중요**:
- `NEXT_PUBLIC_*` 변수는 브라우저에 노출되므로 공개 키만 사용
- `OPENAI_API_KEY`는 서버 전용이므로 절대 `NEXT_PUBLIC_` 접두사 사용 금지

#### 4단계: 배포 시작

**Deploy** 버튼 클릭 → 자동 빌드 및 배포 (약 2-3분 소요)

#### 5단계: 배포 확인

배포 완료 후:
1. Vercel이 제공하는 URL 접속 (예: `https://premuto-xxx.vercel.app`)
2. 홈페이지 → 업로드 → OCR → 검수 → 저장 → 대시보드 워크플로우 테스트

---

### Option 2: Vercel CLI 배포

로컬에서 직접 배포하려면:

#### 1단계: Vercel CLI 설치

```bash
npm install -g vercel
```

#### 2단계: 로그인

```bash
vercel login
```

#### 3단계: 환경 변수 설정

`.env.local` 파일을 Vercel에 수동 등록:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
# 값 입력 프롬프트에서 Supabase URL 입력

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
# Anon Key 입력

vercel env add OPENAI_API_KEY
# OpenAI Key 입력
```

#### 4단계: 배포 실행

**프리뷰 배포** (테스트용):
```bash
vercel
```

**프로덕션 배포**:
```bash
vercel --prod
```

---

## 🔍 배포 후 확인 사항

### 1. 기능 테스트 체크리스트

- [ ] 홈페이지가 정상적으로 로드되는가?
- [ ] 파일 업로드 페이지에서 이미지/PDF 업로드 가능한가?
- [ ] OCR 처리가 정상적으로 작동하는가? (GPT-4o 호출)
- [ ] 검수 페이지에서 항목 매핑이 정상적으로 표시되는가?
- [ ] 데이터 저장 후 대시보드에 표시되는가?
- [ ] 피벗 테이블이 정상적으로 렌더링되는가?
- [ ] 항목 클릭 시 시계열 그래프가 열리는가?

### 2. Supabase 연결 확인

Vercel 배포 후 Supabase 대시보드에서:

1. **Settings → API** 이동
2. **URL**이 환경 변수와 일치하는지 확인
3. **anon/public key**가 정확한지 확인
4. RLS (Row Level Security) 정책이 활성화되어 있는지 확인

### 3. OpenAI API 할당량 확인

- OpenAI Dashboard (https://platform.openai.com/usage) 에서 API 사용량 모니터링
- 초과 시 요금 청구 또는 제한 발생 가능

---

## 🔧 트러블슈팅

### 문제 1: "Failed to fetch" 에러 (Supabase 연결 실패)

**원인**: 환경 변수가 잘못 설정됨

**해결**:
```bash
# Vercel 대시보드 → Settings → Environment Variables에서 재확인
# 또는 CLI로 확인:
vercel env ls
```

### 문제 2: OCR이 작동하지 않음

**원인**: OPENAI_API_KEY 누락 또는 만료

**해결**:
1. OpenAI 대시보드에서 키 확인
2. Vercel 환경 변수에 올바른 키 재등록
3. **Deployments → Redeploy** 실행

### 문제 3: 빌드 실패 (Type errors)

**원인**: TypeScript 타입 에러

**해결**:
```bash
# 로컬에서 타입 체크
npm run lint
npm run build

# 에러 수정 후 푸시
git add .
git commit -m "Fix: Type errors"
git push
```

### 문제 4: 이미지 업로드 후 OCR 타임아웃

**원인**: Vercel Serverless Function 기본 타임아웃 (10초) 초과

**해결**: `vercel.json`에 타임아웃 설정 추가
```json
{
  "functions": {
    "app/api/ocr/route.ts": {
      "maxDuration": 30
    }
  }
}
```

---

## 📊 모니터링 및 로그

### Vercel 로그 확인

**실시간 로그**:
```bash
vercel logs <deployment-url> --follow
```

**대시보드에서 확인**:
- Vercel 프로젝트 → Deployments → [최신 배포] → Runtime Logs

### Supabase 로그 확인

- Supabase 대시보드 → Logs
- API 호출 기록, 쿼리 실행 시간 확인 가능

---

## 🌍 커스텀 도메인 설정 (선택사항)

### 1. 도메인 연결

Vercel 대시보드에서:

1. **Settings → Domains**
2. **Add Domain** 클릭
3. 소유한 도메인 입력 (예: `mimo-health.com`)
4. DNS 설정 안내에 따라 도메인 제공업체에서 A/CNAME 레코드 추가

### 2. SSL 인증서

Vercel은 자동으로 Let's Encrypt SSL 인증서를 발급하므로 별도 설정 불필요

---

## 🔐 보안 권장사항

### 1. 환경 변수 보호

- `.env.local` 파일을 절대 GitHub에 커밋하지 마세요
- `.gitignore`에 이미 포함되어 있지만, 재확인 필요:
  ```
  .env*.local
  ```

### 2. Supabase RLS 정책 검토

- 현재는 모든 사용자에게 읽기 권한 부여 (`USING (true)`)
- 향후 사용자 인증 추가 시 정책 업데이트 필요:
  ```sql
  -- 예시: 인증된 사용자만 접근
  CREATE POLICY "Authenticated users only" ON test_records
  FOR SELECT USING (auth.uid() IS NOT NULL);
  ```

### 3. API Key 로테이션

- OpenAI API Key는 정기적으로 교체 권장 (3-6개월)
- Supabase Anon Key는 노출되어도 RLS로 보호되지만, 의심 시 재발급

---

## 📝 배포 체크리스트

프로덕션 배포 전 최종 확인:

- [ ] 모든 테스트 통과 (`npm run lint`, 로컬 테스트)
- [ ] Supabase 마이그레이션 완료 및 시드 데이터 삽입
- [ ] 환경 변수 3개 모두 Vercel에 등록
- [ ] `.env.local` 파일이 `.gitignore`에 포함됨
- [ ] README.md에 프로젝트 설명 최신화
- [ ] CLAUDE.md, PRD.md, SCHEMA.md 문서 완성도 확인

---

## 🎉 배포 완료 후

축하합니다! Mimo Health Log가 성공적으로 배포되었습니다.

**다음 단계:**
1. 팀원들과 배포 URL 공유
2. 실제 검사지 데이터 입력 시작
3. 피드백 수집 및 개선 사항 이슈 등록
4. 향후 기능 추가 계획 수립 (사용자 인증, 알림 기능 등)

**문의 및 버그 리포트:**
- GitHub Issues: `https://github.com/[your-username]/premuto/issues`
- 이메일: [프로젝트 담당자 이메일]

---

## 📚 참고 문서

- [Vercel 공식 문서](https://vercel.com/docs)
- [Next.js 배포 가이드](https://nextjs.org/docs/deployment)
- [Supabase 프로덕션 체크리스트](https://supabase.com/docs/guides/platform/going-into-prod)
- [OpenAI API 사용 가이드](https://platform.openai.com/docs)
