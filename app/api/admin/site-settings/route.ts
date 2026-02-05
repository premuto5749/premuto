import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkCurrentUserIsAdmin } from '@/lib/auth/admin'

export interface SiteSettings {
  siteName: string
  siteDescription: string
  faviconUrl: string | null
  logoUrl: string | null
  ogImageUrl: string | null
  keywords: string[]
  themeColor: string
  language: string
}

// 기본값
const DEFAULT_SETTINGS: SiteSettings = {
  siteName: 'Mimo Health Log',
  siteDescription: '미모 건강 기록',
  faviconUrl: null,
  logoUrl: null,
  ogImageUrl: null,
  keywords: ['반려동물', '건강기록', '혈액검사', '일일기록'],
  themeColor: '#ffffff',
  language: 'ko'
}

// GET: 관리자만 설정 조회 가능
export async function GET() {
  try {
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
      .eq('key', 'site_settings')
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Failed to fetch site settings:', error)
      return NextResponse.json({
        success: true,
        data: DEFAULT_SETTINGS
      })
    }

    if (!data) {
      return NextResponse.json({
        success: true,
        data: DEFAULT_SETTINGS
      })
    }

    const settings: SiteSettings = { ...DEFAULT_SETTINGS, ...data.value }

    return NextResponse.json({
      success: true,
      data: settings
    })
  } catch (error) {
    console.error('Site settings API error:', error)
    return NextResponse.json({
      success: true,
      data: DEFAULT_SETTINGS
    })
  }
}

// PUT: 관리자만 설정 수정 가능
export async function PUT(request: NextRequest) {
  try {
    const { isAdmin } = await checkCurrentUserIsAdmin()
    if (!isAdmin) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다' },
        { status: 403 }
      )
    }

    const supabase = await createClient()
    const body = await request.json() as Partial<SiteSettings>

    // 유효성 검사
    if (body.siteName !== undefined && body.siteName.trim().length === 0) {
      return NextResponse.json(
        { error: '사이트 이름은 필수입니다' },
        { status: 400 }
      )
    }

    if (body.themeColor !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(body.themeColor)) {
      return NextResponse.json(
        { error: '테마 색상은 HEX 형식이어야 합니다 (예: #ffffff)' },
        { status: 400 }
      )
    }

    // 기존 설정 조회
    const { data: existing } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'site_settings')
      .single()

    const currentSettings: SiteSettings = existing?.value
      ? { ...DEFAULT_SETTINGS, ...existing.value }
      : DEFAULT_SETTINGS

    // 병합
    const newSettings: SiteSettings = {
      ...currentSettings,
      ...body
    }

    // 저장
    const { error: upsertError } = await supabase
      .from('app_settings')
      .upsert({
        key: 'site_settings',
        value: newSettings,
        description: '사이트 메타데이터 설정'
      }, { onConflict: 'key' })

    if (upsertError) {
      console.error('Failed to save site settings:', upsertError)
      return NextResponse.json(
        { error: '설정 저장 실패' },
        { status: 500 }
      )
    }

    console.log('✅ Site settings updated successfully')

    return NextResponse.json({
      success: true,
      message: '설정이 저장되었습니다',
      data: newSettings
    })
  } catch (error) {
    console.error('Site settings update error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '설정 저장 실패' },
      { status: 500 }
    )
  }
}
