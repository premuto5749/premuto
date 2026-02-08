# 마스터 데이터 DB SSoT 전환 + AI 고도화 계획

## Context

사용자가 OCR 후 AI 매핑 수행 시 원래 검사항목 명칭이 마스터 표준 명칭으로 치환되는데, 이 변환 과정을 더 명확히 보여주고, 마스터 데이터의 Source of Truth를 JSON 파일에서 DB로 전환하고, AI를 통해 지속적으로 마스터 데이터를 분석/고도화하는 시스템 구축.

---

## Phase A: DB 히스토리 인프라

**신규 파일**: `supabase/migrations/028_master_data_history.sql`

`master_data_history` 테이블:
- `entity_type`: 'standard_item' | 'alias'
- `entity_id`: UUID
- `action`: 'create' | 'update' | 'delete'
- `changes`: JSONB (필드별 old/new diff)
- `previous_values` / `new_values`: JSONB (전체 스냅샷, 롤백용)
- `source`: 'manual' | 'ai_suggestion' | 'sync' | 'rollback' | 'ai_match'
- `batch_id`: UUID (관련 변경 그룹핑)
- `user_id`, `created_at`

DB 트리거로 `standard_items_master`와 `item_aliases_master`의 모든 CUD 자동 로깅.

## Phase B: 히스토리 조회 + 롤백 API

**신규 파일**: `app/api/admin/master-data-history/route.ts`
- GET: 히스토리 조회 (entity_type, action, date range 필터 + 페이지네이션)

**신규 파일**: `app/api/admin/master-data-history/rollback/route.ts`
- POST: 롤백 실행
  - `action='create'` → DELETE
  - `action='update'` → previous_values로 복원
  - `action='delete'` → previous_values로 재생성
  - 롤백 자체도 히스토리에 기록 (source='rollback')

## Phase C: AI 분석 엔진 + 제안 시스템

**신규 파일**: `supabase/migrations/029_ai_suggestions.sql`

`ai_suggestions` 테이블:
- `type`: 'map_unmapped' | 'new_alias' | 'merge_items' | 'add_description' | 'new_item'
- `entity_id`, `target_id`: 관련 항목 UUID
- `confidence`, `reasoning`, `proposed_changes` (JSONB)
- `status`: 'pending' | 'approved' | 'rejected'
- `expires_at`: 30일 자동 만료

**신규 파일**: `app/api/admin/ai-evolution/route.ts`
- POST: AI 분석 실행 (4가지 분석 타입)
  1. **unmapped**: 미매핑 항목 중 기존 항목 매핑 또는 신규 생성 제안
  2. **alias_gaps**: `test_results.ocr_raw_name` 중 alias 미등록된 것의 alias 제안
  3. **similar_items**: 유사 항목 감지 및 병합 제안
  4. **description_gaps**: 설명 누락 항목 중 AI 설명 생성

**신규 파일**: `app/api/admin/ai-evolution/[id]/route.ts`
- PATCH: 제안 승인/거절
  - 승인 시 proposed_changes 자동 적용 (DB 트리거로 히스토리 기록)

## Phase D: Sync 엔드포인트 변경

**수정**: `app/api/admin/sync-master-data/route.ts`
- `seed` 모드 추가 (DB 비어있을 때만 초기 데이터 삽입)
- `full` 모드에 deprecation 경고 추가
- GET에서 JSON 비교 대신 DB 상태를 반환

## Phase E: 프론트엔드 UI

**신규 파일**: `app/admin/ai-evolution/page.tsx`
- AI 분석 트리거 버튼 4종 (unmapped/alias/similar/description)
- 대기중인 제안 목록 (confidence별 정렬)
- 각 제안: 타입 배지, 소스/타겟 이름, 신뢰도, 근거, 승인/거절 버튼
- 승인/거절 히스토리 탭

**신규 파일**: `app/admin/change-history/page.tsx`
- 타임라인 뷰 (필터: entity_type, action, date range)
- 각 항목: 타임스탬프, 이름, 액션 배지, 소스, 변경 diff, 롤백 버튼
- 배치 그룹 접기/펼치기

**수정**: `app/admin/master-data/page.tsx`
- "DB is SSoT" 상태 표시
- Full Reset 버튼 deprecation 표시
- AI 고도화 / 변경 히스토리 페이지 링크 추가

---

## 검증 방법

1. 마이그레이션 적용 후 admin 페이지에서 항목 CRUD 시 history 테이블에 자동 기록 확인
2. 히스토리 페이지에서 변경 이력 조회 + 롤백 테스트
3. AI 분석 실행 후 제안 생성 확인
4. 제안 승인 시 DB 반영 + 히스토리 기록 확인
5. 제안 거절 시 상태만 변경, 데이터 변경 없음 확인
