# Mimo Health Log - 구축 계획서

PRD.md와 SCHEMA.md를 바탕으로 한 Next.js + Supabase 프로젝트 구축 로드맵

---

## Phase 1: 프로젝트 초기화

### 1.1 Next.js 14 프로젝트 생성
```bash
npx create-next-app@latest mimo-health-log --typescript --tailwind --app --no-src-dir
cd mimo-health-log
```

**설정 옵션:**
- ✅ TypeScript
- ✅ ESLint
- ✅ Tailwind CSS
- ✅ App Router
- ❌ src/ directory (루트에 app/ 폴더 생성)

### 1.2 추가 의존성 설치
```bash
# UI 컴포넌트 라이브러리
npx shadcn-ui@latest init
npx shadcn-ui@latest add button input table dropdown-menu dialog

# Supabase 클라이언트
npm install @supabase/supabase-js @supabase/ssr

# 폼 관리
npm install react-hook-form zod @hookform/resolvers

# 차트 라이브러리 (시계열 그래프)
npm install recharts

# 날짜 처리
npm install date-fns

# 파일 업로드
npm install react-dropzone

# AI/OCR (OpenAI SDK)
npm install openai
```

### 1.3 폴더 구조 설계
```
mimo-health-log/
├── app/
│   ├── (auth)/              # 인증 그룹 (향후 확장)
│   ├── upload/              # 1단계: 업로드 페이지
│   ├── staging/             # 2단계: 검수 페이지
│   ├── dashboard/           # 3단계: 시각화 대시보드
│   ├── api/
│   │   ├── ocr/            # OCR API 라우트
│   │   └── test-results/   # 데이터 저장 API
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/                  # Shadcn/ui 컴포넌트
│   ├── upload/
│   │   └── FileUploader.tsx
│   ├── staging/
│   │   ├── StagingTable.tsx
│   │   └── MappingDropdown.tsx
│   └── dashboard/
│       ├── PivotTable.tsx
│       └── TrendChart.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts        # 브라우저용 클라이언트
│   │   ├── server.ts        # 서버용 클라이언트
│   │   └── types.ts         # DB 타입 정의
│   ├── ocr/
│   │   └── parser.ts        # OCR 결과 파싱 로직
│   └── utils.ts
├── types/
│   ├── database.ts          # Supabase 자동 생성 타입
│   └── index.ts
└── supabase/
    └── migrations/
        └── 001_initial_schema.sql
```

---

## Phase 2: Supabase 데이터베이스 구축

### 2.1 Supabase 프로젝트 생성
1. https://supabase.com 접속
2. 새 프로젝트 생성: `mimo-health-log`
3. 리전 선택: Northeast Asia (Seoul)
4. Database password 생성 및 저장

### 2.2 환경변수 설정
`.env.local` 파일 생성:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=sk-your-openai-key
```

### 2.3 마이그레이션 파일 작성
`supabase/migrations/001_initial_schema.sql`:

```sql
-- SCHEMA.md 기반 테이블 생성

-- 1. 표준 항목 마스터
CREATE TABLE standard_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50),
  name VARCHAR(100) NOT NULL,
  display_name_ko VARCHAR(100),
  default_unit VARCHAR(20),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 항목 매핑 사전
CREATE TABLE item_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_name VARCHAR(100) NOT NULL,
  standard_item_id UUID REFERENCES standard_items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(raw_name)
);

-- 3. 검사 기록 헤더
CREATE TABLE test_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_date DATE NOT NULL,
  hospital_name VARCHAR(100),
  machine_type VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 검사 상세 결과 (핵심 테이블)
CREATE TABLE test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID REFERENCES test_records(id) ON DELETE CASCADE,
  standard_item_id UUID REFERENCES standard_items(id),
  value NUMERIC NOT NULL,

  -- 참고치 스냅샷
  ref_min NUMERIC,
  ref_max NUMERIC,
  ref_text VARCHAR(50),

  status VARCHAR(20) CHECK (status IN ('Low', 'Normal', 'High', 'Unknown')),
  unit VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX idx_test_results_record ON test_results(record_id);
CREATE INDEX idx_test_results_item ON test_results(standard_item_id);
CREATE INDEX idx_test_records_date ON test_records(test_date DESC);
CREATE INDEX idx_item_mappings_raw ON item_mappings(raw_name);

-- RLS (Row Level Security) 활성화
ALTER TABLE standard_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;

-- 기본 정책: 모든 사용자 읽기 허용 (향후 인증 추가 시 수정)
CREATE POLICY "Allow read access" ON standard_items FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON item_mappings FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON test_records FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON test_results FOR SELECT USING (true);

-- 초기 데이터: 미모 주요 관리 항목 삽입
INSERT INTO standard_items (category, name, display_name_ko, default_unit, description) VALUES
  -- Pancreas
  ('Special', 'Lipase', '리파아제', 'U/L', '췌장 효소 - 췌장염 진단'),
  ('Special', 'cPL', '췌장특이효소', 'μg/L', '개 췌장 특이 리파아제 - 췌장염 조기 진단'),

  -- Kidney
  ('Chemistry', 'BUN', '혈중요소질소', 'mg/dL', '신장 기능 지표'),
  ('Chemistry', 'Creatinine', '크레아티닌', 'mg/dL', '신장 기능 - GFR 반영'),
  ('Chemistry', 'SDMA', 'SDMA', 'μg/dL', '신장 기능 조기 지표'),
  ('Chemistry', 'Phosphorus', '인', 'mg/dL', '신장/골대사 지표'),

  -- Liver
  ('Chemistry', 'ALT', 'ALT', 'U/L', '간세포 손상 지표'),
  ('Chemistry', 'ALKP', 'ALP', 'U/L', '담도/간 효소'),
  ('Chemistry', 'GGT', 'GGT', 'U/L', '담도계 효소'),

  -- CBC
  ('CBC', 'HCT', '적혈구용적률', '%', '빈혈/탈수 지표'),
  ('CBC', 'PLT', '혈소판', 'K/μL', '지혈 기능');

-- 동의어 매핑 초기 데이터
INSERT INTO item_mappings (raw_name, standard_item_id)
SELECT 'CREA', id FROM standard_items WHERE name = 'Creatinine'
UNION ALL
SELECT 'Cre', id FROM standard_items WHERE name = 'Creatinine'
UNION ALL
SELECT 'ALP', id FROM standard_items WHERE name = 'ALKP'
UNION ALL
SELECT 'Alk Phos', id FROM standard_items WHERE name = 'ALKP';
```

### 2.4 타입 생성
```bash
npx supabase gen types typescript --project-id your-project-id > types/database.ts
```

---

## Phase 3: Upload & OCR 기능

### 3.1 파일 업로드 컴포넌트
`components/upload/FileUploader.tsx`:
- React Dropzone으로 드래그앤드롭 지원
- 이미지/PDF 검증 (최대 10MB)
- 미리보기 기능

### 3.2 OCR API 라우트
`app/api/ocr/route.ts`:
```typescript
// GPT-4o Vision API 호출
// Prompt: "이 혈액검사지에서 항목명, 결과값, 단위, 참고치를 JSON으로 추출해줘"
// 응답 형식:
{
  "items": [
    {
      "name": "CREA",
      "value": 1.2,
      "unit": "mg/dL",
      "ref_min": 0.5,
      "ref_max": 1.8,
      "ref_text": "0.5-1.8"
    }
  ]
}
```

### 3.3 데이터 흐름
1. 사용자 파일 업로드
2. Base64 인코딩 → GPT-4o Vision 전송
3. OCR 결과 받아서 `/staging` 페이지로 전달

---

## Phase 4: Staging & Mapping 페이지

### 4.1 검수 테이블 UI
`components/staging/StagingTable.tsx`:
- Shadcn/ui Data Table 사용
- 컬럼: 항목명(OCR) | 표준 항목(자동 매핑) | 결과값 | 단위 | 참고치 | 상태
- 인라인 편집 가능

### 4.2 자동 매핑 로직
`lib/ocr/mapper.ts`:
```typescript
async function autoMap(rawName: string): Promise<string | null> {
  const { data } = await supabase
    .from('item_mappings')
    .select('standard_item_id')
    .eq('raw_name', rawName)
    .single();

  return data?.standard_item_id || null;
}
```

### 4.3 수동 매핑 드롭다운
- 매핑 안 된 항목 → 드롭다운에서 표준 항목 선택
- "새 항목 만들기" 옵션 → Dialog 열어서 신규 standard_item 생성

### 4.4 참고치 수정
- OCR 오류 감지 시 사용자가 ref_min, ref_max 직접 수정

---

## Phase 5: 데이터 저장 로직

### 5.1 저장 API
`app/api/test-results/route.ts`:
```typescript
// 트랜잭션 처리
1. test_records 생성 (test_date, hospital_name, machine_type)
2. test_results 일괄 삽입 (record_id 참조)
   - value, ref_min, ref_max, ref_text, unit 모두 저장
3. 상태 계산 (Low/Normal/High)
```

### 5.2 상태 판정 로직
```typescript
function calculateStatus(value: number, refMin?: number, refMax?: number): string {
  if (!refMin && !refMax) return 'Unknown';
  if (refMin && value < refMin) return 'Low';
  if (refMax && value > refMax) return 'High';
  return 'Normal';
}
```

---

## Phase 6: 시각화 페이지

### 6.1 피벗 테이블
`components/dashboard/PivotTable.tsx`:
```typescript
// 쿼리: 날짜별 모든 검사 항목 조회
SELECT
  tr.test_date,
  si.name AS item_name,
  si.display_name_ko,
  tres.value,
  tres.unit,
  tres.ref_min,
  tres.ref_max,
  tres.status
FROM test_results tres
JOIN test_records tr ON tres.record_id = tr.id
JOIN standard_items si ON tres.standard_item_id = si.id
ORDER BY tr.test_date DESC, si.category, si.name;

// UI: 가로축(날짜), 세로축(항목명)
// High/Low 셀 → 붉은색/파란색 배경
```

### 6.2 시계열 그래프
`components/dashboard/TrendChart.tsx`:
- Recharts LineChart 사용
- 클릭한 항목(예: cPL)의 시계열 데이터 모달로 표시
- X축: 날짜, Y축: 수치
- 참고치 범위(ref_min ~ ref_max)를 회색 영역으로 표시

### 6.3 우선순위 항목 강조
- 미모 주요 관리 항목(cPL, BUN, Creatinine 등) → 별표 아이콘
- 카테고리별 그룹핑 (Pancreas, Kidney, Liver, CBC)

---

## Phase 7: 배포 및 문서 업데이트

### 7.1 Vercel 배포
```bash
vercel --prod
```

**환경변수 설정:**
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- OPENAI_API_KEY

### 7.2 CLAUDE.md 업데이트
섹션 7 "개발 명령어" 업데이트:
```markdown
## 7. 개발 명령어 (Development Commands)

### 개발 서버 실행
npm run dev          # http://localhost:3000

### 빌드 및 타입 체크
npm run build        # 프로덕션 빌드
npm run typecheck    # TypeScript 검증
npm run lint         # ESLint 실행

### Supabase
npx supabase db reset           # 로컬 DB 리셋
npx supabase db push            # 마이그레이션 적용
npx supabase gen types typescript # 타입 재생성
```

---

## 핵심 체크리스트

### 도메인 규칙 준수
- [ ] 참고치 스냅샷: test_results에 ref_min, ref_max, ref_text 저장
- [ ] 동의어 매핑: item_mappings 조회 → 자동 연결
- [ ] 상태 판정: Value vs Ref_Min/Max 비교
- [ ] 신규 항목: 사용자 확인 UI 제공

### UI/UX 요구사항
- [ ] 피벗 테이블: 날짜(가로) × 항목(세로)
- [ ] 반응형: 모바일 가로 스크롤
- [ ] 하이라이트: High(빨강), Low(파랑)
- [ ] 그래프: 주요 항목 클릭 시 모달

### 기술 스택
- [x] Next.js 14 (App Router)
- [x] TypeScript
- [x] Tailwind CSS
- [x] Shadcn/ui
- [x] Supabase (PostgreSQL)
- [x] GPT-4o Vision API

---

## 다음 단계

이 계획서를 바탕으로 Phase 1부터 순차적으로 진행합니다.
명령어: "Phase 1 시작해줘" 또는 "전체 구현 진행해줘"
