# 티어 시스템 (Tier System)

Premuto의 사용량 제한 및 요금 체계를 관리하는 시스템입니다.

## 티어 구조

| 항목 | Free (무료) | Basic (기본) | Premium (프리미엄) |
|------|------------|-------------|-------------------|
| OCR 분석 | 2회/일 | 5회/일 | 무제한 |
| OCR 최대 파일 수 | 3개 | 5개 | 10개 |
| 일일 기록 사진 | 3장 | 5장 | 10장 |
| 사진 최대 크기 | 5MB | 10MB | 10MB |
| AI 설명 생성 | 잠금 | 30회/일 | 무제한 |
| 상세 Excel 내보내기 | 1회/월 | 무제한 | 무제한 |

> 제한값은 관리자 페이지(`/admin/tier-config`)에서 변경 가능하며, `app_settings` 테이블의 `tier_config` 키에 저장됩니다.

## 핵심 파일

| 파일 | 역할 |
|------|------|
| `lib/tier.ts` | 티어 조회, 사용량 체크/기록, 제한 확인 함수 |
| `app/api/tier/route.ts` | 사용자 티어 및 사용량 조회 API |
| `app/admin/tier-config/page.tsx` | 관리자 티어 설정 UI |
| `app/api/admin/tier-config/route.ts` | 관리자 티어 설정 API |

## 데이터 구조

### user_profiles 테이블
```sql
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  tier VARCHAR DEFAULT 'free',  -- 'free' | 'basic' | 'premium'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### usage_logs 테이블
```sql
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action VARCHAR NOT NULL,
  file_count INTEGER DEFAULT 1,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### action 종류

| action | 설명 | 제한 주기 |
|--------|------|----------|
| `ocr_analysis` | OCR 분석 실행 | 일일 |
| `description_generation` | AI 설명 생성 | 일일 |
| `detailed_export` | 상세 Excel 내보내기 | 월간 |

### app_settings 테이블 (tier_config)
```sql
-- key = 'tier_config'
-- value = JSON (TierConfigMap)
```

## 사용량 체크 로직 (`lib/tier.ts`)

### 일일 제한 체크
```
checkUsageLimit(userId, action)
→ getUserTier() + getTierConfig() + getTodayUsage() 병렬 조회
→ { allowed, tier, used, limit, remaining }
```

### 월간 제한 체크
```
checkMonthlyUsageLimit(userId, action)
→ getUserTier() + getTierConfig() + getMonthlyUsage() 병렬 조회
→ { allowed, tier, used, limit, remaining }
```

### 시간대 기준
- KST (UTC+9) 기준으로 일일/월간 리셋

## 적용 위치

| API | action | 제한 유형 |
|-----|--------|----------|
| `POST /api/ocr-batch` | `ocr_analysis` | 일일 |
| `POST /api/generate-descriptions` | `description_generation` | 일일 |
| `POST /api/daily-logs/export-detailed` | `detailed_export` | 월간 |
