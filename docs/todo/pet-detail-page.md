# 반려동물 상세 페이지 + 체중 기록 기능

## Context

현재 반려동물 관리가 설정 페이지 모달 기반으로만 동작하여 지면이 제한적임.
**설정 > 반려동물 목록 > 반려동물 상세 페이지** 구조로 전환하고,
상세 페이지에 **기본정보** + **체중기록** 탭을 둔다.

### 결정 사항
- **기본정보 탭**: 이름, 종류, 품종, 생년월일, 사진, 동물 등록번호(신규), 중성화 여부
- **중성화**: 기본정보에 위치. false→true 변경 시 이전 데이터(급여 계산 등)에 영향 없도록 (feeding_plans가 이미 is_neutered_snapshot 저장하므로 독립적)
- **활동량/사료 칼로리**: 펫 상세에서 제거 → 급여량 계산기(/calorie-calculator) 바로가기 버튼 배치
- **체중기록 탭**: 체중 이력 차트 + 기록 목록 + 입력 폼

---

## 변경 파일 요약

| 파일 | 작업 | 설명 |
|------|------|------|
| `supabase/migrations/0XX_pet_registration_number.sql` | **신규** | pets 테이블에 `registration_number` 컬럼 추가 |
| `types/index.ts` | **수정** | Pet, PetInput 인터페이스에 `registration_number` 추가 |
| `components/settings/PetProfileSection.tsx` | **신규** | settings/page.tsx에서 추출, 목록 뷰로 전환 |
| `app/settings/pets/[id]/page.tsx` | **신규** | 반려동물 상세 페이지 (기본정보 + 체중기록 탭) |
| `components/settings/WeightHistorySection.tsx` | **신규** | 체중 차트 + 기록 목록 + 입력 폼 |
| `app/settings/page.tsx` | **수정** | 인라인 PetProfileSection 제거, 추출 컴포넌트 import |
| `app/api/pets/route.ts` | **수정** | registration_number 필드 지원 추가 |

---

## Phase 1: DB 마이그레이션 — `registration_number` 추가

**파일**: `supabase/migrations/0XX_pet_registration_number.sql`

```sql
ALTER TABLE pets ADD COLUMN registration_number VARCHAR(50) DEFAULT NULL;
```

**파일**: `types/index.ts` 수정
- `Pet` 인터페이스에 `registration_number: string | null` 추가
- `PetInput` 인터페이스에 `registration_number?: string | null` 추가

**파일**: `app/api/pets/route.ts` 수정
- POST/PATCH 핸들러에서 `registration_number` 필드 처리

---

## Phase 2: PetProfileSection 추출 — 목록 뷰로 전환

**파일**: `components/settings/PetProfileSection.tsx` (신규)

`app/settings/page.tsx` 194~649행의 `PetProfileSection`을 새 파일로 이동하고 변경:

1. **카드 클릭 → 상세 페이지 이동**: `onClick={() => router.push('/settings/pets/${pet.id}')}` + `cursor-pointer`
2. **수정 버튼(연필) → 상세 페이지 이동**: 모달 대신 라우팅
3. **추가 버튼 + 모달 유지**: "추가" Dialog 모달 그대로 (빠른 등록용), 단 form에서 활동량/사료칼로리 제거
4. **삭제/기본설정 버튼 유지**: `e.stopPropagation()`으로 카드 클릭과 분리
5. **편집 관련 Dialog/state 제거**: 수정은 상세 페이지에서만 처리

**파일**: `app/settings/page.tsx` (수정)
- 인라인 `PetProfileSection` 제거 (~450행)
- `import { PetProfileSection } from '@/components/settings/PetProfileSection'`

---

## Phase 3: 반려동물 상세 페이지 생성

**파일**: `app/settings/pets/[id]/page.tsx` (신규)

### 구조
```
AppHeader (title={pet.name}, showBack, backHref="/settings?tab=pet")
└─ Tabs (2개)
   ├─ 기본정보 탭
   └─ 체중기록 탭 (WeightHistorySection)
```

### 기본정보 탭 — 전체 페이지 폼
- 프로필 사진 업로드 (기존 handlePhotoUpload 로직 재사용)
- 이름* (필수), 종류 (Select: 고양이/강아지/기타), 품종, 생년월일
- 동물 등록번호 (신규 Input 필드)
- 중성화 여부 (Checkbox)
- **급여량 계산기 바로가기**: Card UI — "급여량 계산기에서 활동량/사료 칼로리를 설정하세요" + 이동 버튼 → `/calorie-calculator`
- 하단: 저장 버튼 + 삭제 버튼 (AlertDialog)
- 저장 시 `PATCH /api/pets` → `updatePet()` (PetContext)
- 삭제 시 `DELETE /api/pets?id=X` → `removePet()` → `/settings?tab=pet` 이동

### Pet 미발견 처리
- `usePet().pets`에서 URL의 id 못 찾으면 → "반려동물을 찾을 수 없습니다" + 뒤로가기 링크

### 참조 패턴
- `app/records-management/[id]/edit/page.tsx`: dynamic route + `useParams()` 사용 패턴
- `components/layout/AppHeader.tsx`: `showBack` + `backHref` prop

---

## Phase 4: 체중기록 탭 구현

**파일**: `components/settings/WeightHistorySection.tsx` (신규)

### 데이터 조회
- `GET /api/daily-logs?pet_id={petId}&category=weight` (날짜 필터 없으면 전체 반환, 기존 API 그대로)
- 기간 필터 적용 시: `&start=YYYY-MM-DD&end=YYYY-MM-DD`
- **신규 API 불필요** — 기존 daily-logs API가 모든 시나리오 지원

### UI 구성 (위→아래)

**1) 체중 입력 폼** (인라인, 상단)
```
[날짜 input (기본: 오늘)] [체중 input ___kg] [기록 버튼]
```
- `POST /api/daily-logs` (category: 'weight', pet_id, amount, logged_at)
- 기록 후 `refreshPets()` 호출 (DB 트리거가 `pets.weight_kg` 자동 갱신하므로)

**2) 요약 카드**
```
현재 체중: 4.2kg | 최고: 4.8kg | 최저: 3.9kg | 기록 수: 24
```

**3) 기간 필터**
- 버튼 그룹: 3개월 | 6개월 | 1년 | 전체 (기본: 1년)

**4) 체중 추이 차트** (recharts LineChart)
- `DailyTrendChart.tsx` 패턴 참조 (`components/daily-log/DailyTrendChart.tsx`)
- X축: 날짜, Y축: 체중(kg), 색상: `#10b981` (emerald)
- `ResponsiveContainer width="100%" height={200}` + `LineChart` + `CartesianGrid` + `Tooltip`
- recharts 이미 설치됨 (v3.6.0)

**5) 기록 목록** (최신순)
- 각 행: 날짜(YYYY.MM.DD) | 체중(kg) | 변화량(이전 대비 ±kg) | 삭제 버튼
- 삭제: `DELETE /api/daily-logs` (soft delete) → 목록 리프레시 + `refreshPets()`

### 빈 상태
```
Scale 아이콘 + "체중 기록이 없습니다" + "위에서 첫 체중을 기록해보세요"
```

---

## 위험 분석 및 방지책

### 1. 온보딩 플로우 (LOW RISK)
- `RequirePetGuard` → `/settings?tab=pet&onboarding=true` → 빈 목록 + "추가" 모달
- **방지**: PetProfileSection에 추가 모달 + 빈 상태 UI 유지
- `/settings/pets/[id]`는 `ALLOWED_PATHS`의 `/settings` startsWith에 자동 포함

### 2. PetContext 동기화 (MEDIUM RISK)
- 상세 페이지에서 수정/삭제 후 PetContext 갱신 필수
- **방지**: 모든 mutation 후 반드시 `updatePet()` / `removePet()` / `refreshPets()` 호출

### 3. 중성화 변경 → 기존 데이터 독립성 (LOW RISK)
- 중성화 여부는 `pets.is_neutered`에 저장, 급여 계산은 "현재값"만 사용
- `feeding_plans`는 저장 시 스냅샷을 기록하므로 이미 독립적
- **방지**: 기존 로직 그대로 유지, 별도 작업 불필요

### 4. 마지막 pet 삭제 시 (LOW RISK)
- 상세 페이지에서 삭제 → `/settings?tab=pet` 이동 → 빈 목록 표시
- `/settings`는 ALLOWED_PATHS이므로 가드 모달 안 뜸, 빈 목록에서 재등록 가능

### 5. 체중 데이터 대량 조회 (LOW RISK)
- 기본 기간 "최근 1년"으로 제한, "전체"는 사용자 선택 시에만

---

## 검증 계획

1. **빌드**: `npm run build` 성공
2. **온보딩**: pet 0개 → 앱 접속 → 가드 모달 → 설정 이동 → 추가 모달 → 등록 → 완료
3. **목록→상세**: 설정 > 반려동물 탭 > pet 카드 클릭 → `/settings/pets/[id]`
4. **기본정보**: 이름/사진/등록번호 수정 → 저장 → 목록에 반영
5. **체중 CRUD**: 체중 입력 → 차트 반영 → 목록 표시 → 삭제 → 갱신
6. **급여 계산기 이동**: 기본정보 탭의 바로가기 → `/calorie-calculator` 이동
