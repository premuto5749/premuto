# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Project: Mimo Health Log (미모 맞춤형 혈액검사 아카이브)

## 1. 프로젝트 목표
반려동물 '미모'의 다년간 누적된 혈액검사지(PDF/이미지)를 OCR로 판독하여 DB화하고, 병원/장비마다 다른 참고치(Reference Range)와 항목명(Alias)을 표준화하여 시계열 트렌드를 분석한다.

## 2. 프로젝트 문서 구조

이 프로젝트는 다음 문서들로 구성되어 있습니다:
- **CLAUDE.md** (이 파일): 개발 가이드라인 및 핵심 도메인 규칙
- **PRD.md**: 제품 요구사항 명세서 - 사용자 워크플로우(Upload → AI Parsing → Staging & Mapping → Save)와 UI 요구사항
- **SCHEMA.md**: 데이터베이스 스키마 - 4개 핵심 테이블(standard_items, item_mappings, test_records, test_results)
- **README.md**: 프로젝트 개요 및 Claude Code 설정 가이드
- **settings.json**: Claude Code 자동 실행 권한 설정

## 3. 아키텍처 개요

### 데이터 흐름 (Data Flow)
1. **입력**: 사용자가 검사지 이미지/PDF 업로드
2. **OCR 처리**: GPT-4o Vision API로 항목명, 결과값, 단위, 참고치 추출
3. **매핑 레이어**: `item_mappings` 테이블을 통해 다양한 OCR 결과를 `standard_items`로 표준화
4. **검수 단계**: 사용자가 매핑 확인/수정 (신규 항목 추가 가능)
5. **저장**: `test_records`(헤더) + `test_results`(상세) 테이블에 저장
6. **시각화**: 피벗 테이블(날짜×항목) 및 시계열 그래프로 트렌드 분석

### 핵심 설계 원칙
- **참고치 스냅샷**: 참고치는 시간에 따라 변하므로, 검사 당시의 값을 결과와 함께 저장
- **동의어 매핑 시스템**: 병원/장비마다 다른 항목명을 표준화 (예: ALP/Alk Phos/ALKP → 단일 표준 항목)
- **유연한 확장성**: 새로운 검사 항목이나 장비 추가 시 사용자 승인 후 자동 매핑

## 4. 핵심 도메인 규칙 (Business Rules)
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
- **Pancreas (췌장)**: `Lipase`, `cPL` (미모의 경우 cPL 변동폭이 크므로 그래프 시각화 필수)
- **Kidney (신장)**: `BUN`, `Creatinine`, `SDMA`, `Phosphorus`
- **Liver (간)**: `ALT`, `ALKP`, `GGT`
- **CBC**: `HCT`, `PLT` (혈소판 수치 변동 주의)

## 5. 기술 스택
- **Frontend**: Next.js 14, Tailwind CSS, Shadcn/ui (Data Table 필수)
- **Backend/DB**: Supabase (PostgreSQL)
- **AI/OCR**: GPT-4o (Vision API) - 복잡한 표 인식에 최적화

## 6. 코딩 컨벤션

### 상태 판정 및 시각화
- **상태 아이콘**:
  - 🔴 High (수치 > Max)
  - 🔵 Low (수치 < Min)
  - 🟢 Normal (Min <= 수치 <= Max)
  - 검사지에 참고치가 없는 경우(예: `mOsm`)는 아이콘을 표시하지 않는다.

### UI 구현 원칙
- **반응형 테이블**: 모바일에서도 가로 스크롤로 전체 데이터 접근 가능
- **피벗 테이블 레이아웃**: 가로축(날짜/검사차수), 세로축(검사 항목)
- **하이라이트 규칙**: High/Low 상태인 셀은 배경색 변경 (붉은색/파란색)

## 7. 개발 명령어 (Development Commands)

> **참고**: 이 프로젝트는 현재 초기 계획 단계입니다. 실제 개발이 시작되면 이 섹션을 업데이트하세요.

프로젝트 설정이 완료되면 다음 명령어들을 추가할 예정:
- 개발 서버 실행
- 빌드 및 배포
- 테스트 실행
- 린트/타입 체크
- Supabase 마이그레이션
