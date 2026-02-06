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

export async function getSiteSettings(): Promise<SiteSettings> {
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
}

export { DEFAULT_SETTINGS }
