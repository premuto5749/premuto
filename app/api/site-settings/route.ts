import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface SiteSettings {
  siteName: string
  siteDescription: string
  faviconUrl: string | null
  logoUrl: string | null           // 로그인 페이지용 정방형 로고
  headerLogoUrl: string | null     // 헤더 메뉴용 가로형 로고
  ogImageUrl: string | null
  keywords: string[]
  themeColor: string
  language: string
}

const DEFAULT_SETTINGS: SiteSettings = {
  siteName: 'Mimo Health Log',
  siteDescription: '미모 건강 기록',
  faviconUrl: null,
  logoUrl: null,
  headerLogoUrl: null,
  ogImageUrl: null,
  keywords: ['반려동물', '건강기록', '혈액검사', '일일기록'],
  themeColor: '#ffffff',
  language: 'ko'
}

// GET: 공개 설정 조회 (로그인 불필요)
export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'site_settings')
      .single()

    if (error || !data) {
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
  } catch {
    return NextResponse.json({
      success: true,
      data: DEFAULT_SETTINGS
    })
  }
}
