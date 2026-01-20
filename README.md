# Mimo Health Log (미모 맞춤형 혈액검사 아카이브)

반려동물 '미모'의 혈액검사 결과를 OCR로 분석하고 시계열 트렌드를 관리하는 웹 애플리케이션입니다.

## 📚 프로젝트 문서

- **[CLAUDE.md](./CLAUDE.md)** - 프로젝트 규칙 및 도메인 로직
- **[PRD.md](./PRD.md)** - 제품 요구사항 명세서
- **[SCHEMA.md](./SCHEMA.md)** - 데이터베이스 스키마

## 🤖 Claude Code 설정 가이드

이 프로젝트는 `settings.json`을 통해 Claude Code의 자동 실행 권한을 설정합니다.

### 🛠️ 필수 파일 조작 (Core)

• **Edit**: 파일 생성 및 수정 권한.
  - 설명: 클로드 코드가 코드를 짜거나 수정하는 가장 기본적인 기능입니다. 이걸 허용하지 않으면 파일 한 줄 고칠 때마다 승인을 눌러야 하므로 필수적으로 허용합니다.

### 📂 파일 탐색 (Read-Only)

이 명령어들은 시스템을 변경하지 않고 정보만 읽으므로 보안상 안전합니다.

• **Bash(ls \*)**: 파일 목록 조회. 클로드가 현재 폴더에 무슨 파일이 있는지 파악합니다.
• **Bash(cat \*)**: 파일 내용 읽기. 파일 안의 코드를 읽어서 분석합니다.
• **Bash(grep \*)**: 문자열 검색. 특정 함수나 변수가 사용된 위치를 찾습니다.
• **Bash(find \*)**: 파일 위치 찾기. 복잡한 폴더 구조에서 특정 파일을 찾습니다.

### 🌿 Git 상태 확인 (Read-Only)

클로드가 자신의 작업이 제대로 반영되었는지 스스로 검증할 때 사용합니다.

• **Bash(git status)**: 변경 상태 확인. 어떤 파일이 수정되었는지 확인합니다.
• **Bash(git diff \*)**: 변경 내용 비교. 구체적으로 코드가 어떻게 바뀌었는지 스스로 검토합니다.
• **Bash(git log \*)**: 과거 기록 조회. 이전 커밋 메시지나 작업 내역을 파악합니다.
• **Bash(git show \*)**: 특정 커밋 상세 조회. 과거의 특정 시점 코드를 확인합니다.

### ✍️ Git 작업 수행 (Write - 안전한 범위)

반복적인 승인 과정을 줄여주는 핵심 설정입니다.

• **Bash(git add \*)**: 스테이징. 수정한 파일을 커밋 대기 상태로 만듭니다.
• **Bash(git commit \*)**: 커밋. 변경 사항을 로컬 저장소에 저장합니다.
  - 주의: `git push`는 허용 목록에서 제외했습니다. 원격 저장소(GitHub)에 올리는 것은 사용자가 최종 확인 후 직접 승인하는 것이 안전하기 때문입니다.
• **Bash(git rm \*)**: 파일 삭제. 불필요한 파일을 Git에서 제거합니다.

### 🐙 GitHub 협업 (Read-Only)

• **Bash(gh issue list \*)**, **Bash(gh issue view \*)**: 이슈 확인. 프로젝트의 이슈 목록과 내용을 읽어 작업 목표를 파악합니다.
• **Bash(gh pr list \*)**, **Bash(gh pr view \*)**: PR 확인. 현재 열려있는 풀 리퀘스트의 내용을 확인합니다.

### ✅ 품질 관리 (Test & Lint)

• **Bash(npm run ...)**: 테스트 및 검증.
  - 클로드가 코드를 수정한 뒤 "테스트 돌려봐"라고 했을 때, 멈추지 않고 바로 lint, typecheck, test를 실행하여 오류를 스스로 잡게 합니다.
  - 팁: 만약 Python 프로젝트라면 `Bash(pytest *)`, `Bash(pylint *)` 등으로 변경해서 등록하세요.

## 🚀 기술 스택

- **Frontend**: Next.js 14, Tailwind CSS, Shadcn/ui
- **Backend/DB**: Supabase (PostgreSQL)
- **AI/OCR**: GPT-4o (Vision API)
## 🚀 빠른 시작

### 1. 의존성 설치

```bash
npm install
```

### 2. Supabase 설정

**[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** 가이드를 참고하여 Supabase 프로젝트를 생성하고 데이터베이스를 설정하세요.

간단 요약:
1. Supabase 프로젝트 생성
2. `.env.local` 파일에 API 키 설정
3. SQL Editor에서 `supabase/migrations/001_initial_schema.sql` 실행

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

## 📋 개발 명령어

```bash
# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm start

# 린트 검사
npm run lint
```

## 📖 추가 문서

- **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)** - 7단계 구현 계획
- **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** - Supabase 설정 가이드

## 🗂️ 프로젝트 구조

```
mimo-health-log/
├── app/                  # Next.js 페이지 (App Router)
├── components/           # React 컴포넌트
│   ├── ui/              # Shadcn/ui 기본 컴포넌트
│   ├── upload/          # 파일 업로드 관련
│   ├── staging/         # 검수 페이지
│   └── dashboard/       # 시각화 대시보드
├── lib/
│   ├── supabase/        # Supabase 클라이언트
│   ├── ocr/             # OCR 처리 로직
│   └── utils.ts         # 유틸리티 함수
├── types/               # TypeScript 타입 정의
└── supabase/
    └── migrations/      # 데이터베이스 마이그레이션
```
