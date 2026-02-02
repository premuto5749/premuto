# Reference Snapshot Pattern (참고치 스냅샷 패턴)

시계열 데이터에서 **기준값(참고치)이 시간에 따라 변할 수 있는 경우**의 데이터 설계 패턴.

## 핵심 원칙

**절대 규칙**: 기준값은 고정불변이 아니다.

1. **스냅샷 저장**: 측정 결과 저장 시, **그 당시의 기준값(Min/Max)**을 결과 데이터와 함께 저장
2. **글로벌 기준값 금지**: 마스터 테이블에 "기본 기준값"이 있더라도, 실제 판정은 **해당 측정 당시의 기준값**으로만 수행
3. **출처별 기준값 차이 인정**: 같은 항목이라도 장비/기관/시점에 따라 기준값이 다를 수 있음

## 적용 도메인

| 도메인 | 기준값 예시 | 변동 원인 |
|--------|------------|----------|
| 의료 검사 | 혈액 검사 정상 범위 | 장비 교체, 시약 변경, 가이드라인 업데이트 |
| 금융 | 신용등급 기준, 이자율 | 정책 변경, 시장 상황 |
| 제조 품질 | 허용 공차, 불량률 기준 | 공정 개선, 품질 기준 강화 |
| IoT 센서 | 정상 범위 임계값 | 센서 캘리브레이션, 환경 변화 |

## 데이터베이스 스키마 설계

```sql
-- 측정 결과 테이블 (각 결과마다 당시 기준값 저장)
CREATE TABLE measurement_results (
  id UUID PRIMARY KEY,
  item_id UUID REFERENCES standard_items(id),
  value NUMERIC NOT NULL,
  unit VARCHAR(20),

  -- 스냅샷 기준값 (측정 당시의 값)
  ref_min NUMERIC,           -- 당시 최소 기준값
  ref_max NUMERIC,           -- 당시 최대 기준값
  ref_text VARCHAR(100),     -- 텍스트 형태 기준값 (예: "<10", "음성")
  ref_source VARCHAR(100),   -- 기준값 출처 (장비명, 기관명)

  measured_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 판정 로직

```typescript
function evaluateStatus(value: number, refMin: number | null, refMax: number | null): Status {
  if (refMin === null && refMax === null) {
    return 'unknown'; // 기준값 없음 - 판정 불가
  }

  if (refMin !== null && value < refMin) {
    return 'low';   // 🔵
  }

  if (refMax !== null && value > refMax) {
    return 'high';  // 🔴
  }

  return 'normal';  // 🟢
}
```

## UI 표시 규칙

### 1. 기준값 변경 감지
같은 항목이지만 이전 측정과 기준값이 바뀐 경우 시각적으로 표시:

```
⚠️ 기준값 변경됨
현재: 0.5-1.8 mg/dL
이전: 0-10 mg/dL (2024-12-01)
```

### 2. Tooltip 필수 정보
각 데이터 포인트에 마우스 오버 시 표시:
- 측정일
- 결과값 + 단위
- 당시 기준값
- 판정 상태
- 출처(장비명/기관명)

### 3. 시계열 그래프
- 기준값 범위가 측정마다 다를 수 있으므로, **가장 최근 측정의 기준값**을 기본 밴드로 표시
- 기준값 변경 지점에 수직 점선 표시
- 범례: "기준값: 측정마다 상이함"

## 안티패턴

```typescript
// ❌ 잘못된 예: 글로벌 기준값으로 판정
const GLOBAL_REF = { min: 0.5, max: 1.8 };
const status = evaluate(result.value, GLOBAL_REF);

// ✅ 올바른 예: 저장된 스냅샷 기준값으로 판정
const status = evaluate(result.value, result.ref_min, result.ref_max);
```

## 참고

이 패턴은 Premuto 프로젝트의 혈액검사 아카이브 기능에서 도출되었습니다.
같은 Creatinine 검사라도 Hitachi 장비(0-10), IDEXX 장비(0-9), Fuji 장비(0.5-1.8)로
기준값이 다를 수 있어, 각 결과마다 당시 기준값을 함께 저장합니다.
