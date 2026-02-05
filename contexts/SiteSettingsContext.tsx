'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

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
  faviconUrl: null,
  logoUrl: null,
  ogImageUrl: null,
  keywords: ['반려동물', '건강기록', '혈액검사', '일일기록'],
  themeColor: '#ffffff',
  language: 'ko'
}

interface SiteSettingsContextType {
  settings: SiteSettings
  isLoading: boolean
}

const SiteSettingsContext = createContext<SiteSettingsContextType>({
  settings: DEFAULT_SETTINGS,
  isLoading: true
})

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/site-settings')
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.data) {
            setSettings(data.data)
          }
        }
      } catch (err) {
        console.error('Failed to fetch site settings:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSettings()
  }, [])

  return (
    <SiteSettingsContext.Provider value={{ settings, isLoading }}>
      {children}
    </SiteSettingsContext.Provider>
  )
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext)
}
