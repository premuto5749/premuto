# Supabase 인증 설정 가이드

## 1. Supabase Dashboard에서 이메일 인증 활성화

1. Supabase 프로젝트 대시보드 접속: https://supabase.com/dashboard
2. 좌측 메뉴에서 **Authentication** > **Providers** 클릭
3. **Email** 항목 찾기
4. **Enable Email provider** 토글 켜기
5. **Email Auth** 설정:
   - ✅ Enable email confirmations (이메일 확인 필요)
   - 또는 개발용으로 빠르게 테스트하려면 이 옵션을 끄고 자동 확인 가능
6. **Save** 클릭

## 2. Site URL 및 Redirect URLs 설정

### 개발 환경 (localhost)

1. 좌측 메뉴에서 **Authentication** > **URL Configuration** 클릭
2. **Site URL** 설정:
   ```
   http://localhost:3000
   ```
3. **Redirect URLs** 추가:
   ```
   http://localhost:3000/auth/callback
   ```

### 프로덕션 환경 (Vercel 배포 시)

1. Vercel에서 배포된 URL 확인 (예: `https://your-app.vercel.app`)
2. Supabase Dashboard에서 **Site URL** 업데이트:
   ```
   https://your-app.vercel.app
   ```
3. **Redirect URLs**에 프로덕션 URL 추가:
   ```
   https://your-app.vercel.app/auth/callback
   ```

## 3. 환경 변수 확인

`.env.local` 파일에 다음 환경 변수가 있는지 확인:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## 4. 인증 흐름 테스트

### 회원가입

1. 브라우저에서 `http://localhost:3000` 접속
2. 자동으로 `/login` 페이지로 리다이렉트됨
3. **"계정이 없으신가요? 회원가입"** 클릭
4. 이메일과 비밀번호(최소 6자) 입력
5. **회원가입** 버튼 클릭
6. "회원가입이 완료되었습니다! 이메일을 확인하여 인증해주세요." 메시지 확인

### 이메일 확인

- **Email confirmations 활성화 시**:
  1. 가입한 이메일 받은편지함 확인
  2. Supabase에서 온 확인 이메일의 **Confirm your mail** 링크 클릭
  3. 자동으로 `/auth/callback`을 거쳐 홈으로 리다이렉트

- **Email confirmations 비활성화 시** (개발용):
  - 이메일 확인 없이 바로 로그인 가능

### 로그인

1. `/login` 페이지에서 이메일과 비밀번호 입력
2. **로그인** 버튼 클릭
3. 성공 시 홈 화면(`/`)으로 이동
4. 상단에 "이메일님 환영합니다" 메시지 표시
5. 로그아웃 버튼으로 로그아웃 가능

### 보호된 경로 테스트

로그인하지 않은 상태에서 다음 경로 접속 시도:
- `/upload`
- `/dashboard`
- `/preview`
- `/staging`
- `/mapping-management`

→ 자동으로 `/login`으로 리다이렉트되어야 함

## 5. Supabase Dashboard에서 사용자 관리

1. 좌측 메뉴에서 **Authentication** > **Users** 클릭
2. 가입한 사용자 목록 확인
3. 사용자별 세부정보:
   - 이메일
   - 가입일시
   - 마지막 로그인
   - 이메일 확인 상태

## 6. 트러블슈팅

### "Invalid login credentials" 오류

- 이메일/비밀번호가 올바른지 확인
- Email confirmations가 활성화된 경우, 이메일 확인을 완료했는지 확인
- Supabase Dashboard > Authentication > Users에서 사용자 상태 확인

### "Email not confirmed" 오류

- 이메일 받은편지함에서 확인 링크 클릭
- 또는 개발 중이라면 Supabase Dashboard에서 Email confirmations 비활성화

### Redirect URL 오류

- Supabase Dashboard에서 Redirect URLs에 현재 URL이 추가되었는지 확인
- Site URL이 올바르게 설정되었는지 확인

### 환경 변수 인식 안 됨

- `.env.local` 파일이 프로젝트 루트에 있는지 확인
- 개발 서버 재시작: `npm run dev` 종료 후 재실행
- `NEXT_PUBLIC_` 접두사가 있는지 확인

## 7. 추가 기능 (옵션)

### 소셜 로그인 추가

Supabase는 다음 소셜 로그인을 지원합니다:
- Google
- GitHub
- Facebook
- Apple
- 등등

설정:
1. **Authentication** > **Providers**에서 원하는 제공자 선택
2. OAuth 클라이언트 ID/Secret 입력 (각 플랫폼에서 발급)
3. 로그인 페이지에 소셜 로그인 버튼 추가

### 비밀번호 재설정

Supabase는 자동으로 비밀번호 재설정 이메일을 지원합니다:

```typescript
const { error } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/auth/reset-password`,
})
```

### Magic Link (비밀번호 없는 로그인)

```typescript
const { error } = await supabase.auth.signInWithOtp({
  email,
  options: {
    emailRedirectTo: `${window.location.origin}/auth/callback`,
  }
})
```

## 8. 프로덕션 체크리스트

배포 전 확인사항:

- [ ] Supabase의 Site URL이 프로덕션 도메인으로 설정됨
- [ ] Redirect URLs에 프로덕션 콜백 URL 추가됨
- [ ] Vercel 환경 변수에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 설정됨
- [ ] Email confirmations 활성화됨 (보안상 권장)
- [ ] SMTP 설정 확인 (Supabase는 기본 제공, 커스텀 가능)

## 참고 자료

- [Supabase Auth 공식 문서](https://supabase.com/docs/guides/auth)
- [Next.js + Supabase 인증 가이드](https://supabase.com/docs/guides/auth/server-side/nextjs)
