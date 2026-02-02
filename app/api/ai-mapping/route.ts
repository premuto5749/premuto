import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import type { OcrResult, StandardItem, AiMappingSuggestion } from '@/types'
import { matchItem } from '@/lib/ocr/item-matcher'

// 최대 실행 시간 설정 (60초)
export const maxDuration = 60

// Anthropic 클라이언트는 런타임에 생성 (빌드 타임에 환경변수 없음)
function getAnthropicClient() {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })
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

    // 3. 각 OCR 결과에 대해 매핑 수행
    const mappingResults = await Promise.all(
      ocr_results.map(async (ocrItem) => {
        const itemName = ocrItem.raw_name || ocrItem.name

        // 3-1. 로컬 매핑 우선 시도 (JSON 설정 기반)
        const localMatch = matchItem(itemName)

        if (localMatch.confidence >= 70 && localMatch.standardItemName) {
          // 로컬 매칭 성공 - DB에서 유연하게 표준 항목 찾기
          const standardItem = findStandardItemFlexible(localMatch.standardItemName)

          if (standardItem) {
            localMatchCount++
            console.log(`📍 Local match: "${itemName}" → ${standardItem.name} (${localMatch.confidence}%, ${localMatch.method})`)

            return {
              ocr_item: ocrItem,
              suggested_mapping: {
                standard_item_id: standardItem.id,
                standard_item_name: standardItem.name,
                display_name_ko: standardItem.display_name_ko || localMatch.displayNameKo || '',
                confidence: localMatch.confidence,
                reasoning: `로컬 매칭 (${localMatch.method}): ${localMatch.matchedAgainst || itemName}`
              } as AiMappingSuggestion
            }
          }

          // DB에 없는 경우 - 한글명으로도 시도
          const standardItemByKo = localMatch.displayNameKo
            ? findStandardItemFlexible(localMatch.displayNameKo)
            : null

          if (standardItemByKo) {
            localMatchCount++
            console.log(`📍 Local match (한글명): "${itemName}" → ${standardItemByKo.name}`)

            return {
              ocr_item: ocrItem,
              suggested_mapping: {
                standard_item_id: standardItemByKo.id,
                standard_item_name: standardItemByKo.name,
                display_name_ko: standardItemByKo.display_name_ko || localMatch.displayNameKo || '',
                confidence: localMatch.confidence - 5, // 한글명 매칭은 신뢰도 약간 낮춤
                reasoning: `로컬 매칭 (한글명): ${localMatch.displayNameKo}`
              } as AiMappingSuggestion
            }
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
            return {
              ocr_item: ocrItem,
              suggested_mapping: {
                standard_item_id: standardItem.id,
                standard_item_name: standardItem.name,
                display_name_ko: standardItem.display_name_ko || '',
                confidence: 100, // 기존 매핑은 100% 신뢰도
                reasoning: `기존 매핑 사전에서 발견됨 (출처: ${existingMapping.mapping_source || 'manual'})`
              } as AiMappingSuggestion
            }
          }
        }

        // 3-3. 로컬/DB 매핑 모두 실패 시 AI에게 요청
        console.log(`🔍 No match for "${itemName}", requesting AI suggestion...`)

        try {
          const aiSuggestion = await getAiMappingSuggestion(
            ocrItem,
            standardItems || []
          )

          if (aiSuggestion) {
            aiMatchCount++
          } else {
            failedCount++
          }

          return {
            ocr_item: ocrItem,
            suggested_mapping: aiSuggestion
          }
        } catch (aiError) {
          console.error(`❌ AI mapping failed for "${itemName}":`, aiError)

          // AI 사용량 제한 에러 감지
          if (aiError instanceof Anthropic.RateLimitError ||
              (aiError instanceof Error && (
                aiError.message.includes('rate_limit') ||
                aiError.message.includes('quota') ||
                aiError.message.includes('429')
              ))) {
            throw new Error('AI_RATE_LIMIT')
          }

          failedCount++
          return {
            ocr_item: ocrItem,
            suggested_mapping: null
          }
        }
      })
    )

    console.log(`✅ AI Mapping completed for batch ${batch_id}`)
    console.log(`📊 Stats: Local=${localMatchCount}, DB=${dbMatchCount}, AI=${aiMatchCount}, Failed=${failedCount}`)

    return NextResponse.json({
      success: true,
      data: mappingResults,
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

// AI를 통한 매핑 제안 함수
async function getAiMappingSuggestion(
  ocrItem: OcrResult,
  standardItems: StandardItem[]
): Promise<AiMappingSuggestion | null> {

  // 표준 항목 목록을 간결하게 포맷 (이름 기반 매칭)
  const standardItemsList = standardItems
    .map(item =>
      `• ${item.name} | ${item.display_name_ko || '-'} | ${item.default_unit || '-'}`
    )
    .join('\n')

  const prompt = `수의학 혈액검사 항목 매칭 전문가로서, OCR 추출 항목을 표준 항목과 매칭하세요.

## 표준 항목 목록 (이름 | 한글명 | 단위)
${standardItemsList}

## OCR 추출 항목
- 항목명: "${ocrItem.raw_name || ocrItem.name}"
- 결과값: ${ocrItem.value}
- 단위: ${ocrItem.unit || '없음'}
${ocrItem.ref_min !== null || ocrItem.ref_max !== null ? `- 참고치: ${ocrItem.ref_min ?? '?'} ~ ${ocrItem.ref_max ?? '?'}` : ''}

## 매칭 규칙
1. 항목명의 약어, 오타, 띄어쓰기 차이 고려 (예: ALT(GPT) = ALT, Creatine = Creatinine)
2. 단위와 결과값 범위로 검증
3. 매칭할 수 없으면 null 반환

## 응답 (JSON만)
{"matched_name": "정확한 표준 항목 영문명", "confidence": 0-100, "reasoning": "근거"}
또는
{"matched_name": null, "confidence": 0, "reasoning": "실패 이유"}`

  const message = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
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

  // JSON 파싱
  try {
    const jsonMatch = content.match(/\{[\s\S]*?\}/)
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0])

      // 매칭 실패 케이스
      if (!result.matched_name || result.confidence === 0) {
        console.log(`🔴 AI could not match: "${ocrItem.raw_name || ocrItem.name}" - ${result.reasoning}`)
        return null
      }

      // 이름으로 표준 항목 찾기 (대소문자 무시)
      const matchedItem = standardItems.find(
        si => si.name.toUpperCase() === result.matched_name.toUpperCase()
      )

      if (!matchedItem) {
        // 유사도 기반 fallback 매칭
        const fuzzyMatch = standardItems.find(si =>
          si.name.toUpperCase().includes(result.matched_name.toUpperCase()) ||
          result.matched_name.toUpperCase().includes(si.name.toUpperCase())
        )

        if (fuzzyMatch) {
          console.log(`🟡 Fuzzy matched: "${result.matched_name}" → ${fuzzyMatch.name}`)
          return {
            standard_item_id: fuzzyMatch.id,
            standard_item_name: fuzzyMatch.name,
            display_name_ko: fuzzyMatch.display_name_ko || '',
            confidence: Math.min(result.confidence - 10, 85), // 신뢰도 약간 낮춤
            reasoning: result.reasoning || 'AI 자동 매칭 (유사 이름)'
          }
        }

        console.warn(`⚠️ AI returned unknown item name: "${result.matched_name}"`)
        return null
      }

      return {
        standard_item_id: matchedItem.id,
        standard_item_name: matchedItem.name,
        display_name_ko: matchedItem.display_name_ko || '',
        confidence: Math.min(100, Math.max(0, result.confidence)),
        reasoning: result.reasoning || 'AI 자동 매칭'
      }
    } else {
      throw new Error('No JSON found in AI response')
    }
  } catch (parseError) {
    console.error('❌ Failed to parse AI mapping response:', parseError)
    console.error('📄 Raw AI response:', content)
    throw new Error('Failed to parse AI mapping result')
  }
}
