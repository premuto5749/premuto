import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import type { OcrResult, StandardItem, AiMappingSuggestion } from '@/types'
import { matchItem } from '@/lib/ocr/item-matcher'
import {
  matchItemV3,
  type MatchResultV3,
  registerNewAlias,
  registerNewStandardItem,
  correctTruncatedUnit,
} from '@/lib/ocr/item-matcher-v3'

// 최대 실행 시간 설정 (60초)
export const maxDuration = 60

// 배치 처리 설정 (rate limit: 30,000 tokens/min)
const AI_BATCH_SIZE = 10 // 한 번에 AI에게 보내는 항목 수
const BATCH_DELAY_MS = 3000 // 배치 간 대기 시간 (3초)
const MAX_RETRIES = 3 // 최대 재시도 횟수
const RETRY_DELAY_MS = 5000 // 재시도 시 기본 대기 시간 (5초)

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

    // 2. 기존 매핑 사전 가져오기
    const { data: existingMappings, error: mappingsError } = await supabase
      .from('item_mappings_master')
      .select('raw_name, standard_item_id, confidence_score, mapping_source')

    if (mappingsError) {
      console.error('❌ Failed to fetch item mappings:', mappingsError)
      return NextResponse.json(
        { error: 'Failed to fetch item mappings from database' },
        { status: 500 }
      )
    }

    // 매핑 사전을 Map으로 변환 (빠른 조회)
    const mappingsMap = new Map(
      existingMappings?.map(m => [m.raw_name.toLowerCase(), m]) || []
    )

    // 표준 항목을 이름으로 빠르게 조회하기 위한 Map
    const standardItemsByName = new Map(
      standardItems?.map(si => [si.name.toLowerCase(), si]) || []
    )

    // 유연한 DB 항목 검색 함수
    const findStandardItemFlexible = (searchName: string): StandardItem | null => {
      if (!standardItems) return null

      const normalized = searchName.toLowerCase().trim()

      // 1. 정확한 매칭
      const exact = standardItemsByName.get(normalized)
      if (exact) return exact

      // 2. 공백/특수문자 제거 후 매칭
      const cleanSearch = normalized.replace(/[\s\-_()]/g, '')
      for (const item of standardItems) {
        const cleanItem = item.name.toLowerCase().replace(/[\s\-_()]/g, '')
        if (cleanItem === cleanSearch) return item
      }

      // 3. 부분 매칭 (검색어가 DB 항목에 포함되거나 그 반대)
      for (const item of standardItems) {
        const itemLower = item.name.toLowerCase()
        if (itemLower.includes(normalized) || normalized.includes(itemLower)) {
          return item
        }
      }

      // 4. 한글명으로 매칭
      for (const item of standardItems) {
        if (item.display_name_ko && item.display_name_ko === searchName) {
          return item
        }
      }

      return null
    }

    console.log(`📊 Loaded ${standardItems?.length || 0} standard items and ${existingMappings?.length || 0} existing mappings`)

    // 통계 추적
    let localMatchCount = 0
    let dbMatchCount = 0
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
      const v3Match: MatchResultV3 = await matchItemV3(itemName, { supabase })

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
          localMatchCount++ // exact match는 로컬 카운트로
        } else {
          dbMatchCount++ // alias는 DB 카운트로
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

      // 3-2. V3 실패 시 기존 로컬 매칭 fallback (JSON 설정 기반)
      const localMatch = matchItem(itemName)

      if (localMatch.confidence >= 70 && localMatch.standardItemName) {
        const standardItem = findStandardItemFlexible(localMatch.standardItemName)

        if (standardItem) {
          localMatchCount++
          console.log(`📍 Local fallback: "${itemName}" → ${standardItem.name} (${localMatch.confidence}%, ${localMatch.method})`)

          mappingResults.push({
            ocr_item: ocrItem,
            suggested_mapping: {
              standard_item_id: standardItem.id,
              standard_item_name: standardItem.name,
              display_name_ko: standardItem.display_name_ko || localMatch.displayNameKo || '',
              confidence: localMatch.confidence,
              reasoning: `로컬 매칭 (${localMatch.method}): ${localMatch.matchedAgainst || itemName}`
            } as AiMappingSuggestion,
            index: i
          })
          continue
        }
      }

      // 3-3. DB 매핑 사전에서 조회 (기존 item_mappings 테이블 - 하위 호환)
      const existingMapping = mappingsMap.get(itemName.toLowerCase())

      if (existingMapping) {
        // 기존 매핑이 있으면 해당 표준 항목 정보 반환
        const standardItem = standardItems?.find(
          si => si.id === existingMapping.standard_item_id
        )

        if (standardItem) {
          dbMatchCount++
          console.log(`✅ DB mapping: ${itemName} → ${standardItem.name}`)
          mappingResults.push({
            ocr_item: ocrItem,
            suggested_mapping: {
              standard_item_id: standardItem.id,
              standard_item_name: standardItem.name,
              display_name_ko: standardItem.display_name_ko || '',
              confidence: 100, // 기존 매핑은 100% 신뢰도
              reasoning: `기존 매핑 사전에서 발견됨 (출처: ${existingMapping.mapping_source || 'manual'})`
            } as AiMappingSuggestion,
            index: i
          })
          continue
        }
      }

      // 3-3. 로컬/DB 매핑 모두 실패 시 AI 매핑 필요 목록에 추가
      console.log(`🔍 No match for "${itemName}", will request AI suggestion...`)
      itemsNeedingAi.push({ ocrItem, index: i })
    }

    console.log(`📊 Phase 1 complete: Local/DB matches=${mappingResults.length}, Need AI=${itemsNeedingAi.length}`)

    // 2단계: AI가 필요한 항목들을 배치로 처리
    if (itemsNeedingAi.length > 0) {
      console.log(`🤖 Starting AI batch mapping for ${itemsNeedingAi.length} items in batches of ${AI_BATCH_SIZE}...`)

      // 배치로 나누기
      const batches: { ocrItem: OcrResult; index: number }[][] = []
      for (let i = 0; i < itemsNeedingAi.length; i += AI_BATCH_SIZE) {
        batches.push(itemsNeedingAi.slice(i, i + AI_BATCH_SIZE))
      }

      console.log(`📦 Created ${batches.length} batches`)

      // 각 배치를 순차적으로 처리 (rate limit 방지)
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex]
        console.log(`🔄 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} items)...`)

        // 첫 번째 배치가 아니면 대기
        if (batchIndex > 0) {
          console.log(`⏳ Waiting ${BATCH_DELAY_MS}ms before next batch...`)
          await delay(BATCH_DELAY_MS)
        }

        // 배치 내 항목들을 한 번에 AI에게 요청
        try {
          const batchResults = await getAiMappingSuggestionBatch(
            batch.map(b => b.ocrItem),
            standardItems || [],
            supabase
          )

          // 결과 매핑
          for (let i = 0; i < batch.length; i++) {
            const { ocrItem, index } = batch[i]
            const suggestion = batchResults[i] || null

            if (suggestion) {
              aiMatchCount++
            } else {
              failedCount++
            }

            mappingResults.push({
              ocr_item: ocrItem,
              suggested_mapping: suggestion,
              index
            })
          }

          console.log(`✅ Batch ${batchIndex + 1} complete`)
        } catch (batchError) {
          console.error(`❌ Batch ${batchIndex + 1} failed:`, batchError)

          // Rate limit 에러인 경우 재시도
          if (batchError instanceof Anthropic.RateLimitError ||
              (batchError instanceof Error && (
                batchError.message.includes('rate_limit') ||
                batchError.message.includes('quota') ||
                batchError.message.includes('429')
              ))) {

            // 재시도 로직
            let retrySuccess = false
            for (let retry = 0; retry < MAX_RETRIES; retry++) {
              const retryDelay = RETRY_DELAY_MS * Math.pow(2, retry) // 지수 백오프: 5s, 10s, 20s
              console.log(`⏳ Rate limited. Retry ${retry + 1}/${MAX_RETRIES} after ${retryDelay}ms...`)
              await delay(retryDelay)

              try {
                const batchResults = await getAiMappingSuggestionBatch(
                  batch.map(b => b.ocrItem),
                  standardItems || [],
                  supabase
                )

                for (let i = 0; i < batch.length; i++) {
                  const { ocrItem, index } = batch[i]
                  const suggestion = batchResults[i] || null

                  if (suggestion) {
                    aiMatchCount++
                  } else {
                    failedCount++
                  }

                  mappingResults.push({
                    ocr_item: ocrItem,
                    suggested_mapping: suggestion,
                    index
                  })
                }

                retrySuccess = true
                console.log(`✅ Batch ${batchIndex + 1} succeeded on retry ${retry + 1}`)
                break
              } catch (retryError) {
                console.error(`❌ Retry ${retry + 1} failed:`, retryError)
              }
            }

            if (!retrySuccess) {
              // 모든 재시도 실패 - 이 배치 항목들을 실패로 처리
              console.error(`❌ All retries failed for batch ${batchIndex + 1}`)
              for (const { ocrItem, index } of batch) {
                failedCount++
                mappingResults.push({
                  ocr_item: ocrItem,
                  suggested_mapping: null,
                  index
                })
              }
            }
          } else {
            // 다른 에러인 경우 해당 배치 항목들을 실패로 처리
            for (const { ocrItem, index } of batch) {
              failedCount++
              mappingResults.push({
                ocr_item: ocrItem,
                suggested_mapping: null,
                index
              })
            }
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
    console.log(`📊 Stats: Local=${localMatchCount}, DB=${dbMatchCount}, AI=${aiMatchCount}, Garbage=${garbageCount}, Failed=${failedCount}`)

    return NextResponse.json({
      success: true,
      data: finalResults,
      stats: {
        total: ocr_results.length,
        localMatch: localMatchCount,
        dbMatch: dbMatchCount,
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
  description_common: string
  description_high: string
  description_low: string
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
  supabase: Awaited<ReturnType<typeof createClient>>
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
    "description_common": "항목 설명",
    "description_high": "수치 높을 때 의미",
    "description_low": "수치 낮을 때 의미",
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
    max_tokens: 4000, // 신규 항목 생성 시 더 많은 토큰 필요
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

  // JSON 배열 파싱
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('No JSON array found in AI response')
    }

    const results: AiBatchResult[] = JSON.parse(jsonMatch[0])

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
          descriptionCommon: newDecision.description_common,
          descriptionHigh: newDecision.description_high,
          descriptionLow: newDecision.description_low,
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
