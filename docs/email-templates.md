# 이메일 템플릿 가이드

## 이미지 리소스

프로젝트에 준비된 이메일용 이미지:
- `public/email/logo.png` - 가로 로고 (2001x601px)
- `public/email/character.png` - 미모 캐릭터 (1001x1001px)

배포 후 URL: `https://yourdomain.com/email/[filename]`

## Supabase 이메일 템플릿 설정

### 1. 이메일 확인 (Email Confirmation)

**Supabase Dashboard → Authentication → Email Templates → Confirm signup**

```html
<h2>Premuto 이메일 인증</h2>

<div style="text-align: center; margin: 30px 0;">
  <img src="{{ .SiteURL }}/email/logo.png" alt="Premuto" width="300" style="max-width: 100%;" />
</div>

<p>안녕하세요!</p>

<p>Premuto에 가입해주셔서 감사합니다. 아래 버튼을 클릭하여 이메일 주소를 인증해주세요.</p>

<div style="text-align: center; margin: 30px 0;">
  <a href="{{ .ConfirmationURL }}"
     style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
    이메일 인증하기
  </a>
</div>

<p style="color: #666; font-size: 14px;">
  또는 다음 링크를 복사하여 브라우저에 붙여넣으세요:<br/>
  <code style="background: #f4f4f4; padding: 4px 8px; border-radius: 4px;">{{ .ConfirmationURL }}</code>
</p>

<div style="text-align: center; margin: 40px 0;">
  <img src="{{ .SiteURL }}/email/character.png" alt="Mimo" width="120" style="max-width: 100%;" />
</div>

<p style="color: #999; font-size: 12px; margin-top: 40px;">
  본인이 요청하지 않은 이메일이라면 무시하셔도 됩니다.
</p>
```

### 2. 비밀번호 재설정 (Password Reset)

**Supabase Dashboard → Authentication → Email Templates → Reset password**

```html
<h2>비밀번호 재설정</h2>

<div style="text-align: center; margin: 30px 0;">
  <img src="{{ .SiteURL }}/email/logo.png" alt="Premuto" width="300" style="max-width: 100%;" />
</div>

<p>안녕하세요!</p>

<p>비밀번호 재설정 요청을 받았습니다. 아래 버튼을 클릭하여 새로운 비밀번호를 설정해주세요.</p>

<div style="text-align: center; margin: 30px 0;">
  <a href="{{ .ConfirmationURL }}"
     style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
    비밀번호 재설정하기
  </a>
</div>

<p style="color: #666; font-size: 14px;">
  또는 다음 링크를 복사하여 브라우저에 붙여넣으세요:<br/>
  <code style="background: #f4f4f4; padding: 4px 8px; border-radius: 4px;">{{ .ConfirmationURL }}</code>
</p>

<div style="text-align: center; margin: 40px 0;">
  <img src="{{ .SiteURL }}/email/character.png" alt="Mimo" width="120" style="max-width: 100%;" />
</div>

<p style="color: #999; font-size: 12px; margin-top: 40px;">
  비밀번호 재설정을 요청하지 않으셨다면 이 이메일을 무시하셔도 됩니다.<br/>
  링크는 24시간 동안 유효합니다.
</p>
```

### 3. 마법 링크 (Magic Link)

**Supabase Dashboard → Authentication → Email Templates → Magic Link**

```html
<h2>Premuto 로그인</h2>

<div style="text-align: center; margin: 30px 0;">
  <img src="{{ .SiteURL }}/email/logo.png" alt="Premuto" width="300" style="max-width: 100%;" />
</div>

<p>안녕하세요!</p>

<p>아래 버튼을 클릭하여 Premuto에 로그인하세요.</p>

<div style="text-align: center; margin: 30px 0;">
  <a href="{{ .ConfirmationURL }}"
     style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
    로그인하기
  </a>
</div>

<p style="color: #666; font-size: 14px;">
  또는 다음 링크를 복사하여 브라우저에 붙여넣으세요:<br/>
  <code style="background: #f4f4f4; padding: 4px 8px; border-radius: 4px;">{{ .ConfirmationURL }}</code>
</p>

<div style="text-align: center; margin: 40px 0;">
  <img src="{{ .SiteURL }}/email/character.png" alt="Mimo" width="120" style="max-width: 100%;" />
</div>

<p style="color: #999; font-size: 12px; margin-top: 40px;">
  본인이 요청하지 않은 이메일이라면 무시하셔도 됩니다.<br/>
  링크는 1시간 동안 유효합니다.
</p>
```

## 스타일 커스터마이징

### 전체 레이아웃 (래퍼)

```html
<div style="
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  max-width: 600px;
  margin: 0 auto;
  padding: 40px 20px;
  background-color: #ffffff;
">
  <!-- 내용 -->
</div>
```

### 컬러 팔레트

```css
Primary: #4F46E5
Secondary: #10B981
Gray: #6B7280
Light Gray: #F3F4F6
```

## 테스트 방법

1. Supabase Dashboard에서 템플릿 저장
2. 로컬에서 회원가입/비밀번호 재설정 테스트
3. 이메일 수신 확인 및 레이아웃 검증

## 주의사항

- 이미지는 배포 후 절대 URL로 변경 필요
- `{{ .SiteURL }}` 변수는 Supabase에서 자동으로 제공
- 모바일 반응형을 위해 `max-width: 100%` 필수
- 인라인 스타일 사용 (일부 메일 클라이언트는 `<style>` 태그 미지원)
