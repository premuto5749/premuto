# Plan: 진료 녹음 기록 기능 (Vet Visit Recording)

## 개요

음성 녹음 파일을 업로드하면 STT + AI로 구조화된 진료 기록부를 자동 작성하는 기능.

- 상호 동의하에 적법하게 진행된 녹음만 대상
- 미모의 하루는 녹음 내용에 대해 책임을 지지 않음 (면책 동의 + 로그 저장)

## 핵심 기능

### 1. 음성 파일 → 진료 기록 자동 생성

- 오디오 파일 업로드 (m4a, mp3, wav, webm 등)
- OpenAI Whisper API로 한국어 STT
- Claude API로 전사 텍스트에서 진료 정보 구조화 추출
- 사용자가 검수/수정 후 저장

### 2. 구조화된 진료 기록 양식

| 구분 | 필드 | 비고 |
|------|------|------|
| 메타 | 진료일 | AI 추출 또는 사용자 입력 |
| 메타 | 병원명 | AI 추출 또는 기존 병원 목록에서 선택 |
| 진단 | 진단명 | 복수 가능 |
| 처방 | 처방약 (약명/용량/횟수/기간) | JSONB 배열 |
| 처방 | 시술/처치 내용 | 자유 텍스트 |
| 추가 | 다음 방문일 | 날짜 |
| 추가 | 수의사 지시사항 | 자유 텍스트 |
| 추가 | 비용 | 숫자 (원) |
| 원본 | 전사 텍스트 | Whisper 출력 원문 |
| 원본 | 오디오 파일 경로 | Supabase Storage |

### 3. 양방향 참조 연동

- **대시보드** (혈액검사): 동일 날짜에 진료 기록이 있으면 링크 버튼 표시
- **일일기록**: 동일 날짜에 진료 기록이 있으면 링크 버튼 표시
- **진료기록 페이지**: 동일 날짜의 혈액검사/일일기록 링크 표시

### 4. 면책 동의 시스템

- 업로드 시 면책 조항 동의 체크박스 필수
- 동의 내역을 `consent_logs` 테이블에 기록 (user_id, consent_type, agreed_at, ip_address)
- 미동의 시 업로드 진행 불가

## 제약 사항

### 티어 제한

| 티어 | 월간 횟수 |
|------|----------|
| Free | 1회 |
| Basic | 5회 |
| Premium | 무제한 |

### 파일 제한

- 최대 길이: 30분
- 최대 크기: 25MB (Whisper API 제한)
- 지원 형식: mp3, m4a, wav, webm, ogg, flac

## 기술 흐름

```
[사용자]
  │
  ├─ 오디오 파일 선택
  ├─ 면책 동의 체크 ──→ consent_logs INSERT
  ├─ 업로드 클릭
  │
[API: /api/vet-visits/transcribe]
  │
  ├─ 티어 사용량 확인 → 초과 시 거부
  ├─ Supabase Storage에 오디오 저장 (vet-recordings/{user_id}/)
  ├─ OpenAI Whisper API → 전사 텍스트
  ├─ Claude API → 구조화 추출 (진단, 처방, 지시사항 등)
  │
  └─→ 구조화된 결과 + 전사 텍스트 반환
          │
[사용자 검수 UI]
  │
  ├─ AI 추출 결과 확인/수정
  ├─ 저장 클릭
  │
[API: /api/vet-visits]
  └─ vet_visits INSERT + usage_logs INSERT
```

## 변경 범위

### 신규 생성

| 종류 | 경로/이름 | 설명 |
|------|----------|------|
| DB 테이블 | `vet_visits` | 진료 기록 메인 테이블 |
| DB 테이블 | `consent_logs` | 면책 동의 기록 |
| Migration | `049_vet_visits.sql` | 테이블 + RLS + 인덱스 |
| API | `/api/vet-visits/transcribe` | 업로드 → STT → 구조화 |
| API | `/api/vet-visits` | CRUD |
| 페이지 | `/vet-visits` | 진료 기록 목록 + 상세 |
| Storage | `vet-recordings` 버킷 | 오디오 파일 저장 |

### 기존 수정

| 종류 | 경로 | 변경 내용 |
|------|------|----------|
| 컴포넌트 | 햄버거 메뉴 | 진료 기록 메뉴 항목 추가 |
| 페이지 | `/dashboard` | 동일 날짜 진료기록 링크 |
| 페이지 | `/daily-log` | 동일 날짜 진료기록 링크 |
| Tier 설정 | `lib/tier.ts` | 녹음 횟수 제한 추가 |
| Admin | tier-config API | 녹음 제한 설정 추가 |

## 구현 순서 (예상)

1. DB 스키마 (vet_visits, consent_logs, RLS)
2. Storage 버킷 설정
3. STT + 구조화 API (`/api/vet-visits/transcribe`)
4. CRUD API (`/api/vet-visits`)
5. 진료기록 페이지 UI
6. 면책 동의 UI + 로깅
7. 티어 제한 연동
8. 대시보드/일일기록 양방향 링크
