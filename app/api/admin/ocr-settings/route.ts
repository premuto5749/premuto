import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkCurrentUserIsAdmin } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

export interface OcrSettings {
  maxSizeMB: number
  initialQuality: number
  maxFiles: number
  maxTokens: number
}

export interface OcrSettingsResponse {
  quick_upload: OcrSettings
  batch_upload: OcrSettings
}

// 기본값 (DB 조회 실패 시 폴백)
const DEFAULT_SETTINGS: OcrSettingsResponse = {
  quick_upload: {
    maxSizeMB: 1,
    initialQuality: 0.85,
    maxFiles: 5,
    maxTokens: 8000
  },
  batch_upload: {
    maxSizeMB: 1,
    initialQuality: 0.85,
    maxFiles: 10,
    maxTokens: 8000
  }
}

// GET: 관리자만 설정 조회 가능
export async function GET() {
  try {
    // 관리자 권한 확인
    const { isAdmin } = await checkCurrentUserIsAdmin()
    if (!isAdmin) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다' },
        { status: 403 }
      )
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['ocr_quick_upload', 'ocr_batch_upload'])

    if (error) {
      console.error('Failed to fetch OCR settings:', error)
      // 에러 시 기본값 반환
      return NextResponse.json({
        success: true,
        data: DEFAULT_SETTINGS
      })
    }

    // 데이터가 없으면 기본값
    if (!data || data.length === 0) {
      return NextResponse.json({
        success: true,
        data: DEFAULT_SETTINGS
      })
    }

    // 결과 매핑
    const settings: OcrSettingsResponse = { ...DEFAULT_SETTINGS }
    data.forEach(row => {
      if (row.key === 'ocr_quick_upload') {
        settings.quick_upload = { ...DEFAULT_SETTINGS.quick_upload, ...row.value }
      } else if (row.key === 'ocr_batch_upload') {
        settings.batch_upload = { ...DEFAULT_SETTINGS.batch_upload, ...row.value }
      }
    })

    return NextResponse.json({
      success: true,
      data: settings
    })
  } catch (error) {
    console.error('OCR settings API error:', error)
    return NextResponse.json({
      success: true,
      data: DEFAULT_SETTINGS
    })
  }
}

// PUT: 관리자만 설정 수정 가능
export async function PUT(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const { isAdmin } = await checkCurrentUserIsAdmin()
    if (!isAdmin) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다' },
        { status: 403 }
      )
    }

    const supabase = await createClient()
    const body = await request.json()
    const { quick_upload, batch_upload } = body as OcrSettingsResponse

    // 유효성 검사
    const validateSettings = (settings: OcrSettings, name: string) => {
      if (settings.maxSizeMB < 0.1 || settings.maxSizeMB > 10) {
        throw new Error(`${name}: maxSizeMB는 0.1~10 사이여야 합니다`)
      }
      if (settings.initialQuality < 0.1 || settings.initialQuality > 1) {
        throw new Error(`${name}: initialQuality는 0.1~1 사이여야 합니다`)
      }
      if (settings.maxFiles < 1 || settings.maxFiles > 20) {
        throw new Error(`${name}: maxFiles는 1~20 사이여야 합니다`)
      }
      if (settings.maxTokens < 1000 || settings.maxTokens > 32000) {
        throw new Error(`${name}: maxTokens는 1000~32000 사이여야 합니다`)
      }
    }

    if (quick_upload) validateSettings(quick_upload, '간편 업로드')
    if (batch_upload) validateSettings(batch_upload, '일괄 업로드')

    // 업데이트 실행
    const updates = []

    if (quick_upload) {
      updates.push(
        supabase
          .from('app_settings')
          .upsert({
            key: 'ocr_quick_upload',
            value: quick_upload,
            description: '간편 업로드 OCR 설정'
          }, { onConflict: 'key' })
      )
    }

    if (batch_upload) {
      updates.push(
        supabase
          .from('app_settings')
          .upsert({
            key: 'ocr_batch_upload',
            value: batch_upload,
            description: '일괄 업로드 OCR 설정'
          }, { onConflict: 'key' })
      )
    }

    const results = await Promise.all(updates)
    const errors = results.filter(r => r.error)

    if (errors.length > 0) {
      console.error('Failed to update OCR settings:', errors)
      return NextResponse.json(
        { error: '설정 저장 실패' },
        { status: 500 }
      )
    }

    console.log('✅ OCR settings updated successfully')

    return NextResponse.json({
      success: true,
      message: '설정이 저장되었습니다'
    })
  } catch (error) {
    console.error('OCR settings update error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '설정 저장 실패' },
      { status: 500 }
    )
  }
}
