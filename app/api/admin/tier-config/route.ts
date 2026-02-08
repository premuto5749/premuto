import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkCurrentUserIsAdmin } from '@/lib/auth/admin'
import type { TierConfigMap } from '@/lib/tier'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const adminCheck = await checkCurrentUserIsAdmin()
    if (!adminCheck.isAdmin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'tier_config')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Tier 설정을 찾을 수 없습니다' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: data.value as TierConfigMap,
    })
  } catch (error) {
    console.error('Get tier config error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const adminCheck = await checkCurrentUserIsAdmin()
    if (!adminCheck.isAdmin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
    }

    const body = await request.json()
    const tierConfig = body as TierConfigMap

    // 기본 검증
    const requiredTiers = ['free', 'basic', 'premium']
    for (const tier of requiredTiers) {
      if (!tierConfig[tier as keyof TierConfigMap]) {
        return NextResponse.json(
          { error: `'${tier}' tier 설정이 필요합니다` },
          { status: 400 }
        )
      }
      const config = tierConfig[tier as keyof TierConfigMap]
      if (typeof config.daily_ocr_limit !== 'number' ||
          typeof config.max_files_per_ocr !== 'number' ||
          typeof config.daily_log_max_photos !== 'number' ||
          typeof config.daily_log_max_photo_size_mb !== 'number' ||
          (config.daily_excel_export_limit !== undefined && typeof config.daily_excel_export_limit !== 'number') ||
          (config.weekly_photo_export_limit !== undefined && typeof config.weekly_photo_export_limit !== 'number') ||
          (config.daily_description_gen_limit !== undefined && typeof config.daily_description_gen_limit !== 'number')) {
        return NextResponse.json(
          { error: `'${tier}' tier에 필수 숫자 필드가 누락되었습니다` },
          { status: 400 }
        )
      }
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from('app_settings')
      .update({ value: tierConfig })
      .eq('key', 'tier_config')

    if (error) {
      console.error('Update tier config error:', error)
      return NextResponse.json({ error: '설정 저장에 실패했습니다' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Put tier config error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
