# Pet Food Ingredients OCR - Design Document

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 사료/간식 성분표를 OCR 또는 수동으로 등록하고, 반려동물별로 급여 중인 제품을 관리하는 기능 구현

**Architecture:** 기존 `pet_foods` 테이블을 확장(user_id, food_category, ingredients, photo 등)하고 `pet_food_nutrients` + `nutrient_units` 테이블 추가. `/manage` 페이지에 새 탭으로 UI 제공. OCR은 기존 Claude API 인프라 재활용.

**Tech Stack:** Next.js 14, Supabase (PostgreSQL + Storage + RLS), Claude API (OCR), Tailwind CSS, Shadcn/ui, react-dropzone

---

## 1. DB Schema

### 1-1. `pet_foods` 테이블 확장

```sql
-- 기존: id, name, brand, calorie_density, food_type, target_animal, memo, created_at, updated_at

-- 신규 컬럼
ALTER TABLE pet_foods ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE pet_foods ADD COLUMN pet_id UUID REFERENCES pets(id);
ALTER TABLE pet_foods ADD COLUMN food_category TEXT DEFAULT '건사료'
  CHECK (food_category IN ('건사료','습식','생식','간식','보충제/영양제'));
ALTER TABLE pet_foods ADD COLUMN ingredients_text TEXT;
ALTER TABLE pet_foods ADD COLUMN photo_urls TEXT[];
ALTER TABLE pet_foods ADD COLUMN is_active BOOLEAN DEFAULT true;
```

- `user_id = NULL` -> 관리자 등록 (공용)
- `user_id = uuid` -> 사용자 등록 (개인)
- 기존 `food_type` -> `food_category`로 대체 (마이그레이션에서 데이터 이전)

### 1-2. `pet_food_nutrients` 신규 테이블

```sql
CREATE TABLE pet_food_nutrients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_food_id UUID NOT NULL REFERENCES pet_foods(id) ON DELETE CASCADE,
  nutrient_name TEXT NOT NULL,
  value DECIMAL(10,4) NOT NULL,
  unit_id UUID REFERENCES nutrient_units(id),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1-3. `nutrient_units` 마스터 테이블

```sql
CREATE TABLE nutrient_units (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,   -- "%", "mg/kg", "IU/kg", "mg", "ug", "kcal/kg", "g/kg", "ppm"
  label TEXT NOT NULL,
  sort_order INT DEFAULT 0
);
```

기본 단위: %, mg/kg, IU/kg, mg, ug, kcal/kg, g/kg, ppm

### 1-4. RLS 정책

```sql
-- pet_foods: 공용(user_id=null) + 본인 것 읽기
DROP POLICY "pet_foods_select" ON pet_foods;
CREATE POLICY "pet_foods_select" ON pet_foods FOR SELECT TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "pet_foods_insert" ON pet_foods FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "pet_foods_update" ON pet_foods FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "pet_foods_delete" ON pet_foods FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- pet_food_nutrients: pet_foods 통해 간접 접근
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
```

---

## 2. API Endpoints

### 2-1. OCR: `POST /api/pet-foods/ocr`

- 입력: `{ files: [{ data: base64, type, name }] }`
- Claude API로 성분표 특화 OCR
- 출력: `{ brand, name, food_category, target_animal, ingredients_text, calorie_density, nutrients: [{ nutrient_name, value, unit }] }`
- tier 사용량 체크 적용

### 2-2. 사진 업로드: `POST /api/pet-foods/upload`

- Storage bucket: `pet-food-photos`
- 경로: `{user_id}/pet-foods/{uuid}.{ext}`
- 기존 daily-logs/upload 패턴 재활용

### 2-3. CRUD: `GET/POST/PATCH/DELETE /api/pet-foods`

- GET: `?pet_id=xxx` 필터, `?include_admin=true`로 관리자 등록 포함
- POST: `user_id` 자동 설정, nutrients 일괄 저장 (트랜잭션)
- PATCH: 제품 정보 + nutrients 일괄 업데이트
- DELETE: 본인 것만 삭제

POST/PATCH body:
```json
{
  "brand": "string",
  "name": "string (required)",
  "food_category": "건사료|습식|생식|간식|보충제/영양제",
  "target_animal": "강아지|고양이|공통",
  "pet_id": "uuid",
  "calorie_density": 3.78,
  "ingredients_text": "string",
  "photo_urls": ["string"],
  "is_active": true,
  "memo": "string",
  "nutrients": [
    { "nutrient_name": "조단백", "value": 25.0, "unit_symbol": "%" }
  ]
}
```

---

## 3. UI Flow

### 3-1. 진입점: `/manage` 페이지 탭 추가

```
변경: [사료/간식 성분] | [간식 프리셋] | [약 프리셋]
```

### 3-2. 목록 화면

- 카테고리 필터 (전체/건사료/습식/간식/...)
- 제품 카드: 브랜드, 제품명, 분류, 급여 상태, 주요 영양성분 2~3개 미리보기
- 관리자 등록 제품: "관리자 등록" 배지 표시
- 사용자 등록 제품: 편집/삭제 가능
- 카드 클릭 -> 상세 보기 (영양성분 전체 + 원재료 + 원본 사진)

### 3-3. 등록 모드 3가지

등록 폼은 하나이며, 입력 정도에 따라 3가지 사용 방식:

1. **간단 등록**: 이름만 입력하고 저장 (성분 없이)
2. **수동 상세 등록**: 폼에서 성분을 하나씩 추가하며 채움
3. **OCR 자동 입력**: 폼 상단 "사진으로 자동 입력" 버튼 -> 사진 업로드 -> OCR 결과로 폼 자동 채움 -> 수정 -> 저장

### 3-4. 등록/수정 폼

```
[사진으로 자동 입력] (OCR 옵션, 접을 수 있는 섹션)
  - 사진 업로드 영역 (앞면/뒷면 가이드)
  - [분석하기] 버튼 -> OCR -> 아래 폼 자동 채움

---
브랜드      [                    ]
제품명 *    [                    ]
분류        [건사료         v]
대상        [강아지         v]
반려동물    [미모           v]
급여 중     [v]
칼로리      [    ] kcal/g

영양성분
  [성분명] [수치] [단위 v]    [x]
  [성분명] [수치] [단위 v]    [x]
  [+ 항목 추가]

원재료
  [textarea]

[취소]                    [저장]
```

- 관리자 admin/pet-foods 페이지의 폼 구조를 참고하여 일관성 유지
- 필수 필드는 name만 (간단 등록 지원)
- 영양성분 행: 동적 추가/삭제, 단위는 nutrient_units 드롭다운

### 3-5. 관리자 등록 표기

- 관리자 등록 제품 (user_id=null): "관리자 등록" 배지, 편집/삭제 불가 (읽기 전용)
- 사용자 등록 제품 (user_id=본인): 편집/삭제 가능

---

## 4. Future Extensions

- 영양 불균형 분석: pet_food_nutrients 집계 -> 권장 기준 대비 부족/과잉 표시
- 보충 성분 추천: 부족한 영양소 기반 보충제 추천
- snack_presets.food_id FK 추가: 간식 프리셋에서 성분 제품 참조
- daily-log 연동: 식사 기록 시 등록된 사료 선택 가능
