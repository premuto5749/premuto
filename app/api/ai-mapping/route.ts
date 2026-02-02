import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import type { OcrResult, StandardItem, AiMappingSuggestion } from '@/types'
import { matchItem } from '@/lib/ocr/item-matcher'

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

    // 1. DB에서 모든 표준 항목 가져오기
    const { data: standardItems, error: standardItemsError } = await supabase
      .from('standard_items')
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
      .from('item_mappings')
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
      existingMappings?.map(m => [m.raw_name.toUpperCase(), m]) || []
    )

    // 표준 항목을 이름으로 빠르게 조회하기 위한 Map
    const standardItemsByName = new Map(
      standardItems?.map(si => [si.name.toUpperCase(), si]) || []
    )

    // 유연한 DB 항목 검색 함수
    const findStandardItemFlexible = (searchName: string): StandardItem | null => {
      if (!standardItems) return null

      const normalized = searchName.toUpperCase().trim()

      // 1. 정확한 매칭
      const exact = standardItemsByName.get(normalized)
      if (exact) return exact

      // 2. 공백/특수문자 제거 후 매칭
      const cleanSearch = normalized.replace(/[\s\-_()]/g, '')
      for (const item of standardItems) {
        const cleanItem = item.name.toUpperCase().replace(/[\s\-_()]/g, '')
        if (cleanItem === cleanSearch) return item
      }

      // 3. 부분 매칭 (검색어가 DB 항목에 포함되거나 그 반대)
      for (const item of standardItems) {
        const itemUpper = item.name.toUpperCase()
        if (itemUpper.includes(normalized) || normalized.includes(itemUpper)) {
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
    }

    const mappingResults: MappingResult[] = []
    const itemsNeedingAi: { ocrItem: OcrResult; index: number }[] = []

    // 1단계: 로컬/DB 매핑으로 빠르게 처리할 수 있는 항목 먼저 처리
    for (let i = 0; i < ocr_results.length; i++) {
      const ocrItem = ocr_results[i]
      const itemName = ocrItem.raw_name || ocrItem.name

      // 3-1. 로컬 매핑 우선 시도 (JSON 설정 기반)
      const localMatch = matchItem(itemName)

      if (localMatch.confidence >= 70 && localMatch.standardItemName) {
        // 로컬 매칭 성공 - DB에서 유연하게 표준 항목 찾기
        const standardItem = findStandardItemFlexible(localMatch.standardItemName)

        if (standardItem) {
          localMatchCount++
          console.log(`📍 Local match: "${itemName}" → ${standardItem.name} (${localMatch.confidence}%, ${localMatch.method})`)

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

        // DB에 없는 경우 - 한글명으로도 시도
        const standardItemByKo = localMatch.displayNameKo
          ? findStandardItemFlexible(localMatch.displayNameKo)
          : null

        if (standardItemByKo) {
          localMatchCount++
          console.log(`📍 Local match (한글명): "${itemName}" → ${standardItemByKo.name}`)

          mappingResults.push({
            ocr_item: ocrItem,
            suggested_mapping: {
              standard_item_id: standardItemByKo.id,
              standard_item_name: standardItemByKo.name,
              display_name_ko: standardItemByKo.display_name_ko || localMatch.displayNameKo || '',
              confidence: localMatch.confidence - 5, // 한글명 매칭은 신뢰도 약간 낮춤
              reasoning: `로컬 매칭 (한글명): ${localMatch.displayNameKo}`
            } as AiMappingSuggestion,
            index: i
          })
          continue
        }

        // 여전히 DB에 없으면 AI 매칭으로 진행 (로컬 정보 활용)
        console.log(`⚠️ Local match found but not in DB: ${localMatch.standardItemName}, proceeding to AI matching`)
      }

      // 3-2. DB 매핑 사전에서 조회
      const existingMapping = mappingsMap.get(itemName.toUpperCase())

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
            standardItems || []
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
                  standardItems || []
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

    // index 필드 제거
    const finalResults = mappingResults.map(({ ocr_item, suggested_mapping }) => ({
      ocr_item,
      suggested_mapping
    }))

    console.log(`✅ AI Mapping completed for batch ${batch_id}`)
    console.log(`📊 Stats: Local=${localMatchCount}, DB=${dbMatchCount}, AI=${aiMatchCount}, Failed=${failedCount}`)

    return NextResponse.json({
      success: true,
      data: finalResults,
      stats: {
        total: ocr_results.length,
        localMatch: localMatchCount,
        dbMatch: dbMatchCount,
        aiMatch: aiMatchCount,
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

// AI를 통한 배치 매핑 제안 함수 (여러 항목을 한 번에 처리)
async function getAiMappingSuggestionBatch(
  ocrItems: OcrResult[],
  standardItems: StandardItem[]
): Promise<(AiMappingSuggestion | null)[]> {

  if (ocrItems.length === 0) {
    return []
  }

  // 표준 항목 목록을 간결하게 포맷 (이름 기반 매칭)
  const standardItemsList = standardItems
    .map(item =>
      `${item.name} | ${item.display_name_ko || '-'} | ${item.default_unit || '-'}`
    )
    .join('\n')

  // OCR 항목들을 번호 매겨서 포맷
  const ocrItemsList = ocrItems
    .map((item, idx) => {
      const refInfo = item.ref_min !== null || item.ref_max !== null
        ? ` | 참고치: ${item.ref_min ?? '?'} ~ ${item.ref_max ?? '?'}`
        : ''
      return `${idx + 1}. "${item.raw_name || item.name}" | 값: ${item.value} | 단위: ${item.unit || '-'}${refInfo}`
    })
    .join('\n')

  const prompt = `수의학 혈액검사 항목 매칭 전문가로서, OCR 추출된 여러 항목을 표준 항목과 매칭하세요.

## 표준 항목 목록 (영문명 | 한글명 | 단위)
${standardItemsList}

## OCR 추출 항목 (번호. 항목명 | 값 | 단위 | 참고치)
${ocrItemsList}

## 매칭 규칙
1. 항목명의 약어, 오타, 띄어쓰기 차이 고려 (예: ALT(GPT) = ALT, Creatine = Creatinine)
2. 단위와 결과값 범위로 검증
3. 매칭할 수 없으면 null 반환

## 응답 (JSON 배열만, 다른 텍스트 없이)
[
  {"idx": 1, "matched_name": "정확한 표준 항목 영문명", "confidence": 85, "reasoning": "근거"},
  {"idx": 2, "matched_name": null, "confidence": 0, "reasoning": "매칭 실패 이유"},
  ...
]`

  const message = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000, // 여러 항목이므로 토큰 늘림
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

    const results: { idx: number; matched_name: string | null; confidence: number; reasoning: string }[] = JSON.parse(jsonMatch[0])

    // 결과를 원래 순서대로 매핑
    const suggestions: (AiMappingSuggestion | null)[] = new Array(ocrItems.length).fill(null)

    for (const result of results) {
      const itemIndex = result.idx - 1 // 1-based to 0-based
      if (itemIndex < 0 || itemIndex >= ocrItems.length) {
        console.warn(`⚠️ Invalid index in AI response: ${result.idx}`)
        continue
      }

      // 매칭 실패 케이스
      if (!result.matched_name || result.confidence === 0) {
        console.log(`🔴 AI could not match: "${ocrItems[itemIndex].raw_name || ocrItems[itemIndex].name}" - ${result.reasoning}`)
        suggestions[itemIndex] = null
        continue
      }

      // 이름으로 표준 항목 찾기 (대소문자 무시)
      const matchedItem = standardItems.find(
        si => si.name.toUpperCase() === result.matched_name!.toUpperCase()
      )

      if (!matchedItem) {
        // 유사도 기반 fallback 매칭
        const fuzzyMatch = standardItems.find(si =>
          si.name.toUpperCase().includes(result.matched_name!.toUpperCase()) ||
          result.matched_name!.toUpperCase().includes(si.name.toUpperCase())
        )

        if (fuzzyMatch) {
          console.log(`🟡 Fuzzy matched: "${result.matched_name}" → ${fuzzyMatch.name}`)
          suggestions[itemIndex] = {
            standard_item_id: fuzzyMatch.id,
            standard_item_name: fuzzyMatch.name,
            display_name_ko: fuzzyMatch.display_name_ko || '',
            confidence: Math.min(result.confidence - 10, 85),
            reasoning: result.reasoning || 'AI 자동 매칭 (유사 이름)'
          }
          continue
        }

        console.warn(`⚠️ AI returned unknown item name: "${result.matched_name}"`)
        suggestions[itemIndex] = null
        continue
      }

      suggestions[itemIndex] = {
        standard_item_id: matchedItem.id,
        standard_item_name: matchedItem.name,
        display_name_ko: matchedItem.display_name_ko || '',
        confidence: Math.min(100, Math.max(0, result.confidence)),
        reasoning: result.reasoning || 'AI 자동 매칭'
      }
    }

    return suggestions
  } catch (parseError) {
    console.error('❌ Failed to parse AI mapping response:', parseError)
    console.error('📄 Raw AI response:', content)
    throw new Error('Failed to parse AI mapping result')
  }
}
