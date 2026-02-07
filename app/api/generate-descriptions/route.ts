import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { checkUsageLimit, logUsage } from '@/lib/tier'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_ITEMS_PER_REQUEST = 10

function getAnthropicClient() {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })
}

interface ItemForGeneration {
  id: string
  name: string
  display_name_ko: string | null
  exam_type: string | null
  organ_tags: string[] | null
}

interface GeneratedDescription {
  name: string
  description_common: string
  description_high: string
  description_low: string
}

/**
 * POST /api/generate-descriptions
 * AI를 사용하여 검사항목 설명을 일괄 생성
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: '인증이 필요합니다' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { item_ids } = body as { item_ids: string[] }

    if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'item_ids가 필요합니다' },
        { status: 400 }
      )
    }

    if (item_ids.length > MAX_ITEMS_PER_REQUEST) {
      return NextResponse.json(
        { error: 'Bad Request', message: `한 번에 최대 ${MAX_ITEMS_PER_REQUEST}개까지 처리할 수 있습니다` },
        { status: 400 }
      )
    }

    // 티어 체크
    const usageCheck = await checkUsageLimit(user.id, 'description_generation')
    if (!usageCheck.allowed) {
      return NextResponse.json(
        {
          error: 'TIER_LIMIT',
          message: usageCheck.limit === 0
            ? 'Basic 요금제부터 이용 가능합니다'
            : '오늘의 AI 설명 생성 한도에 도달했습니다',
          tier: usageCheck.tier,
          used: usageCheck.used,
          limit: usageCheck.limit,
        },
        { status: 403 }
      )
    }

    // 요청된 항목 정보 조회 (RPC로 사용자 뷰 가져오기)
    const { data: userItems, error: rpcError } = await supabase
      .rpc('get_user_standard_items', { p_user_id: user.id })

    if (rpcError) {
      console.error('[GenerateDesc] RPC error:', rpcError)
      return NextResponse.json(
        { error: 'Internal server error', message: '항목 조회에 실패했습니다' },
        { status: 500 }
      )
    }

    // 요청된 ID에 해당하는 항목만 필터
    const targetItems: ItemForGeneration[] = (userItems || [])
      .filter((item: Record<string, unknown>) => item_ids.includes(item.id as string))
      .map((item: Record<string, unknown>) => ({
        id: item.id as string,
        name: item.name as string,
        display_name_ko: item.display_name_ko as string | null,
        exam_type: item.exam_type as string | null,
        organ_tags: item.organ_tags as string[] | null,
      }))

    if (targetItems.length === 0) {
      return NextResponse.json(
        { error: 'Not Found', message: '처리할 항목이 없습니다' },
        { status: 404 }
      )
    }

    // Claude API 호출
    const anthropic = getAnthropicClient()
    const itemsList = targetItems.map(item => {
      const parts = [`- ${item.name}`]
      if (item.display_name_ko) parts.push(`(${item.display_name_ko})`)
      if (item.exam_type) parts.push(`[${item.exam_type}]`)
      if (item.organ_tags?.length) parts.push(`{${item.organ_tags.join(', ')}}`)
      return parts.join(' ')
    }).join('\n')

    const prompt = `당신은 수의학 전문가입니다. 반려동물(주로 개, 고양이) 보호자가 이해할 수 있도록 혈액검사 항목 설명을 작성해주세요.

다음 검사항목들에 대해 각각:
- description_common: 이 검사가 무엇을 측정하는지 (1-2문장, 한국어, 쉬운 표현)
- description_high: 수치가 높을 때 의미/가능한 원인 (키워드 나열, 쉼표 구분)
- description_low: 수치가 낮을 때 의미/가능한 원인 (키워드 나열, 쉼표 구분)

항목 목록:
${itemsList}

반드시 아래 JSON 배열 형식으로만 응답하세요. 다른 텍스트 없이 JSON만 출력하세요:
[
  {
    "name": "항목 영문명",
    "description_common": "...",
    "description_high": "...",
    "description_low": "..."
  }
]`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    // 응답 파싱
    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('AI 응답에서 텍스트를 찾을 수 없습니다')
    }

    let descriptions: GeneratedDescription[]
    try {
      // JSON 블록 추출 (```json ... ``` 또는 순수 JSON)
      let jsonStr = textContent.text.trim()
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim()
      }
      descriptions = JSON.parse(jsonStr)
    } catch {
      console.error('[GenerateDesc] JSON parse error:', textContent.text)
      throw new Error('AI 응답을 파싱할 수 없습니다')
    }

    // 항목별로 user_standard_items에 오버라이드 저장
    const results: { id: string; name: string; success: boolean; error?: string }[] = []
    let generatedCount = 0

    for (const item of targetItems) {
      const desc = descriptions.find(d => d.name === item.name)
      if (!desc) {
        results.push({ id: item.id, name: item.name, success: false, error: 'AI 응답에서 해당 항목을 찾을 수 없음' })
        continue
      }

      try {
        // 마스터 항목인지 확인
        const { data: masterItem } = await supabase
          .from('standard_items_master')
          .select('id')
          .eq('id', item.id)
          .single()

        if (masterItem) {
          // 마스터 항목 → user_standard_items에 오버라이드
          const { data: existingOverride } = await supabase
            .from('user_standard_items')
            .select('id')
            .eq('user_id', user.id)
            .eq('master_item_id', item.id)
            .single()

          if (existingOverride) {
            await supabase
              .from('user_standard_items')
              .update({
                description_common: desc.description_common,
                description_high: desc.description_high,
                description_low: desc.description_low,
              })
              .eq('id', existingOverride.id)
          } else {
            await supabase
              .from('user_standard_items')
              .insert({
                user_id: user.id,
                master_item_id: item.id,
                description_common: desc.description_common,
                description_high: desc.description_high,
                description_low: desc.description_low,
              })
          }
        } else {
          // 사용자 커스텀 항목 → 직접 업데이트
          await supabase
            .from('user_standard_items')
            .update({
              description_common: desc.description_common,
              description_high: desc.description_high,
              description_low: desc.description_low,
            })
            .eq('id', item.id)
            .eq('user_id', user.id)
        }

        results.push({ id: item.id, name: item.name, success: true })
        generatedCount++
      } catch (saveError) {
        console.error(`[GenerateDesc] Save error for ${item.name}:`, saveError)
        results.push({ id: item.id, name: item.name, success: false, error: '저장 실패' })
      }
    }

    // 사용량 기록
    if (generatedCount > 0) {
      await logUsage(user.id, 'description_generation', generatedCount, {
        item_count: generatedCount,
        item_names: results.filter(r => r.success).map(r => r.name),
      })
    }

    return NextResponse.json({
      success: true,
      generated: generatedCount,
      failed: results.filter(r => !r.success).length,
      results,
    })

  } catch (error) {
    console.error('[GenerateDesc] API error:', error)

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
