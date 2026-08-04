# Design: 티어별 OCR 토큰/PDF 페이지 제한

## 배경

대용량 PDF(7페이지 이상)는 Claude API max_tokens를 초과하여 응답이 잘리는 문제 발생.
PDF 1파일로 이미지 수십 장 분량을 처리할 수 있어 티어 간 불균형 존재.

**해결**: max_tokens와 PDF 페이지 수를 티어별로 차등 적용.

## 티어별 설정값

| | Free | Basic | Premium |
|---|---|---|---|
| **ocr_max_tokens** | 8,000 | 16,000 | 32,000 |
| **pdf_max_pages** | 3 | 10 | -1 (무제한) |
| max_files_per_ocr | 3 (기존) | 5 (기존) | 10 (기존) |
| daily_ocr_limit | 2 (기존) | 5 (기존) | -1 (기존) |

**근거**:
- 8,000 tokens ≈ 3~4페이지 처리 가능
- 16,000 tokens ≈ 7~8페이지 처리 가능 (고객 7p PDF 커버)
- 32,000 tokens → 종합검진 보고서 등 대용량 대응

## FR-1: TierConfig에 ocr_max_tokens, pdf_max_pages 추가

**변경 파일**: `lib/tier.ts`, `app/api/admin/tier-config/route.ts`

- `TierConfig` 인터페이스에 `ocr_max_tokens: number`, `pdf_max_pages: number` 추가
- `DEFAULT_TIER_CONFIG`에 기본값 설정
- `-1` = 무제한 (Premium pdf_max_pages)

### AC

- **성공**: `getTierConfig()` 호출 시 `ocr_max_tokens`, `pdf_max_pages` 포함된 config 반환
- **DB 없음**: DB 조회 실패 시 DEFAULT_TIER_CONFIG 폴백값 사용
- **하위호환**: 기존 DB에 해당 필드 없으면 폴백값 적용 (기존 설정 깨지지 않음)

## FR-2: OCR API에서 티어별 max_tokens 적용

**변경 파일**: `app/api/ocr-batch/route.ts`

- 기존 `getOcrMaxTokens()` (app_settings 글로벌 조회) → 티어별 `usageCheck.tierConfig.ocr_max_tokens` 사용
- `getOcrMaxTokens()` 함수 제거 또는 폴백 전용으로 변경

### AC

- **Free 유저**: max_tokens=8000으로 API 호출됨
- **Basic 유저**: max_tokens=16000으로 API 호출됨
- **Premium 유저**: max_tokens=32000으로 API 호출됨
- **폴백**: tierConfig 조회 실패 시 기존 app_settings 값 사용

## FR-3: PDF 페이지 수 사전 체크

**변경 파일**: `app/api/ocr-batch/route.ts`

- 파일 타입이 PDF인 경우, OCR API 호출 전에 페이지 수 카운트
- 페이지 수 > `pdf_max_pages` 이면 API 호출 없이 즉시 에러 반환 (비용 0)
- 페이지 카운트 방법: `pdf-parse` 라이브러리 또는 PDF 바이너리에서 `/Type /Page` 카운트

### AC

- **성공 (페이지 내)**: Free 유저가 2페이지 PDF 업로드 → 정상 처리
- **초과 차단**: Free 유저가 5페이지 PDF 업로드 → API 호출 없이 에러: "현재 등급에서는 PDF {limit}페이지까지 분석 가능합니다. 더 짧게 분할하거나 등급을 업그레이드해 주세요."
- **이미지 무관**: JPG/PNG 파일은 페이지 체크 없이 통과
- **무제한 (-1)**: Premium 유저는 페이지 수 체크 건너뜀
- **에러**: PDF 페이지 카운트 실패 시 → 체크 건너뛰고 처리 진행 (사용자 불이익 방지)

## FR-4: 관리자 UI에 신규 필드 추가

**변경 파일**: `app/admin/tier-config/page.tsx`

- `ocr_max_tokens`, `pdf_max_pages` 입력 필드 추가
- 기존 FIELD_LABELS에 라벨/설명 추가

### AC

- **표시**: 관리자 페이지에 OCR 토큰 제한, PDF 페이지 제한 필드 표시
- **저장**: 값 변경 후 저장 → DB 반영 → 다음 OCR 호출에 적용
- **검증**: ocr_max_tokens < 1000 또는 > 100000 → 저장 거부

## 구현 순서

1. `lib/tier.ts` — TierConfig 인터페이스 + 기본값 (FR-1)
2. `app/api/ocr-batch/route.ts` — 티어별 max_tokens + PDF 페이지 체크 (FR-2, FR-3)
3. `app/admin/tier-config/page.tsx` + route.ts — 관리자 UI (FR-4)

## 변경 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `lib/tier.ts` | TierConfig에 2개 필드 추가 + 기본값 |
| `app/api/ocr-batch/route.ts` | getOcrMaxTokens → 티어별 적용 + PDF 페이지 체크 |
| `app/admin/tier-config/page.tsx` | 관리자 UI 필드 2개 추가 |
| `app/api/admin/tier-config/route.ts` | 검증 로직 추가 |
| `contexts/AuthContext.tsx` | TierConfig 타입에 필드 추가 (프론트엔드 타입 동기화) |
| `package.json` | pdf-parse 의존성 추가 (PDF 페이지 카운트용) |
