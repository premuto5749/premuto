# Confidence-Based UX Pattern (신뢰도 기반 UX 패턴)

AI/ML 모델의 예측 결과를 사용자에게 제시할 때, **신뢰도 점수에 따라 사용자 개입 수준을 조절**하는 UX 패턴.

## 핵심 원칙

1. **신뢰도 시각화**: AI 결과의 확신 정도를 명확하게 표시
2. **선택적 개입**: 신뢰도가 높은 항목은 자동 처리, 낮은 항목만 사용자 검토
3. **효율적 검수**: 사용자의 주의를 가장 필요한 곳에 집중

## 3단계 신뢰도 분류

| 등급 | 신뢰도 | 색상 | 사용자 액션 | 설명 |
|-----|--------|------|------------|------|
| 🟢 높음 | ≥ 90% | 녹색 | 자동 승인 | 확인만 표시, 원클릭 승인 |
| 🟡 보통 | 70-89% | 노란색 | 확인 권장 | 사용자가 검토 후 승인 또는 수정 |
| 🔴 낮음 | < 70% | 빨간색 | 필수 개입 | 수동 선택 또는 신규 생성 |

## 적용 도메인

| 도메인 | AI 태스크 | 신뢰도 활용 |
|--------|----------|------------|
| 문서 처리 | OCR → 항목 매핑 | 매핑 정확도에 따른 검수 우선순위 |
| 번역 | 자동 번역 | 번역 품질 점수에 따른 교정 요청 |
| 이미지 분류 | 사진 태깅 | 불확실한 태그만 사용자 확인 |
| 추천 시스템 | 상품 추천 | 추천 근거 신뢰도 표시 |
| 데이터 입력 | 자동완성 | 제안 정확도에 따른 UI 차별화 |

## UI 컴포넌트 설계

### 1. 신뢰도 배지 (Confidence Badge)

```tsx
interface ConfidenceBadgeProps {
  confidence: number;
  showPercentage?: boolean;
}

function ConfidenceBadge({ confidence, showPercentage = true }: ConfidenceBadgeProps) {
  const level = confidence >= 90 ? 'high' : confidence >= 70 ? 'medium' : 'low';
  const colors = {
    high: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-red-100 text-red-800'
  };
  const labels = { high: '높음', medium: '보통', low: '낮음' };

  return (
    <span className={`px-2 py-1 rounded text-sm ${colors[level]}`}>
      {labels[level]} {showPercentage && `(${confidence}%)`}
    </span>
  );
}
```

### 2. 검수 리스트 정렬

**핵심**: 신뢰도 낮은 항목을 상단에 배치하여 사용자 주의 집중

```typescript
function sortByConfidence(items: MappedItem[]): MappedItem[] {
  return items.sort((a, b) => {
    // 1차: 신뢰도 등급 (낮음 → 보통 → 높음)
    const levelA = getConfidenceLevel(a.confidence);
    const levelB = getConfidenceLevel(b.confidence);
    if (levelA !== levelB) return levelA - levelB;

    // 2차: 같은 등급 내에서 신뢰도 오름차순
    return a.confidence - b.confidence;
  });
}
```

### 3. 일괄 승인 버튼

```tsx
<div className="flex gap-2">
  <Button onClick={approveHighConfidence}>
    🟢 높은 신뢰도 모두 승인 ({highCount}개)
  </Button>
  <Button variant="outline" onClick={reviewRemaining}>
    🟡🔴 나머지 검토 ({lowCount}개)
  </Button>
</div>
```

## 매핑 소스 표시

AI 결과의 출처를 함께 표시하여 투명성 확보:

| 아이콘 | 소스 | 설명 |
|--------|------|------|
| 🤖 | AI 자동 매핑 | 모델이 자동으로 제안 |
| ✓ | 사용자 승인 | AI 제안을 사용자가 확인 |
| ✏️ | 사용자 수동 입력 | 사용자가 직접 선택/입력 |
| 📚 | 학습 데이터 | 이전 사용자 피드백으로 학습됨 |

## 학습 피드백 루프

```typescript
async function handleUserDecision(
  item: MappedItem,
  decision: 'approve' | 'modify',
  modifiedValue?: string
) {
  if (decision === 'approve') {
    // AI 제안 승인 → 매핑 히스토리에 기록
    await saveMappingHistory({
      rawName: item.rawName,
      mappedTo: item.suggestedMapping,
      source: 'user_approved',
      confidence: item.confidence
    });
  } else {
    // 사용자 수정 → 수정된 값으로 기록 + AI 피드백
    await saveMappingHistory({
      rawName: item.rawName,
      mappedTo: modifiedValue,
      source: 'user_manual',
      confidence: 100
    });
    // 다음번 동일 rawName 발견 시 자동 매핑
  }
}
```

## 프로그레스 피드백

처리 진행 상황을 실시간으로 표시:

```
AI 매핑 진행 중...
━━━━━━━━━━━━━━━━━━━━ 75%
30개 항목 중 25개 매핑 완료

🟢 높음: 18개  🟡 보통: 5개  🔴 낮음: 2개
```

## 임계값 커스터마이징

도메인에 따라 신뢰도 임계값 조정 가능:

```typescript
interface ConfidenceThresholds {
  high: number;    // 기본: 90
  medium: number;  // 기본: 70
}

// 의료 도메인: 더 엄격한 기준
const medicalThresholds: ConfidenceThresholds = { high: 95, medium: 80 };

// 일반 분류: 기본 기준
const defaultThresholds: ConfidenceThresholds = { high: 90, medium: 70 };
```

## 참고

이 패턴은 Premuto 프로젝트의 혈액검사 OCR → 표준 항목 매핑 기능에서 도출되었습니다.
GPT-4o가 매핑을 제안하고 신뢰도 점수를 반환하면, 신뢰도가 낮은 항목만 사용자가 검토합니다.
