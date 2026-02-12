import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/auth/admin'
import defaultConfig from '@/config/unit_mappings.json'

export const dynamic = 'force-dynamic'

const SETTINGS_KEY = 'unit_config'

/**
 * GET /api/admin/unit-config
 * 단위 설정 조회 (별칭 + OCR 보정 규칙)
 * DB에 저장된 오버라이드가 있으면 사용, 없으면 JSON 파일 기본값
 */
export async function GET() {
  try {
    const { authorized, error } = await requireAdmin()
    if (!authorized) {
      return NextResponse.json({ error }, { status: 403 })
    }

    const supabase = await createClient()
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .single()

    // DB에 저장된 값이 있으면 사용, 없으면 JSON 파일 기본값
    const unitAliases = data?.value?.unit_aliases || defaultConfig.unit_aliases
    const ocrCorrections = data?.value?.ocr_corrections || defaultConfig.ocr_corrections

    return NextResponse.json({
      success: true,
      data: {
        unit_aliases: unitAliases,
        ocr_corrections: ocrCorrections,
      }
    })
  } catch (error) {
    console.error('Unit config GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/unit-config
 * 단위 설정 업데이트 (별칭 + OCR 보정 규칙)
 * app_settings 테이블에 저장 (Vercel 읽기 전용 파일 시스템 호환)
 */
export async function PUT(request: NextRequest) {
  try {
    const { authorized, error } = await requireAdmin()
    if (!authorized) {
      return NextResponse.json({ error }, { status: 403 })
    }

    const body = await request.json()
    const { unit_aliases, ocr_corrections } = body

    if (!unit_aliases && !ocr_corrections) {
      return NextResponse.json(
        { error: 'unit_aliases or ocr_corrections is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const serviceSupabase = createServiceClient()

    // 기존 설정 조회
    const { data: existing } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .single()

    const currentValue = existing?.value || {
      unit_aliases: defaultConfig.unit_aliases,
      ocr_corrections: defaultConfig.ocr_corrections,
    }

    // 요청된 섹션만 업데이트
    if (unit_aliases) {
      currentValue.unit_aliases = unit_aliases
    }
    if (ocr_corrections) {
      currentValue.ocr_corrections = ocr_corrections
    }
    currentValue.last_updated = new Date().toISOString().split('T')[0]

    // DB에 저장
    const { error: upsertError } = await serviceSupabase
      .from('app_settings')
      .upsert({
        key: SETTINGS_KEY,
        value: currentValue,
        description: '단위 별칭 및 OCR 보정 규칙 설정'
      }, { onConflict: 'key' })

    if (upsertError) {
      console.error('Failed to save unit config:', upsertError)
      return NextResponse.json(
        { error: 'Failed to save unit config' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Unit config updated successfully'
    })
  } catch (error) {
    console.error('Unit config PUT error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
