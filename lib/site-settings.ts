import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

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

const DEFAULT_SETTINGS: SiteSettings = {
  siteName: 'Mimo Health Log',
  siteDescription: '미모 건강 기록',
  faviconUrl: '/favicon.ico',
  logoUrl: null,
  ogImageUrl: null,
  keywords: ['반려동물', '건강기록', '혈액검사', '일일기록'],
  themeColor: '#ffffff',
  language: 'ko'
}

// React cache()로 SSR 요청당 1회만 실행 (layout.tsx에서 3회 호출되는 중복 방지)
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'site_settings')
      .single()

    if (error || !data) {
      return DEFAULT_SETTINGS
    }

    return { ...DEFAULT_SETTINGS, ...data.value }
  } catch {
    return DEFAULT_SETTINGS
  }
})

export { DEFAULT_SETTINGS }
