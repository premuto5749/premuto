# 빠른 인증 설정 (개발용)

## 이메일 확인 비활성화

확인 이메일이 오지 않는 경우 개발 중에는 이메일 확인을 끌 수 있습니다:

### Supabase Dashboard 설정

1. https://supabase.com/dashboard 접속
2. 프로젝트 선택
3. **Authentication** → **Providers** 클릭
4. **Email** 섹션 찾기
5. **Enable email confirmations** 토글 **OFF** (끄기)
6. **Save** 클릭

이제 회원가입 후 즉시 로그인 가능합니다!

## 임시 테스트 계정 생성

### 방법 1: Supabase Dashboard에서 직접 생성

1. **Authentication** → **Users** 클릭
2. **Add user** 버튼 클릭
3. 이메일과 비밀번호 입력:
   - Email: `test@mimo.com`
   - Password: `test1234`
4. **Auto Confirm User** 체크박스 선택
5. **Create user** 클릭

### 방법 2: SQL Editor로 생성

Supabase Dashboard → **SQL Editor**에 아래 코드 실행:

```sql
-- 테스트 계정 생성 (이메일 확인 완료 상태)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'test@mimo.com',
  crypt('test1234', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
);
```

### 테스트 계정 정보

```
이메일: test@mimo.com
비밀번호: test1234
```

## 로그인 테스트

1. http://localhost:3000/login 접속
2. 위 계정 정보로 로그인
3. 홈 화면으로 이동 확인

## 이메일 문제 해결

### SMTP 설정 확인

Supabase는 기본 SMTP를 제공하지만 제한이 있습니다:
- 시간당 4개 이메일 (무료 플랜)
- 스팸 필터에 걸릴 수 있음

**해결 방법:**

1. **Authentication** → **Email Templates**에서 확인
2. **Authentication** → **Settings** → **SMTP Settings**에서 커스텀 SMTP 설정 가능
   - Gmail, SendGrid, AWS SES 등 사용 가능

### 개발 중에는 이메일 확인 끄기 권장

프로덕션 배포 시에만 이메일 확인을 다시 켜세요.

## 프로덕션 전환 시

배포 전 다시 활성화:
- [ ] Email confirmations 다시 켜기
- [ ] 테스트 계정 삭제하기
- [ ] 커스텀 SMTP 설정하기 (선택)
