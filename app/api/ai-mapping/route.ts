import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import type { OcrResult, StandardItem, AiMappingSuggestion } from '@/types'
import {
  matchItemV3,
  type MatchResultV3,
  registerNewAlias,
  registerNewStandardItem,
  correctTruncatedUnit,
} from '@/lib/ocr/item-matcher-v3'

export const dynamic = 'force-dynamic'

// 최대 실행 시간 설정 (120초)
export const maxDuration = 120

// 배치 처리 설정 (rate limit: 30,000 tokens/min)
const AI_BATCH_SIZE = 30 // 한 번에 AI에게 보내는 항목 수 (더 크게)
const MAX_PARALLEL_BATCHES = 3 // 동시에 처리할 최대 배치 수
const MAX_RETRIES = 1 // 최대 재시도 횟수 (시간 절약)
const RETRY_DELAY_MS = 1000 // 재시도 시 기본 대기 시간 (1초)

// Anthropic 클라이언트는 런타임에 생성 (빌드 타임에 환경변수 없음)
function getAnthropicClient() {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })
}

// 지연 함수
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface RequestBody {
  batch_id: string
  ocr_results: OcrResult[]
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json()
    const { batch_id, ocr_results } = body

    if (!batch_id || !ocr_results || !Array.isArray(ocr_results)) {
      return NextResponse.json(
        { error: 'Invalid request body. Expecting batch_id and ocr_results array.' },
        { status: 400 }
      )
    }

    console.log(`🤖 AI Mapping started for batch ${batch_id} with ${ocr_results.length} items`)

    const supabase = await createClient()

    // 현재 사용자 ID 가져오기
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id

    // 1. DB에서 모든 표준 항목 가져오기
    const { data: standardItems, error: standardItemsError } = await supabase
      .from('standard_items_master')
      .select('*')

    if (standardItemsError) {
      console.error('❌ Failed to fetch standard items:', standardItemsError)
      return NextResponse.json(
        { error: 'Failed to fetch standard items from database' },
        { status: 500 }
      )
    }

    console.log(`📊 Loaded ${standardItems?.length || 0} standard items`)

    // 통계 추적
    let exactMatchCount = 0
    let aliasMatchCount = 0
    let aiMatchCount = 0
    let failedCount = 0

    // 3. 각 OCR 결과에 대해 매핑 수행 (1단계: 로컬/DB 매핑 먼저 처리)
    interface MappingResult {
      ocr_item: OcrResult
      suggested_mapping: AiMappingSuggestion | null
      needsAi?: boolean
      index: number
      isGarbage?: boolean
      garbageReason?: string
    }

    const mappingResults: MappingResult[] = []
    const itemsNeedingAi: { ocrItem: OcrResult; index: number }[] = []

    // 가비지 필터링된 항목 카운트
    let garbageCount = 0

    // 1단계: 하이브리드 v3 매칭으로 빠르게 처리할 수 있는 항목 먼저 처리
    for (let i = 0; i < ocr_results.length; i++) {
      const ocrItem = ocr_results[i]
      const itemName = ocrItem.raw_name || ocrItem.name

      // 단위 잘림 보정
      if (ocrItem.unit) {
        ocrItem.unit = correctTruncatedUnit(ocrItem.unit)
      }

      // 3-1. V3 하이브리드 매칭 (DB 기반: Step 0-2)
      const v3Match: MatchResultV3 = await matchItemV3(itemName, { supabase, userId })

      // Step 0: 가비지로 필터링된 경우
      if (v3Match.isGarbage) {
        garbageCount++
        console.log(`🗑️ Garbage filtered: "${itemName}" (${v3Match.garbageReason})`)
        // 가비지는 결과에서 제외
        mappingResults.push({
          ocr_item: ocrItem,
          suggested_mapping: null,
          isGarbage: true,
          garbageReason: v3Match.garbageReason,
          index: i
        })
        continue
      }

      if (v3Match.confidence >= 70 && v3Match.standardItemId) {
        // V3 매칭 성공 (exact 또는 alias)
        if (v3Match.method === 'exact') {
          exactMatchCount++
        } else {
          aliasMatchCount++
        }

        const methodLabel = v3Match.method === 'exact' ? '정규항목' :
                           v3Match.method === 'alias' ? '별칭' : v3Match.method

        console.log(`📍 V3 match (${methodLabel}): "${itemName}" → ${v3Match.standardItemName} (${v3Match.confidence}%)${v3Match.sourceHint ? ` [${v3Match.sourceHint}]` : ''}`)

        mappingResults.push({
          ocr_item: ocrItem,
          suggested_mapping: {
            standard_item_id: v3Match.standardItemId,
            standard_item_name: v3Match.standardItemName || '',
            display_name_ko: v3Match.displayNameKo || '',
            confidence: v3Match.confidence,
            reasoning: `V3 매칭 (${methodLabel}): ${v3Match.matchedAgainst || itemName}`,
            source_hint: v3Match.sourceHint || undefined,
          } as AiMappingSuggestion,
          index: i
        })
        continue
      }

      // 3-2. V3 매핑 실패 시 AI 매핑 필요 목록에 추가
      console.log(`🔍 No match for "${itemName}", will request AI suggestion...`)
      itemsNeedingAi.push({ ocrItem, index: i })
    }

    console.log(`📊 Phase 1 complete: Exact=${exactMatchCount}, Alias=${aliasMatchCount}, Need AI=${itemsNeedingAi.length}`)

    // 2단계: AI가 필요한 항목들을 병렬 배치로 처리 (속도 최적화)
    if (itemsNeedingAi.length > 0) {
      console.log(`🤖 Starting AI batch mapping for ${itemsNeedingAi.length} items in batches of ${AI_BATCH_SIZE}...`)

      // 배치로 나누기
      const batches: { ocrItem: OcrResult; index: number }[][] = []
      for (let i = 0; i < itemsNeedingAi.length; i += AI_BATCH_SIZE) {
        batches.push(itemsNeedingAi.slice(i, i + AI_BATCH_SIZE))
      }

      console.log(`📦 Created ${batches.length} batches, processing ${MAX_PARALLEL_BATCHES} in parallel`)

      // 배치 처리 함수
      const processBatch = async (batch: { ocrItem: OcrResult; index: number }[], batchIndex: number): Promise<MappingResult[]> => {
        const results: MappingResult[] = []
        console.log(`🔄 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} items)...`)

        try {
          const batchResults = await getAiMappingSuggestionBatch(
            batch.map(b => b.ocrItem),
            standardItems || [],
            supabase,
            userId
          )

          for (let i = 0; i < batch.length; i++) {
            const { ocrItem, index } = batch[i]
            const suggestion = batchResults[i] || null
            results.push({
              ocr_item: ocrItem,
              suggested_mapping: suggestion,
              index
            })
          }
          console.log(`✅ Batch ${batchIndex + 1} complete`)
        } catch (batchError) {
          console.error(`❌ Batch ${batchIndex + 1} failed:`, batchError)

          // 한 번만 재시도
          if (MAX_RETRIES > 0) {
            console.log(`⏳ Retrying batch ${batchIndex + 1}...`)
            await delay(RETRY_DELAY_MS)
            try {
              const batchResults = await getAiMappingSuggestionBatch(
                batch.map(b => b.ocrItem),
                standardItems || [],
                supabase,
                userId
              )
              for (let i = 0; i < batch.length; i++) {
                const { ocrItem, index } = batch[i]
                results.push({
                  ocr_item: ocrItem,
                  suggested_mapping: batchResults[i] || null,
                  index
                })
              }
              console.log(`✅ Batch ${batchIndex + 1} succeeded on retry`)
              return results
            } catch {
              console.error(`❌ Retry failed for batch ${batchIndex + 1}`)
            }
          }

          // 실패한 항목들
          for (const { ocrItem, index } of batch) {
            results.push({
              ocr_item: ocrItem,
              suggested_mapping: null,
              index
            })
          }
        }
        return results
      }

      // 병렬 처리 (MAX_PARALLEL_BATCHES 개씩)
      for (let i = 0; i < batches.length; i += MAX_PARALLEL_BATCHES) {
        const parallelBatches = batches.slice(i, i + MAX_PARALLEL_BATCHES)
        const parallelResults = await Promise.all(
          parallelBatches.map((batch, idx) => processBatch(batch, i + idx))
        )

        // 결과 합치기 및 통계 업데이트
        for (const batchResults of parallelResults) {
          for (const result of batchResults) {
            if (result.suggested_mapping) {
              aiMatchCount++
            } else {
              failedCount++
            }
            mappingResults.push(result)
          }
        }
      }
    }

    // 원래 순서대로 정렬
    mappingResults.sort((a, b) => a.index - b.index)

    // index 필드 제거, 가비지 정보 유지
    const finalResults = mappingResults.map(({ ocr_item, suggested_mapping, isGarbage, garbageReason }) => ({
      ocr_item,
      suggested_mapping,
      isGarbage: isGarbage || false,
      garbageReason: garbageReason || null,
    }))

    console.log(`✅ AI Mapping completed for batch ${batch_id}`)
    console.log(`📊 Stats: Exact=${exactMatchCount}, Alias=${aliasMatchCount}, AI=${aiMatchCount}, Garbage=${garbageCount}, Failed=${failedCount}`)

    return NextResponse.json({
      success: true,
      data: finalResults,
      stats: {
        total: ocr_results.length,
        exactMatch: exactMatchCount,
        aliasMatch: aliasMatchCount,
        aiMatch: aiMatchCount,
        garbage: garbageCount,
        failed: failedCount
      }
    })

  } catch (error) {
    console.error('AI Mapping API error:', error)

    // AI 사용량 제한 에러 처리
    if (error instanceof Anthropic.RateLimitError ||
        (error instanceof Error && error.message === 'AI_RATE_LIMIT')) {
      return NextResponse.json(
        {
          error: 'AI_RATE_LIMIT',
          message: 'AI 사용량 제한에 도달하였습니다. 잠시 후 다시 시도해주세요.'
        },
        { status: 429 }
      )
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// AI 판단 결과 타입 (mapping_logic.md 기반)
interface AiDecisionMatch {
  decision: 'match'
  canonical_name: string
  confidence: number
  reason: string
  source_hint?: string
}

interface AiDecisionNew {
  decision: 'new'
  recommended_name: string
  display_name_ko: string
  unit: string
  exam_type: string
  organ_tags: string[]
  confidence: number
  reason: string
}

type AiDecision = AiDecisionMatch | AiDecisionNew

interface AiBatchResult {
  idx: number
  decision: AiDecision | null
}

// AI를 통한 배치 매핑 제안 함수 (mapping_logic.md 프롬프트 템플릿 사용)
async function getAiMappingSuggestionBatch(
  ocrItems: OcrResult[],
  standardItems: StandardItem[],
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId?: string
): Promise<(AiMappingSuggestion | null)[]> {

  if (ocrItems.length === 0) {
    return []
  }

  // 표준 항목 목록을 포맷 (영문명 | 한글명 | 단위)
  const canonicalListWithUnits = standardItems
    .map(item =>
      `${item.name} | ${item.display_name_ko || '-'} | ${item.default_unit || '-'}`
    )
    .join('\n')

  // OCR 항목들을 번호 매겨서 포맷
  const ocrItemsList = ocrItems
    .map((item, idx) => {
      return `${idx + 1}. 항목명: "${item.raw_name || item.name}", 단위: "${item.unit || '-'}"`
    })
    .join('\n')

  // mapping_logic.md의 AI 프롬프트 템플릿
  const prompt = `당신은 수의학 검사 항목 전문가입니다.
다음 검사 항목명들이 기존 정규 항목 중 하나와 같은 검사인지,
아니면 신규 항목인지 판단해주세요.

## 입력 항목들
${ocrItemsList}

## 판단 기준
1. 측정 대상이 같은가?
2. 단위가 호환 가능한가?
3. 임상적으로 같은 트렌드로 볼 수 있는가?

## 기존 정규 항목 목록 (영문명 | 한글명 | 단위)
${canonicalListWithUnits}

## 응답 형식 (JSON 배열만, 다른 텍스트 없이)
각 항목에 대해:

기존 항목 변형인 경우:
{
  "idx": 항목번호,
  "decision": {
    "decision": "match",
    "canonical_name": "매칭되는 정규 항목명 (영문)",
    "confidence": 0.95,
    "reason": "판단 근거",
    "source_hint": "장비/방법 힌트 (있다면)"
  }
}

신규 항목인 경우:
{
  "idx": 항목번호,
  "decision": {
    "decision": "new",
    "recommended_name": "추천 정규명 (영문)",
    "display_name_ko": "한글 표시명",
    "unit": "단위",
    "exam_type": "Vital|CBC|Chemistry|Special|Blood Gas|Coagulation|뇨검사|안과검사|Echo|기타",
    "organ_tags": ["장기태그1", "장기태그2"],
    "confidence": 0.9,
    "reason": "판단 근거"
  }
}

판단 불가능한 경우:
{
  "idx": 항목번호,
  "decision": null
}

응답: [...]`

  const message = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000, // 신규 항목 생성 시 더 많은 토큰 필요 (30개 배치)
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ],
  })

  const textContent = message.content.find(block => block.type === 'text')
  const content = textContent?.type === 'text' ? textContent.text : null

  if (!content) {
    throw new Error('No response from AI mapping service')
  }

  // JSON 배열 파싱 (markdown fence 제거 + 잘린 JSON 복구)
  try {
    // 1. markdown fence 제거
    let cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()

    // 2. JSON 배열 추출
    const arrayStart = cleaned.indexOf('[')
    if (arrayStart === -1) {
      throw new Error('No JSON array found in AI response')
    }
    cleaned = cleaned.substring(arrayStart)

    // 3. 파싱 시도
    let results: AiBatchResult[]
    try {
      results = JSON.parse(cleaned)
    } catch {
      // 4. 잘린 JSON 복구 시도: 마지막 완전한 객체까지만 사용
      console.warn('⚠️ JSON truncated, attempting recovery...')
      const lastCompleteObj = cleaned.lastIndexOf('},')
      if (lastCompleteObj === -1) {
        // 완전한 객체가 하나도 없으면 단일 객체로 시도
        const singleObj = cleaned.lastIndexOf('}')
        if (singleObj > 0) {
          cleaned = cleaned.substring(0, singleObj + 1) + ']'
        } else {
          throw new Error('No recoverable JSON found in AI response')
        }
      } else {
        cleaned = cleaned.substring(0, lastCompleteObj + 1) + ']'
      }
      results = JSON.parse(cleaned)
      console.log(`✅ JSON recovery succeeded: ${results.length} items recovered`)
    }

    // 결과를 원래 순서대로 매핑
    const suggestions: (AiMappingSuggestion | null)[] = new Array(ocrItems.length).fill(null)

    for (const result of results) {
      const itemIndex = result.idx - 1 // 1-based to 0-based
      if (itemIndex < 0 || itemIndex >= ocrItems.length) {
        console.warn(`⚠️ Invalid index in AI response: ${result.idx}`)
        continue
      }

      const ocrItem = ocrItems[itemIndex]
      const inputName = ocrItem.raw_name || ocrItem.name

      // 판단 불가능한 경우
      if (!result.decision) {
        console.log(`🔴 AI could not decide: "${inputName}"`)
        suggestions[itemIndex] = null
        continue
      }

      const decision = result.decision

      // confidence < 0.7 → Unmapped로 저장
      if (decision.confidence < 0.7) {
        console.log(`🟡 Low confidence (${decision.confidence}): "${inputName}" → Unmapped`)
        suggestions[itemIndex] = null
        continue
      }

      // decision: "match" → 기존 항목 변형
      if (decision.decision === 'match') {
        const matchDecision = decision as AiDecisionMatch

        // 이름으로 표준 항목 찾기 (case-insensitive)
        const matchedItem = standardItems.find(
          si => si.name.toLowerCase() === matchDecision.canonical_name.toLowerCase()
        )

        if (!matchedItem) {
          console.warn(`⚠️ AI returned unknown item name: "${matchDecision.canonical_name}"`)
          suggestions[itemIndex] = null
          continue
        }

        // aliases에 새 alias 자동 등록 (사용자별 테이블에 저장)
        const aliasRegistered = await registerNewAlias(
          inputName,
          matchDecision.canonical_name,
          matchDecision.source_hint || null,
          supabase,
          userId
        )

        if (aliasRegistered) {
          console.log(`✅ AI match + alias registered: "${inputName}" → ${matchDecision.canonical_name}`)
        } else {
          console.log(`🟡 AI match (alias registration failed): "${inputName}" → ${matchDecision.canonical_name}`)
        }

        suggestions[itemIndex] = {
          standard_item_id: matchedItem.id,
          standard_item_name: matchedItem.name,
          display_name_ko: matchedItem.display_name_ko || '',
          confidence: Math.round(matchDecision.confidence * 100),
          reasoning: matchDecision.reason || 'AI 자동 매칭',
          source_hint: matchDecision.source_hint,
        }
        continue
      }

      // decision: "new" → 신규 항목
      if (decision.decision === 'new') {
        const newDecision = decision as AiDecisionNew

        // standard_items에 신규 항목 생성 (사용자별 테이블에 저장)
        const newItemResult = await registerNewStandardItem({
          name: newDecision.recommended_name,
          displayNameKo: newDecision.display_name_ko,
          unit: newDecision.unit,
          examType: newDecision.exam_type,
          organTags: newDecision.organ_tags,
        }, supabase, userId)

        if (newItemResult.success && newItemResult.id) {
          console.log(`✅ AI new item created: "${newDecision.recommended_name}" (${newDecision.display_name_ko})`)

          // 원본 입력명 ≠ recommended_name이면 alias도 등록 (사용자별 테이블에 저장)
          if (inputName.toLowerCase() !== newDecision.recommended_name.toLowerCase()) {
            await registerNewAlias(
              inputName,
              newDecision.recommended_name,
              null,
              supabase,
              userId
            )
          }

          suggestions[itemIndex] = {
            standard_item_id: newItemResult.id,
            standard_item_name: newDecision.recommended_name,
            display_name_ko: newDecision.display_name_ko,
            confidence: Math.round(newDecision.confidence * 100),
            reasoning: `AI 신규 항목 생성: ${newDecision.reason}`,
          }
        } else {
          console.error(`❌ Failed to create new item: ${newItemResult.error}`)
          suggestions[itemIndex] = null
        }
        continue
      }
    }

    return suggestions
  } catch (parseError) {
    console.error('❌ Failed to parse AI mapping response:', parseError)
    console.error('📄 Raw AI response:', content)
    throw new Error('Failed to parse AI mapping result')
  }
}
