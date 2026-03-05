import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { withAuth } from '@/lib/auth/with-auth'
import { checkUsageLimit, logUsage } from '@/lib/tier'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function getAnthropicClient() {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })
}

/** JSON 문자열을 정리하고 복구하는 함수 */
function cleanAndParseJson(content: string): Record<string, unknown> | null {
  let cleaned = content
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim()

  const jsonStart = cleaned.indexOf('{')
  const jsonEnd = cleaned.lastIndexOf('}')

  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
    return null
  }

  cleaned = cleaned.substring(jsonStart, jsonEnd + 1)

  // 트레일링 콤마 제거
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1')

  try {
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}

/** OCR 결과 타입 */
export interface PetFoodOcrResult {
  brand: string | null
  name: string | null
  food_category: string | null
  target_animal: string | null
  ingredients_text: string | null
  calorie_density: number | null
  nutrients: Array<{
    nutrient_name: string
    value: number
    unit_symbol: string
  }>
}

const SYSTEM_PROMPT = `당신은 반려동물 사료/간식 포장지를 분석하는 전문가입니다.
사진에서 다음 정보를 추출하여 JSON으로 반환하세요.`

const USER_PROMPT = `이 사진은 반려동물 사료 또는 간식 포장지입니다. 다음 정보를 JSON으로 추출하세요:

{
  "brand": "브랜드명 (없으면 null)",
  "name": "제품명 (없으면 null)",
  "food_category": "건사료|습식|생식|간식|보충제/영양제 중 하나 (판단 불가시 null)",
  "target_animal": "강아지|고양이|공통 중 하나 (판단 불가시 null)",
  "ingredients_text": "원재료 전체 텍스트 (있는 그대로, 없으면 null)",
  "calorie_density": "kcal/g 단위 숫자 (kcal/kg이면 1000으로 나누기, 없으면 null)",
  "nutrients": [
    { "nutrient_name": "성분명(한국어 우선)", "value": 숫자, "unit_symbol": "단위" }
  ]
}

규칙:
- nutrients의 unit_symbol은 %, mg/kg, IU/kg, mg, ug, kcal/kg, g/kg, ppm 중 하나
- 성분 보증 분석표(Guaranteed Analysis)의 항목을 우선 추출
- 사진에서 읽을 수 없는 항목은 포함하지 마세요
- 여러 사진이면 모든 사진의 정보를 종합하세요`

export const POST = withAuth(async (req, { user }) => {
  try {
    // Parse JSON body
    const body = await req.json()
    const files = body.files as Array<{ data: string; type: string; name: string }> | undefined

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: '파일이 필요합니다' },
        { status: 400 }
      )
    }

    if (files.length > 5) {
      return NextResponse.json(
        { error: '최대 5개 파일까지 업로드 가능합니다' },
        { status: 400 }
      )
    }

    // Tier usage check (reuse existing 'ocr' action mapped to ocr_analysis)
    const usageCheck = await checkUsageLimit(user.id, 'ocr_analysis')
    if (!usageCheck.allowed) {
      return NextResponse.json(
        {
          error: 'TIER_LIMIT_EXCEEDED',
          message: `오늘 AI 분석 ${usageCheck.limit}회를 모두 사용했습니다. 내일 다시 이용할 수 있습니다.`,
          usage: { used: usageCheck.used, limit: usageCheck.limit },
        },
        { status: 429 }
      )
    }

    // Build image content blocks for Claude API
    const imageBlocks: Anthropic.Messages.ContentBlockParam[] = files.map((file) => {
      // Normalize MIME type
      let mimeType = file.type
      if (mimeType === 'image/jpg') {
        mimeType = 'image/jpeg'
      }

      return {
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: file.data,
        },
      }
    })

    // Call Claude API with all images
    const message = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            ...imageBlocks,
            {
              type: 'text',
              text: USER_PROMPT,
            },
          ],
        },
      ],
    })

    // Extract text from response
    const textContent = message.content.find(block => block.type === 'text')
    const content = textContent?.type === 'text' ? textContent.text : null

    if (!content) {
      return NextResponse.json(
        { error: 'OCR 서비스로부터 응답이 없습니다' },
        { status: 500 }
      )
    }

    // Parse JSON response
    const parsed = cleanAndParseJson(content)

    if (!parsed) {
      console.error('[pet-foods/ocr] JSON parse failed. Raw:', content.substring(0, 500))
      return NextResponse.json(
        { error: 'OCR 결과 파싱에 실패했습니다' },
        { status: 500 }
      )
    }

    // Construct typed result
    const result: PetFoodOcrResult = {
      brand: (parsed.brand as string) || null,
      name: (parsed.name as string) || null,
      food_category: (parsed.food_category as string) || null,
      target_animal: (parsed.target_animal as string) || null,
      ingredients_text: (parsed.ingredients_text as string) || null,
      calorie_density: typeof parsed.calorie_density === 'number' ? parsed.calorie_density : null,
      nutrients: Array.isArray(parsed.nutrients)
        ? (parsed.nutrients as Array<{ nutrient_name: string; value: number; unit_symbol: string }>)
        : [],
    }

    // Log usage after success
    await logUsage(user.id, 'ocr_analysis', 1, {
      type: 'pet_food_ocr',
      file_count: files.length,
      nutrient_count: result.nutrients.length,
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('[pet-foods/ocr] Error:', error)

    // AI rate limit error handling
    if (
      error instanceof Anthropic.RateLimitError ||
      (error instanceof Error && (
        error.message.includes('rate_limit') ||
        error.message.includes('quota') ||
        error.message.includes('429')
      ))
    ) {
      return NextResponse.json(
        {
          error: 'AI_RATE_LIMIT',
          message: 'AI 사용량 제한에 도달하였습니다. 잠시 후 다시 시도해주세요.',
        },
        { status: 429 }
      )
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
