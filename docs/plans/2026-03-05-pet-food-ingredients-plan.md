# Pet Food Ingredients - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 사료/간식 성분표를 OCR 또는 수동으로 등록하고, 반려동물별로 급여 중인 제품을 관리하는 기능 구현

**Architecture:** 기존 `pet_foods` 테이블 확장 + `pet_food_nutrients` / `nutrient_units` 테이블 추가. `/manage` 페이지에 새 탭. OCR은 기존 Claude API 재활용.

**Tech Stack:** Next.js 14, Supabase, Claude API, Tailwind, Shadcn/ui, react-dropzone

**Design Doc:** `docs/plans/2026-03-05-pet-food-ingredients-design.md`

---

## Task 1: DB Migration - pet_foods 확장 + 신규 테이블

**Files:**
- Create: `supabase/migrations/048_pet_food_ingredients.sql`

**Step 1: Write the migration SQL**

```sql
-- 048: pet_food_ingredients - 사료/간식 성분 관리 확장

-- 1) nutrient_units 마스터 테이블
CREATE TABLE IF NOT EXISTS nutrient_units (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INT DEFAULT 0
);

INSERT INTO nutrient_units (symbol, label, sort_order) VALUES
  ('%', '퍼센트', 1),
  ('mg/kg', 'mg/kg', 2),
  ('IU/kg', 'IU/kg', 3),
  ('mg', 'mg', 4),
  ('ug', 'ug', 5),
  ('kcal/kg', 'kcal/kg', 6),
  ('g/kg', 'g/kg', 7),
  ('ppm', 'ppm', 8);

ALTER TABLE nutrient_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nutrient_units_select" ON nutrient_units FOR SELECT TO authenticated USING (true);

-- 2) pet_foods 테이블 확장
ALTER TABLE pet_foods ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE pet_foods ADD COLUMN IF NOT EXISTS pet_id UUID REFERENCES pets(id) ON DELETE SET NULL;
ALTER TABLE pet_foods ADD COLUMN IF NOT EXISTS food_category TEXT DEFAULT '건사료'
  CHECK (food_category IN ('건사료','습식','생식','간식','보충제/영양제'));
ALTER TABLE pet_foods ADD COLUMN IF NOT EXISTS ingredients_text TEXT;
ALTER TABLE pet_foods ADD COLUMN IF NOT EXISTS photo_urls TEXT[];
ALTER TABLE pet_foods ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 기존 food_type 데이터를 food_category로 이전
UPDATE pet_foods SET food_category = food_type WHERE food_category IS NULL AND food_type IS NOT NULL;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_pet_foods_user_id ON pet_foods (user_id);
CREATE INDEX IF NOT EXISTS idx_pet_foods_pet_id ON pet_foods (pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_foods_food_category ON pet_foods (food_category);

-- 3) RLS 정책 교체
DROP POLICY IF EXISTS "pet_foods_select" ON pet_foods;
CREATE POLICY "pet_foods_select" ON pet_foods FOR SELECT TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "pet_foods_user_insert" ON pet_foods FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "pet_foods_user_update" ON pet_foods FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "pet_foods_user_delete" ON pet_foods FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 4) pet_food_nutrients 테이블
CREATE TABLE IF NOT EXISTS pet_food_nutrients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_food_id UUID NOT NULL REFERENCES pet_foods(id) ON DELETE CASCADE,
  nutrient_name TEXT NOT NULL,
  value DECIMAL(10,4) NOT NULL,
  unit_id UUID REFERENCES nutrient_units(id),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pet_food_nutrients_food_id ON pet_food_nutrients (pet_food_id);

ALTER TABLE pet_food_nutrients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nutrients_select" ON pet_food_nutrients FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM pet_foods WHERE id = pet_food_id
    AND (user_id IS NULL OR user_id = auth.uid())
  ));
CREATE POLICY "nutrients_insert" ON pet_food_nutrients FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM pet_foods WHERE id = pet_food_id AND user_id = auth.uid()
  ));
CREATE POLICY "nutrients_update" ON pet_food_nutrients FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM pet_foods WHERE id = pet_food_id AND user_id = auth.uid()
  ));
CREATE POLICY "nutrients_delete" ON pet_food_nutrients FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM pet_foods WHERE id = pet_food_id AND user_id = auth.uid()
  ));

-- 5) Storage bucket for pet food photos
INSERT INTO storage.buckets (id, name, public) VALUES ('pet-food-photos', 'pet-food-photos', false)
  ON CONFLICT DO NOTHING;

CREATE POLICY "pet_food_photos_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pet-food-photos' AND (storage.foldername(name))[1] = 'uploads' AND (storage.foldername(name))[2] = auth.uid()::text);
CREATE POLICY "pet_food_photos_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pet-food-photos' AND (storage.foldername(name))[1] = 'uploads' AND (storage.foldername(name))[2] = auth.uid()::text);
CREATE POLICY "pet_food_photos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pet-food-photos' AND (storage.foldername(name))[1] = 'uploads' AND (storage.foldername(name))[2] = auth.uid()::text);
```

**Step 2: Apply migration**

Run: `npx supabase db push`

**Step 3: Commit**

```bash
git add supabase/migrations/048_pet_food_ingredients.sql
git commit -m "feat: add pet_food_nutrients, nutrient_units tables and extend pet_foods"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `types/index.ts`

**Step 1: Add new types**

기존 `PetFood` 인터페이스를 확장하고 신규 타입 추가. 기존 `FoodType` 타입은 유지하되 `FoodCategory` 추가.

```typescript
// types/index.ts 에 추가/수정

export type FoodCategory = '건사료' | '습식' | '생식' | '간식' | '보충제/영양제'

export interface PetFood {
  id: string
  name: string
  brand: string | null
  calorie_density: number
  food_type: FoodType           // 기존 유지 (하위호환)
  food_category: FoodCategory   // 신규
  target_animal: TargetAnimal
  user_id: string | null        // null=관리자 등록
  pet_id: string | null
  ingredients_text: string | null
  photo_urls: string[] | null
  is_active: boolean
  memo: string | null
  created_at: string
  updated_at: string
  // JOIN으로 함께 조회 시
  nutrients?: PetFoodNutrient[]
}

export interface PetFoodNutrient {
  id: string
  pet_food_id: string
  nutrient_name: string
  value: number
  unit_id: string | null
  unit_symbol?: string    // JOIN시 nutrient_units.symbol
  sort_order: number
  created_at: string
}

export interface NutrientUnit {
  id: string
  symbol: string
  label: string
  sort_order: number
}

export interface PetFoodInput {
  name: string
  brand?: string | null
  calorie_density?: number | null   // 간단 등록 시 선택
  food_category?: FoodCategory
  target_animal?: TargetAnimal
  pet_id?: string | null
  ingredients_text?: string | null
  photo_urls?: string[] | null
  is_active?: boolean
  memo?: string | null
  nutrients?: PetFoodNutrientInput[]
}

export interface PetFoodNutrientInput {
  nutrient_name: string
  value: number
  unit_symbol: string      // nutrient_units.symbol로 조회
  sort_order?: number
}

export interface PetFoodOcrResult {
  brand: string | null
  name: string | null
  food_category: FoodCategory | null
  target_animal: TargetAnimal | null
  ingredients_text: string | null
  calorie_density: number | null
  nutrients: PetFoodNutrientInput[]
}
```

**Step 2: Commit**

```bash
git add types/index.ts
git commit -m "feat: add PetFoodNutrient, NutrientUnit types and extend PetFood"
```

---

## Task 3: API - CRUD `/api/pet-foods` 확장

**Files:**
- Modify: `app/api/pet-foods/route.ts`

**Reference patterns:**
- `app/api/snack-presets/route.ts` (사용자 소유 CRUD + withAuth)
- `app/api/admin/pet-foods/route.ts` (기존 관리자 전용 GET)

**Step 1: Rewrite GET with user_id filter + nutrients JOIN**

기존 GET (전체 조회)을 확장:
- `?pet_id=xxx` : 특정 반려동물용 제품 필터
- `?category=xxx` : 카테고리 필터
- `?include_nutrients=true` : nutrients 포함 (상세 보기용)
- 기본: 공용(user_id=null) + 본인 것(user_id=auth.uid()) 모두 반환 (RLS가 처리)

```typescript
export const GET = withAuth(async (request, { supabase, user }) => {
  const { searchParams } = new URL(request.url)
  const petId = searchParams.get('pet_id')
  const category = searchParams.get('category')
  const includeNutrients = searchParams.get('include_nutrients') === 'true'

  let query = supabase
    .from('pet_foods')
    .select(includeNutrients
      ? '*, pet_food_nutrients(*, nutrient_units(symbol))'
      : '*')
    .order('is_active', { ascending: false })
    .order('brand, name')

  if (petId) {
    query = query.or(`pet_id.is.null,pet_id.eq.${petId}`)
  }
  if (category) {
    query = query.eq('food_category', category)
  }

  const { data, error } = await query
  // ... response
})
```

**Step 2: Add POST with nutrients bulk insert**

```typescript
export const POST = withAuth(async (request, { supabase, user }) => {
  const body = await request.json()
  // 1) pet_foods insert (user_id = user.id)
  // 2) nutrients가 있으면 unit_symbol -> unit_id 변환 후 pet_food_nutrients bulk insert
})
```

**Step 3: Add PATCH with nutrients replace**

```typescript
export const PATCH = withAuth(async (request, { supabase, user }) => {
  // 1) pet_foods update (user_id=user.id 확인)
  // 2) nutrients가 있으면: 기존 삭제 -> 새로 bulk insert (replace 전략)
})
```

**Step 4: Add DELETE**

```typescript
export const DELETE = withAuth(async (request, { supabase, user }) => {
  // pet_foods delete (CASCADE로 nutrients도 자동 삭제)
  // user_id=user.id 확인 (RLS도 체크하지만 이중 확인)
})
```

**Step 5: Commit**

```bash
git add app/api/pet-foods/route.ts
git commit -m "feat: extend pet-foods API with user CRUD and nutrients"
```

---

## Task 4: API - Photo Upload `/api/pet-foods/upload`

**Files:**
- Create: `app/api/pet-foods/upload/route.ts`

**Reference:** `app/api/daily-logs/upload/route.ts` (거의 동일한 패턴)

**Step 1: Copy and adapt daily-logs/upload pattern**

- Bucket: `pet-food-photos`
- Path: `uploads/{user_id}/pet-foods/{timestamp}_{index}.{ext}`
- 이미지 타입 체크, 파일 크기 제한
- Signed URL은 GET 시 생성 (업로드 시 경로만 반환)

**Step 2: Commit**

```bash
git add app/api/pet-foods/upload/route.ts
git commit -m "feat: add pet-food photo upload API"
```

---

## Task 5: API - OCR `/api/pet-foods/ocr`

**Files:**
- Create: `app/api/pet-foods/ocr/route.ts`

**Reference:** `app/api/ocr-batch/route.ts` (Claude API 호출 + cleanAndParseJson)

**Step 1: Create OCR endpoint**

- 입력: `{ files: [{ data: base64, type, name }] }`
- Claude API에 모든 이미지를 동시에 전달 (multi-image)
- 성분표 특화 프롬프트:

```
이 사진은 반려동물 사료 또는 간식 포장지입니다. 다음 정보를 JSON으로 추출하세요:
{
  "brand": "브랜드명 (없으면 null)",
  "name": "제품명 (없으면 null)",
  "food_category": "건사료|습식|생식|간식|보충제/영양제 중 하나",
  "target_animal": "강아지|고양이|공통 중 하나",
  "ingredients_text": "원재료 전체 텍스트 (있는 그대로)",
  "calorie_density": kcal/g 단위 숫자 (kcal/kg이면 1000으로 나누기, 없으면 null),
  "nutrients": [
    { "nutrient_name": "성분명(한국어)", "value": 숫자, "unit_symbol": "단위" }
  ]
}
- nutrients의 unit_symbol은 %, mg/kg, IU/kg, mg, ug, kcal/kg, g/kg, ppm 중 하나
- 사진에서 읽을 수 없는 항목은 포함하지 마세요
- 성분 보증 분석표(Guaranteed Analysis)의 항목을 우선 추출하세요
```

- tier 사용량 체크: `checkUsageLimit(user.id, 'ocr')` 재활용
- `cleanAndParseJson` 유틸 재활용 (ocr-batch에서 추출하거나 import)
- 응답: `PetFoodOcrResult` 타입

**Step 2: Commit**

```bash
git add app/api/pet-foods/ocr/route.ts
git commit -m "feat: add pet-food ingredient OCR API"
```

---

## Task 6: API - Nutrient Units `/api/nutrient-units`

**Files:**
- Create: `app/api/nutrient-units/route.ts`

**Step 1: Simple GET endpoint**

```typescript
export const GET = withAuth(async (request, { supabase }) => {
  const { data, error } = await supabase
    .from('nutrient_units')
    .select('*')
    .order('sort_order')
  return NextResponse.json({ success: true, data: data || [] })
})
```

**Step 2: Commit**

```bash
git add app/api/nutrient-units/route.ts
git commit -m "feat: add nutrient-units API"
```

---

## Task 7: UI - PetFoodSection Component (목록 + 상세)

**Files:**
- Create: `components/manage/PetFoodSection.tsx`

**Reference:** `components/manage/SnackPresetSection.tsx` (카드 리스트 + Dialog 패턴)

**Step 1: Build list view**

- Props: `{ foods, setFoods, nutrientUnits }`
- 카테고리 필터 (전체/건사료/습식/간식/...)
- 제품 카드:
  - 브랜드, 제품명
  - 분류 배지 + 급여 상태 (is_active)
  - `user_id === null` -> "관리자 등록" 배지 (회색)
  - 주요 영양성분 2~3개 미리보기 (nutrients 중 sort_order 기준)
  - 사용자 등록: 편집/삭제 버튼, 관리자 등록: 읽기 전용

**Step 2: Build detail dialog**

- 카드 클릭 시 모달로 상세 보기
- 영양성분 전체 리스트 (성분명 ... 수치 단위)
- 원재료 텍스트
- 원본 사진 썸네일 (photo_urls -> Signed URL)

**Step 3: Commit**

```bash
git add components/manage/PetFoodSection.tsx
git commit -m "feat: add PetFoodSection list and detail views"
```

---

## Task 8: UI - PetFoodForm Component (등록/수정 폼)

**Files:**
- Create: `components/manage/PetFoodForm.tsx`

**Reference:** `app/admin/pet-foods/page.tsx:365-441` (관리자 폼 구조)

**Step 1: Build form component**

- Props: `{ food?: PetFood, nutrientUnits, onSave, onCancel }`
- 필드: 브랜드, 제품명*, 분류(Select), 대상동물(Select), 반려동물(Select), 급여중(Checkbox), 칼로리(Input), 메모(Textarea)
- 영양성분 동적 행:
  - [성분명 Input] [수치 Input] [단위 Select] [삭제 X]
  - [+ 항목 추가] 버튼
  - 단위 Select: nutrient_units 드롭다운, OCR 결과의 unit_symbol로 자동 선택
- 원재료 Textarea
- 필수: name만 (간단 등록 지원)

**Step 2: Add OCR section (collapsible)**

- 폼 상단에 "사진으로 자동 입력" 접기/펼치기 섹션
- react-dropzone으로 파일 업로드 (앞면/뒷면 가이드 텍스트)
- [분석하기] 버튼 -> `/api/pet-foods/upload` + `/api/pet-foods/ocr` 호출
- OCR 결과로 폼 필드 자동 채움 (기존 입력 덮어쓰기)
- 로딩 상태 표시

**Step 3: Commit**

```bash
git add components/manage/PetFoodForm.tsx
git commit -m "feat: add PetFoodForm with OCR support"
```

---

## Task 9: UI - Manage Page 탭 통합

**Files:**
- Modify: `app/manage/page.tsx`

**Step 1: Add "사료/간식 성분" tab**

- 기존 탭: snack, medicine
- 신규: food (첫 번째 탭)
- `useEffect`에서 추가 fetch: `/api/pet-foods?include_nutrients=true`, `/api/nutrient-units`
- PetFoodSection에 데이터 전달

```
탭 순서: [사료/간식 성분] | [간식 프리셋] | [약 프리셋]
defaultValue: "food"
```

**Step 2: Wire up CRUD**

- PetFoodForm에서 저장 -> POST/PATCH `/api/pet-foods`
- 삭제 -> DELETE `/api/pet-foods?id=xxx`
- 목록 새로고침

**Step 3: Commit**

```bash
git add app/manage/page.tsx
git commit -m "feat: integrate pet-food ingredients tab in manage page"
```

---

## Task 10: Calorie Calculator 하위호환

**Files:**
- Modify: `app/api/pet-foods/route.ts` (GET에서 food_category -> food_type 매핑)
- Modify: `components/calorie-calculator/FoodMixingInput.tsx` (food_category 표시)

**Step 1: Ensure backward compatibility**

- GET 응답에 `food_type`과 `food_category` 모두 포함
- 칼로리 계산기에서 사용자 등록 사료도 선택 가능하게 (이미 RLS로 처리됨)
- `FoodMixingInput`에서 `food.food_category || food.food_type` 표시

**Step 2: Commit**

```bash
git add app/api/pet-foods/route.ts components/calorie-calculator/FoodMixingInput.tsx
git commit -m "feat: backward-compatible food_category in calorie calculator"
```

---

## Task 11: Build Verify + Final Commit

**Step 1: Run build**

Run: `npm run build`
Expected: No errors

**Step 2: Run lint**

Run: `npm run lint`
Expected: No errors

**Step 3: Manual smoke test checklist**

- [ ] `/manage` 페이지에 "사료/간식 성분" 탭 표시
- [ ] 간단 등록 (이름만) 저장/조회
- [ ] 수동 상세 등록 (성분 추가) 저장/조회
- [ ] OCR 사진 업로드 -> 분석 -> 폼 자동 채움 -> 수정 -> 저장
- [ ] 관리자 등록 제품에 배지 표시, 편집/삭제 불가
- [ ] 사용자 등록 제품 편집/삭제
- [ ] 카테고리 필터 동작
- [ ] 칼로리 계산기에서 사용자 등록 사료 선택 가능
- [ ] 상세 보기 모달 (영양성분 전체 + 원재료 + 사진)

**Step 4: Final commit if any fixes**

```bash
git add -A
git commit -m "fix: address smoke test issues"
```
