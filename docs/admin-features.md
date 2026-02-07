# 관리자 기능 (Admin Features)

관리자(`is_admin = true`)만 접근 가능한 페이지들입니다. 진입점은 `/admin`입니다.

## 관리자 판별

- `user_roles` 테이블에서 `role = 'admin'` 확인
- `AuthContext`에서 앱 초기화 시 1회 `/api/auth/check-admin` 호출
- 관리자 메뉴는 햄버거 메뉴에서 조건부 표시

## 관리 페이지 목록

### 1. 관리자 대시보드 (`/admin`)
- 마스터 데이터 통계 (표준항목 수, 별칭 수, 사용자 수, 검사 기록 수)
- 각 관리 페이지로의 내비게이션 카드

### 2. 검사항목 마스터 (`/admin/master-data`)
- 120개 표준 검사항목 관리
- 89개 별칭 관리
- 검사 유형별/장기별 분류
- 마스터 데이터 동기화 (`docs/standard_items_master.json` → DB)

### 3. 매핑 관리 (`/admin/mapping-management`)
- Unmapped 항목 목록 조회
- 수동 매핑 (표준항목 선택)
- 신뢰도 표시 및 AI 재분석

### 4. 사용자 관리 (`/admin/users`)
- 전체 사용자 목록
- 사용자별 반려동물, 검사 기록 현황
- 티어 변경 (Free/Basic/Premium)

### 5. 등급 설정 (`/admin/tier-config`)
- Free/Basic/Premium 티어별 제한값 설정
- OCR 횟수, 사진 수, AI 설명 생성, 상세 내보내기 제한
- 상세: [docs/tier-system.md](tier-system.md)

### 6. 사이트 설정 (`/admin/site-settings`)
- 파비콘, 로고, 로그인 배경 이미지, OG 이미지 관리
- 사이트 메타데이터 설정

### 7. OCR 설정 (`/admin/ocr-settings`)
- Claude API OCR 파라미터 설정 (max_tokens 등)

## 관련 API

| API | 역할 |
|-----|------|
| `GET/POST /api/admin/sync-master-data` | 마스터 데이터 동기화 |
| `GET/POST/DELETE /api/admin/item-aliases` | 별칭 관리 |
| `GET/POST /api/admin/standard-items` | 표준 항목 관리 |
| `PATCH /api/admin/standard-items/[id]` | 표준 항목 수정 |
| `GET/PUT /api/admin/tier-config` | 티어 설정 |
| `GET/POST /api/admin/users` | 사용자 관리 |
| `GET/PUT /api/admin/site-settings` | 사이트 설정 |
| `GET/PUT /api/admin/ocr-settings` | OCR 설정 |
| `GET /api/admin/stats` | 관리자 통계 |
| `POST /api/admin/analyze-unmapped` | Unmapped 항목 AI 재분석 |
| `POST /api/admin/cleanup-unmapped` | Unmapped 항목 정리 |
