# Hybrid N-Step Mapping Logic (하이브리드 N단계 매핑 로직)

OCR이나 외부 데이터 소스에서 추출된 **비표준 텍스트를 표준 항목으로 매핑**하는 다단계 프로세스.
DB 기반 빠른 매칭과 AI 판단을 결합하여 정확도와 효율성을 모두 확보.

## 핵심 원칙

1. **단계별 비용 최적화**: 저비용(DB 조회) → 고비용(AI 호출) 순서로 시도
2. **점진적 학습**: 사용자 피드백을 저장하여 다음 매칭에 활용
3. **투명한 신뢰도**: 각 단계별로 신뢰도 점수 부여

## 5단계 매핑 프로세스

```
입력: 비표준 텍스트 (예: "Hct(ABL80F)", "ALP", "vLIP")

Step 1. 정규 항목 Exact Match ─────────────────────── 신뢰도: 100%
        → standard_items 테이블에서 name 검색 (case-insensitive)
        → 매칭되면 즉시 반환
        ↓ 실패

Step 2. Alias 테이블 Exact Match ──────────────────── 신뢰도: 95%
        → item_aliases 테이블에서 alias 검색
        → 매칭되면 canonical 항목으로 매핑 + source_hint 기록
        ↓ 실패

Step 3. 퍼지 매칭 (Levenshtein Distance) ─────────── 신뢰도: 70-89%
        → 유사도 70% 이상인 항목을 후보로 제안
        → 오타, 약어 처리 (예: "Creatine" → "Creatinine")
        ↓ 매칭 없음 또는 신뢰도 부족

Step 4. AI 판단 ───────────────────────────────────── 신뢰도: AI 반환값
        → Claude/GPT API 호출
        → 컨텍스트: 표준 항목 목록, 단위 정보, 도메인 지식
        → AI 응답: { standard_item_id, confidence, reasoning, is_new_item }
        ↓ AI가 기존 항목 매칭 불가 판단

Step 5. 신규 항목 등록 요청 ────────────────────────── 사용자 확인 필요
        → 사용자에게 신규 항목 등록 모달 표시
        → 등록 후 item_aliases에 자동 추가
```

## 데이터베이스 스키마

```sql
-- 표준 항목 테이블
CREATE TABLE standard_items (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name_ko VARCHAR(100),
  default_unit VARCHAR(20),
  category VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 별칭 매핑 테이블
CREATE TABLE item_aliases (
  id UUID PRIMARY KEY,
  alias VARCHAR(100) NOT NULL,
  canonical_name VARCHAR(100) REFERENCES standard_items(name),
  source_hint VARCHAR(100),  -- 장비명, 기관명 등
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(alias, source_hint)
);

-- 매핑 히스토리 (학습용)
CREATE TABLE item_mappings (
  id UUID PRIMARY KEY,
  raw_name VARCHAR(200) NOT NULL,
  standard_item_id UUID REFERENCES standard_items(id),
  mapping_source VARCHAR(20),  -- 'exact', 'alias', 'fuzzy', 'ai', 'user_manual'
  confidence_score NUMERIC(5,2),
  user_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 구현 코드

```typescript
interface MappingResult {
  standardItemId: string | null;
  standardItemName: string | null;
  confidence: number;
  source: 'exact' | 'alias' | 'fuzzy' | 'ai' | 'new_item';
  reasoning?: string;
  sourceHint?: string;
}

async function mapToStandardItem(
  rawName: string,
  unit?: string
): Promise<MappingResult> {

  // Step 1: 정규 항목 Exact Match
  const exactMatch = await db.standardItems.findFirst({
    where: { name: { equals: rawName, mode: 'insensitive' } }
  });
  if (exactMatch) {
    return {
      standardItemId: exactMatch.id,
      standardItemName: exactMatch.name,
      confidence: 100,
      source: 'exact'
    };
  }

  // Step 2: Alias Exact Match
  const aliasMatch = await db.itemAliases.findFirst({
    where: { alias: { equals: rawName, mode: 'insensitive' } },
    include: { standardItem: true }
  });
  if (aliasMatch) {
    return {
      standardItemId: aliasMatch.standardItem.id,
      standardItemName: aliasMatch.canonicalName,
      confidence: 95,
      source: 'alias',
      sourceHint: aliasMatch.sourceHint
    };
  }

  // Step 3: 퍼지 매칭
  const fuzzyMatches = await findFuzzyMatches(rawName, 0.7);
  if (fuzzyMatches.length > 0 && fuzzyMatches[0].similarity >= 0.7) {
    const confidence = Math.round(fuzzyMatches[0].similarity * 100);
    return {
      standardItemId: fuzzyMatches[0].item.id,
      standardItemName: fuzzyMatches[0].item.name,
      confidence: Math.min(confidence, 89), // 최대 89%
      source: 'fuzzy'
    };
  }

  // Step 4: AI 판단
  const aiResult = await callAIForMapping(rawName, unit);
  if (aiResult.isMatch) {
    return {
      standardItemId: aiResult.standardItemId,
      standardItemName: aiResult.standardItemName,
      confidence: aiResult.confidence,
      source: 'ai',
      reasoning: aiResult.reasoning
    };
  }

  // Step 5: 신규 항목 등록 요청
  return {
    standardItemId: null,
    standardItemName: null,
    confidence: 0,
    source: 'new_item',
    reasoning: aiResult.reasoning
  };
}
```

## AI 프롬프트 템플릿

```
다음 항목명이 기존 표준 항목 중 하나와 같은 항목인지, 아니면 신규 항목인지 판단해줘.

입력된 항목명: {input_name} (단위: {input_unit})

기존 표준 항목 목록:
{standard_items_list}

판단:
- match: 기존 항목과 동일하면 → standard_item_name, confidence(0-100), reasoning 반환
- new: 신규 항목이면 → is_new_item: true, 추천 정규명, 카테고리 반환
```

## 학습 피드백 루프

```typescript
// 사용자가 AI 제안을 승인
async function approveMapping(rawName: string, standardItemId: string, confidence: number) {
  // 1. 매핑 히스토리 저장
  await db.itemMappings.create({
    rawName,
    standardItemId,
    mappingSource: 'ai',
    confidenceScore: confidence,
    userVerified: true
  });

  // 2. 다음번 동일 rawName은 Step 2에서 바로 매칭되도록 alias 추가
  await db.itemAliases.create({
    alias: rawName,
    canonicalName: standardItem.name,
    sourceHint: 'user_approved'
  });
}

// 사용자가 AI 제안을 수정
async function correctMapping(rawName: string, correctedItemId: string) {
  await db.itemMappings.create({
    rawName,
    standardItemId: correctedItemId,
    mappingSource: 'user_manual',
    confidenceScore: 100,
    userVerified: true
  });

  // alias 추가하여 다음번 자동 매칭
  await db.itemAliases.create({
    alias: rawName,
    canonicalName: correctedItem.name,
    sourceHint: 'user_corrected'
  });
}
```

## 적용 도메인

| 도메인 | 비표준 입력 | 표준 항목 |
|--------|------------|----------|
| 의료 검사 | OCR 추출 항목명 | 표준 검사 항목 |
| 이커머스 | 판매자 상품명 | 표준 카탈로그 |
| 주소 정규화 | 다양한 주소 표기 | 표준 주소 체계 |
| 금융 | 거래 내역 설명 | 표준 분류 코드 |

## 참고

이 패턴은 Premuto 프로젝트의 혈액검사 OCR → 표준 항목 매핑 기능에서 도출되었습니다.
병원/장비마다 다른 항목명(예: ALP, ALKP, Alk Phos)을 하나의 표준 항목으로 통합합니다.
