# 미모의 하루 - 이메일 템플릿

## 📁 파일 구조

```
docs/email-templates/
├── README.md                   # 이 파일
├── email-confirmation.html     # 이메일 인증 템플릿
└── password-reset.html         # 비밀번호 재설정 템플릿

public/email/
├── logo.png                    # 가로 로고 (2001x601px)
└── character.png               # 미모 캐릭터 (1001x1001px)
```

## 🎨 디자인 가이드

### 컬러 팔레트
- **Primary Gold**: `#cdac71` - CTA 버튼, 링크, 브랜드 강조
- **Background Warm**: `#f0ebe4` - 전체 배경
- **Card Background**: `#ffffff` - 카드 배경
- **Header/Footer**: `#faf7f2` - 헤더/푸터 배경
- **Text Dark**: `#3a3330` - 제목
- **Text Medium**: `#6b5f56` - 본문
- **Text Light**: `#a89a8c` - 부제목
- **Text Muted**: `#b5a899` - 푸터 텍스트
- **Border**: `#f0e9df` - 구분선

### 타이포그래피
- **제목**: 19px, font-weight: 700
- **부제목**: 13px, font-weight: 300
- **본문**: 14px, line-height: 1.8
- **작은 텍스트**: 12px, line-height: 1.7
- **푸터**: 11px

### 레이아웃
- **최대 너비**: 460px
- **Border Radius**: 20px (카드), 50px (버튼), 10px (경고 박스)
- **패딩**: 32-36px (섹션), 12-28px (콘텐츠)

## 🚀 Supabase 설정 방법

### 1. Supabase Dashboard 접속
1. [Supabase Dashboard](https://supabase.com/dashboard) 로그인
2. 프로젝트 선택
3. **Authentication** → **Email Templates** 이동

### 2. 이메일 확인 템플릿 설정

**메뉴**: `Confirm signup`

1. `email-confirmation.html` 파일 내용 복사
2. Supabase 템플릿 에디터에 붙여넣기
3. **Save** 클릭

### 3. 비밀번호 재설정 템플릿 설정

**메뉴**: `Reset password`

1. `password-reset.html` 파일 내용 복사
2. Supabase 템플릿 에디터에 붙여넣기
3. **Save** 클릭

### 4. 마법 링크 템플릿 (선택사항)

**메뉴**: `Magic Link`

비밀번호 없이 로그인하는 경우 사용. `email-confirmation.html`을 기반으로 수정:
- 제목: "로그인하기 ✨"
- 부제목: "클릭 한 번으로 간편하게 로그인하세요"
- 버튼 텍스트: "로그인하기"

## 🔗 이미지 URL 설정

### 개발 환경 (로컬)
템플릿에서 이미지 URL은 Supabase 변수를 사용합니다:
```html
{{ .SiteURL }}/email/logo.png
{{ .SiteURL }}/email/character.png
```

### 프로덕션 환경
배포 후 Supabase가 자동으로 `{{ .SiteURL }}`을 실제 도메인으로 치환합니다:
- `https://yourdomain.com/email/logo.png`
- `https://yourdomain.com/email/character.png`

### 절대 URL 사용 (대안)
Supabase 변수 대신 직접 URL을 입력할 수도 있습니다:
```html
<img src="https://yourdomain.com/email/logo.png" alt="미모의 하루">
```

## ✅ 테스트 방법

### 1. 로컬 이미지 확인
```bash
npm run dev
# 브라우저에서 확인:
# http://localhost:3000/email/logo.png
# http://localhost:3000/email/character.png
```

### 2. 이메일 발송 테스트
1. 로컬에서 회원가입 시도
2. 이메일 수신 확인
3. 레이아웃 및 이미지 로딩 확인

### 3. 다양한 메일 클라이언트 테스트
- Gmail (웹, 모바일)
- Outlook
- Apple Mail
- 네이버 메일

## 📝 커스터마이징 가이드

### 로고 높이 조정
```html
<img src="{{ .SiteURL }}/email/logo.png" alt="미모의 하루" style="height: 80px;">
<!-- height 값을 조정 (권장: 60-100px) -->
```

### 캐릭터 크기 조정
```html
<img src="{{ .SiteURL }}/email/character.png" alt="미모 캐릭터" style="width: 100px; height: 100px;">
<!-- width/height 값을 조정 (권장: 80-120px) -->
```

### CTA 버튼 색상 변경
```html
<a href="..." style="background: #cdac71; ...">
<!-- background 색상 변경 -->
```

### 텍스트 수정
각 템플릿의 텍스트 부분을 직접 수정하면 됩니다:
- 제목 (`<h2>` 태그)
- 부제목 (`<p>` 태그 - 회색 작은 글씨)
- 본문 (`<p>` 태그 - 메인 텍스트)
- 버튼 텍스트 (`<a>` 태그)

## 🔧 문제 해결

### 이미지가 보이지 않는 경우
1. ✅ 파일 경로 확인: `public/email/` 폴더에 이미지 존재 확인
2. ✅ 배포 확인: Vercel/Netlify 등에 배포되었는지 확인
3. ✅ URL 확인: 브라우저에서 직접 이미지 URL 접속 테스트
4. ✅ Supabase 설정: Site URL이 올바르게 설정되었는지 확인

### 레이아웃이 깨지는 경우
1. ✅ 인라인 스타일 사용 확인 (외부 CSS는 대부분의 메일 클라이언트에서 미지원)
2. ✅ `<table>` 기반 레이아웃 유지 (flexbox/grid 미지원)
3. ✅ 최대 너비 460px 유지 (모바일 최적화)

### 한글 폰트가 적용되지 않는 경우
```css
font-family: 'Apple SD Gothic Neo', 'Noto Sans KR', -apple-system, sans-serif;
```
- 이메일 클라이언트마다 폰트 지원이 다름
- 시스템 폰트 fallback이 자동 적용됨

## 📚 참고 자료

- [Supabase Email Templates 공식 문서](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Can I Email?](https://www.caniemail.com/) - 이메일 클라이언트 CSS 지원 확인
- [Litmus](https://litmus.com/) - 이메일 테스트 도구

## 💡 팁

1. **미리보기 테스트**: 실제 발송 전 테스트 계정으로 여러 번 테스트
2. **모바일 우선**: 대부분의 사용자가 모바일에서 이메일 확인
3. **CTA 명확히**: 버튼 텍스트는 명확하고 행동 지향적으로
4. **브랜드 일관성**: 웹사이트와 동일한 컬러/폰트 사용
5. **심플하게**: 너무 많은 정보보다는 핵심 메시지 전달

## 🎯 체크리스트

배포 전 확인사항:
- [ ] Supabase 템플릿 저장 완료
- [ ] 로컬에서 이미지 접근 가능 확인
- [ ] 테스트 회원가입으로 이메일 수신 확인
- [ ] 모바일/데스크톱 모두에서 레이아웃 확인
- [ ] 링크 클릭 시 정상 작동 확인
- [ ] 스팸 폴더 확인
- [ ] 다양한 메일 클라이언트에서 테스트
