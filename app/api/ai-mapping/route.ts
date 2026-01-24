import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import type { OcrResult, StandardItem, AiMappingSuggestion } from '@/types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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
      existingMappings?.map(m => [m.raw_name, m]) || []
    )

    console.log(`📊 Loaded ${standardItems?.length || 0} standard items and ${existingMappings?.length || 0} existing mappings`)

    // 3. 각 OCR 결과에 대해 매핑 수행
    const mappingResults = await Promise.all(
      ocr_results.map(async (ocrItem) => {
        // 3-1. 기존 매핑 사전에서 먼저 조회
        const existingMapping = mappingsMap.get(ocrItem.name)

        if (existingMapping) {
          // 기존 매핑이 있으면 해당 표준 항목 정보 반환
          const standardItem = standardItems?.find(
            si => si.id === existingMapping.standard_item_id
          )

          if (standardItem) {
            console.log(`✅ Found existing mapping: ${ocrItem.name} → ${standardItem.name}`)
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

        // 3-2. 기존 매핑이 없으면 AI에게 요청
        console.log(`🔍 No existing mapping for "${ocrItem.name}", requesting AI suggestion...`)

        try {
          const aiSuggestion = await getAiMappingSuggestion(
            ocrItem,
            standardItems || []
          )

          return {
            ocr_item: ocrItem,
            suggested_mapping: aiSuggestion
          }
        } catch (aiError) {
          console.error(`❌ AI mapping failed for "${ocrItem.name}":`, aiError)
          return {
            ocr_item: ocrItem,
            suggested_mapping: null
          }
        }
      })
    )

    console.log(`✅ AI Mapping completed for batch ${batch_id}`)

    return NextResponse.json({
      success: true,
      data: mappingResults
    })

  } catch (error) {
    console.error('AI Mapping API error:', error)
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

  // 표준 항목 목록을 GPT에게 전달할 형태로 포맷
  const standardItemsList = standardItems
    .map(item =>
      `- ${item.name} (${item.display_name_ko || '한글명 없음'}) / 단위: ${item.default_unit || 'N/A'} / 카테고리: ${item.category || 'N/A'}`
    )
    .join('\n')

  const prompt = `당신은 수의학 혈액검사 항목 매칭 전문가입니다.

[데이터베이스의 표준 항목 목록]
${standardItemsList}

[OCR로 추출된 검사 항목]
- 항목명: "${ocrItem.name}"
- 결과값: ${ocrItem.value}
- 단위: ${ocrItem.unit}
${ocrItem.ref_min !== null || ocrItem.ref_max !== null ? `- 참고치: ${ocrItem.ref_min || '?'} ~ ${ocrItem.ref_max || '?'}` : ''}

[질문]
이 OCR 결과가 위의 표준 항목 목록 중 어떤 항목과 가장 일치하나요?

응답 형식 (JSON만 반환):
{
  "standard_item_id": "매칭된 표준 항목의 ID (정확히 위 목록의 ID 사용)",
  "standard_item_name": "매칭된 표준 항목의 영문명",
  "display_name_ko": "매칭된 표준 항목의 한글명",
  "confidence": 95,
  "reasoning": "매칭 근거를 한 문장으로 설명"
}

매칭할 항목이 없다면:
{
  "standard_item_id": null,
  "standard_item_name": null,
  "display_name_ko": null,
  "confidence": 0,
  "reasoning": "매칭 실패 이유"
}

중요:
- confidence는 0~100 사이의 숫자
- 항목명의 약어, 오타, 띄어쓰기 차이를 고려하여 유연하게 매칭
- 단위와 참고치 범위도 함께 고려
- JSON만 반환하고 다른 설명 추가 금지`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 500,
    temperature: 0.1,
  })

  const content = completion.choices[0]?.message?.content

  if (!content) {
    throw new Error('No response from AI mapping service')
  }

  // JSON 파싱
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0])

      // 매칭 실패 케이스
      if (!result.standard_item_id || result.confidence === 0) {
        return null
      }

      // 표준 항목 ID가 실제로 존재하는지 검증
      const matchedItem = standardItems.find(si => si.id === result.standard_item_id)
      if (!matchedItem) {
        console.warn(`⚠️ AI suggested non-existent item ID: ${result.standard_item_id}`)
        return null
      }

      // AI가 반환한 정보와 실제 DB 정보가 일치하는지 검증
      return {
        standard_item_id: matchedItem.id,
        standard_item_name: matchedItem.name,
        display_name_ko: matchedItem.display_name_ko || '',
        confidence: Math.min(100, Math.max(0, result.confidence)), // 0-100 범위 보장
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
