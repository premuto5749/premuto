import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserTier, getTierConfig, getTodayUsage } from '@/lib/tier'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const [tier, tierConfigMap, ocrUsed, photoUsed, descGenUsed] = await Promise.all([
      getUserTier(user.id),
      getTierConfig(),
      getTodayUsage(user.id, 'ocr_analysis'),
      getTodayUsage(user.id, 'daily_log_photo'),
      getTodayUsage(user.id, 'description_generation'),
    ])

    const config = tierConfigMap[tier] || tierConfigMap.free

    return NextResponse.json({
      success: true,
      data: {
        tier,
        config,
        allTierConfigs: tierConfigMap,
        usage: {
          ocr_analysis: {
            used: ocrUsed,
            limit: config.daily_ocr_limit,
            remaining: config.daily_ocr_limit === -1 ? -1 : Math.max(0, config.daily_ocr_limit - ocrUsed),
          },
          daily_log_photo: {
            used: photoUsed,
            limit: config.daily_log_max_photos,
            remaining: config.daily_log_max_photos === -1 ? -1 : Math.max(0, config.daily_log_max_photos - photoUsed),
          },
          description_generation: {
            used: descGenUsed,
            limit: config.daily_description_gen_limit,
            remaining: config.daily_description_gen_limit === -1 ? -1 : Math.max(0, config.daily_description_gen_limit - descGenUsed),
          },
        },
      },
    })
  } catch (error) {
    console.error('Tier API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
