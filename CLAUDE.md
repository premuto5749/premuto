# Project: Mimo Health Log (미모 맞춤형 혈액검사 아카이브)

## 1. 프로젝트 목표
반려동물 '미모'의 다년간 누적된 혈액검사지(PDF/이미지)를 OCR로 판독하여 DB화하고, 병원/장비마다 다른 참고치(Reference Range)와 항목명(Alias)을 표준화하여 시계열 트렌드를 분석한다.

## 2. 핵심 도메인 규칙 (Business Rules)
### A. 데이터 매핑 및 표준화 (Mapping Strategy)
OCR 결과는 반드시 '표준 항목'으로 매핑되어야 한다.
- **동의어 처리**: OCR 결과가 `ALP`, `Alk Phos`, `ALKP`로 다르게 나오더라도, DB에는 하나의 표준 ID로 연결해야 한다.
- **신규 항목 처리**: 매핑되지 않는 새로운 항목(예: 신규 장비 도입으로 인한 `SDMA` 추가 등)은 사용자에게 "새 항목으로 추가할까요?"라고 묻는 UI를 제공해야 한다.

### B. 참고치(Reference Range) 스냅샷 (Snapshot Rule)
**가장 중요한 규칙**: 참고치는 고정불변이 아니다.
- 검사 결과 저장 시, **그 당시 검사지에 적힌 참고치(Min/Max)**를 결과 데이터와 함께 저장해야 한다.
- **판정 로직**: `Value`가 `Ref_Min`보다 낮으면 `Low(🔵)`, `Ref_Max`보다 높으면 `High(🔴)`로 판정한다. 절대 글로벌 표준치를 강제로 적용하지 않는다.

### C. 미모 주요 관리 항목 (Priority Items)
소스 데이터 분석 결과, 다음 항목들은 UI에서 강조해서 보여줘야 한다.
- **Pancreas (췌장)**: `Lipase`, `cPL` (미모의 경우 cPL 변동폭이 크므로 그래프 시각화 필수) [Source 681]
- **Kidney (신장)**: `BUN`, `Creatinine`, `SDMA`, `Phosphorus`
- **Liver (간)**: `ALT`, `ALKP`, `GGT`
- **CBC**: `HCT`, `PLT` (혈소판 수치 변동 주의) [Source 266]

## 3. 기술 스택
- **Frontend**: Next.js 14, Tailwind CSS, Shadcn/ui (Data Table 필수)
- **Backend/DB**: Supabase (PostgreSQL)
- **AI/OCR**: GPT-4o (Vision API) - 복잡한 표 인식에 최적화

## 4. 코딩 컨벤션
- **상태 아이콘**:
  - 🔴 High (수치 > Max)
  - 🔵 Low (수치 < Min)
  - 🟢 Normal (Min <= 수치 <= Max)
  - 검사지에 참고치가 없는 경우(예: `mOsm`)는 아이콘을 표시하지 않는다.
