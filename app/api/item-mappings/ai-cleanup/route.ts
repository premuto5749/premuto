import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import type { StandardItem } from '@/types'

export const dynamic = 'force-dynamic'

// 최대 실행 시간 설정 (60초)
export const maxDuration = 60

// 한 번에 처리할 최대 항목 수
const MAX_ITEMS_PER_BATCH = 10

function getAnthropicClient() {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })
}

interface CleanupResult {
  unmapped_item: StandardItem
  matched_to: StandardItem | null
  confidence: number
  reasoning: string
  success: boolean
}

export async function POST() {
  try {
    const supabase = await createClient()

    // 1. Get all unmapped standard items
    const { data: unmappedItems, error: unmappedError } = await supabase
      .from('standard_items_master')
      .select('*')
      .eq('category', 'Unmapped')

    if (unmappedError) {
      console.error('Failed to fetch unmapped items:', unmappedError)
      return NextResponse.json(
        { error: 'Failed to fetch unmapped items' },
        { status: 500 }
      )
    }

    if (!unmappedItems || unmappedItems.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          mapped_count: 0,
          failed_count: 0,
          results: []
        },
        message: 'No unmapped items to process'
      })
    }

    // 2. Get all mapped standard items (for matching targets)
    const { data: mappedItems, error: mappedError } = await supabase
      .from('standard_items_master')
      .select('*')
      .neq('category', 'Unmapped')

    if (mappedError) {
      console.error('Failed to fetch mapped items:', mappedError)
      return NextResponse.json(
        { error: 'Failed to fetch standard items' },
        { status: 500 }
      )
    }

    // 한 번에 처리할 항목 수 제한
    const itemsToProcess = unmappedItems.slice(0, MAX_ITEMS_PER_BATCH)
    const remainingCount = unmappedItems.length - itemsToProcess.length

    console.log(`🤖 AI Cleanup started: ${itemsToProcess.length}/${unmappedItems.length} unmapped items, ${mappedItems?.length || 0} target items`)

    const results: CleanupResult[] = []
    let mappedCount = 0
    let failedCount = 0

    // 3. Process each unmapped item (batch limited)
    for (const unmappedItem of itemsToProcess) {
      try {
        const suggestion = await getAiMatchSuggestion(unmappedItem, mappedItems || [])

        if (suggestion && suggestion.matched_item && suggestion.confidence >= 70) {
          // Remap to the matched item
          const { error: remapError } = await remapItem(
            supabase,
            unmappedItem.id,
            suggestion.matched_item.id
          )

          if (remapError) {
            console.error(`Failed to remap ${unmappedItem.name}:`, remapError)
            failedCount++
            results.push({
              unmapped_item: unmappedItem,
              matched_to: suggestion.matched_item,
              confidence: suggestion.confidence,
              reasoning: `Remap failed: ${remapError}`,
              success: false
            })
          } else {
            // Delete the unmapped item after successful remap
            await supabase
              .from('standard_items_master')
              .delete()
              .eq('id', unmappedItem.id)

            mappedCount++
            results.push({
              unmapped_item: unmappedItem,
              matched_to: suggestion.matched_item,
              confidence: suggestion.confidence,
              reasoning: suggestion.reasoning,
              success: true
            })
            console.log(`✅ Mapped: ${unmappedItem.name} → ${suggestion.matched_item.name} (${suggestion.confidence}%)`)
          }
        } else {
          failedCount++
          results.push({
            unmapped_item: unmappedItem,
            matched_to: null,
            confidence: suggestion?.confidence || 0,
            reasoning: suggestion?.reasoning || 'No suitable match found',
            success: false
          })
          console.log(`❌ No match for: ${unmappedItem.name}`)
        }
      } catch (error) {
        console.error(`Error processing ${unmappedItem.name}:`, error)
        failedCount++
        results.push({
          unmapped_item: unmappedItem,
          matched_to: null,
          confidence: 0,
          reasoning: error instanceof Error ? error.message : 'Processing error',
          success: false
        })
      }
    }

    console.log(`✅ AI Cleanup completed: ${mappedCount} mapped, ${failedCount} failed, ${remainingCount} remaining`)

    return NextResponse.json({
      success: true,
      data: {
        mapped_count: mappedCount,
        failed_count: failedCount,
        remaining_count: remainingCount,
        results
      }
    })

  } catch (error) {
    console.error('AI Cleanup API error:', error)

    // AI 사용량 제한 에러 처리
    if (error instanceof Anthropic.RateLimitError ||
        (error instanceof Error && (
          error.message.includes('rate_limit') ||
          error.message.includes('quota') ||
          error.message.includes('429') ||
          error.message === 'AI_RATE_LIMIT'
        ))) {
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

async function remapItem(
  supabase: Awaited<ReturnType<typeof createClient>>,
  oldId: string,
  newId: string
): Promise<{ error: string | null }> {
  // Update item_mappings
  const { error: mappingsError } = await supabase
    .from('item_mappings_master')
    .update({ standard_item_id: newId })
    .eq('standard_item_id', oldId)

  if (mappingsError) {
    return { error: `Failed to update mappings: ${mappingsError.message}` }
  }

  // Update test_results
  const { error: resultsError } = await supabase
    .from('test_results')
    .update({ standard_item_id: newId })
    .eq('standard_item_id', oldId)

  if (resultsError) {
    return { error: `Failed to update results: ${resultsError.message}` }
  }

  return { error: null }
}

async function getAiMatchSuggestion(
  unmappedItem: StandardItem,
  targetItems: StandardItem[]
): Promise<{ matched_item: StandardItem | null; confidence: number; reasoning: string } | null> {

  if (targetItems.length === 0) {
    return { matched_item: null, confidence: 0, reasoning: 'No target items available' }
  }

  const targetList = targetItems
    .map(item =>
      `- ID: ${item.id} | Name: ${item.name} | 한글명: ${item.display_name_ko || 'N/A'} | 단위: ${item.default_unit || 'N/A'} | 카테고리: ${item.category || 'N/A'}`
    )
    .join('\n')

  const prompt = `당신은 수의학 혈액검사 항목 매칭 전문가입니다.

[정리 필요한 항목]
- 항목명: "${unmappedItem.name}"
- 한글명: ${unmappedItem.display_name_ko || 'N/A'}
- 단위: ${unmappedItem.default_unit || 'N/A'}

[매칭 가능한 표준 항목 목록]
${targetList}

[질문]
위의 "정리 필요한 항목"이 표준 항목 목록 중 어떤 항목과 같은 의미인지 찾아주세요.
약어, 오타, 띄어쓰기 차이, 언어 차이(영문/한글)를 고려하여 유연하게 매칭해주세요.

응답 형식 (JSON만 반환):
{
  "matched_id": "매칭된 표준 항목의 ID (정확히 위 목록의 ID 사용, 매칭 없으면 null)",
  "confidence": 85,
  "reasoning": "매칭 근거를 한 문장으로 설명"
}

중요:
- confidence는 0~100 사이의 숫자
- 70% 이상의 확신이 있을 때만 매칭
- 확실하지 않으면 confidence를 낮게 설정
- JSON만 반환`

  try {
    const message = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })

    const textContent = message.content.find(block => block.type === 'text')
    const content = textContent?.type === 'text' ? textContent.text : null
    if (!content) {
      return { matched_item: null, confidence: 0, reasoning: 'No AI response' }
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { matched_item: null, confidence: 0, reasoning: 'Invalid AI response format' }
    }

    const result = JSON.parse(jsonMatch[0])

    if (!result.matched_id) {
      return { matched_item: null, confidence: result.confidence || 0, reasoning: result.reasoning || 'No match found' }
    }

    const matchedItem = targetItems.find(item => item.id === result.matched_id)
    if (!matchedItem) {
      return { matched_item: null, confidence: 0, reasoning: 'AI suggested invalid item ID' }
    }

    return {
      matched_item: matchedItem,
      confidence: Math.min(100, Math.max(0, result.confidence)),
      reasoning: result.reasoning || 'AI automatic matching'
    }
  } catch (error) {
    console.error('AI matching error:', error)

    // AI 사용량 제한 에러는 상위로 전파
    if (error instanceof Anthropic.RateLimitError ||
        (error instanceof Error && (
          error.message.includes('rate_limit') ||
          error.message.includes('quota') ||
          error.message.includes('429')
        ))) {
      throw new Error('AI_RATE_LIMIT')
    }

    return { matched_item: null, confidence: 0, reasoning: `AI error: ${error instanceof Error ? error.message : 'Unknown'}` }
  }
}
