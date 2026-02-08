'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export interface SiteSettings {
  siteName: string
  siteDescription: string
  faviconUrl: string | null
  logoUrl: string | null
  headerLogoUrl: string | null
  loginBgImageUrl: string | null
  ogImageUrl: string | null
  shareLogoUrl: string | null
  keywords: string[]
  themeColor: string
  primaryColor: string
  language: string
}

const DEFAULT_SETTINGS: SiteSettings = {
  siteName: 'Mimo Health Log',
  siteDescription: '미모 건강 기록',
  faviconUrl: null,
  logoUrl: null,
  headerLogoUrl: null,
  loginBgImageUrl: null,
  ogImageUrl: null,
  shareLogoUrl: null,
  keywords: ['반려동물', '건강기록', '혈액검사', '일일기록'],
  themeColor: '#ffffff',
  primaryColor: '#f97316',
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

  // Apply CSS variables when settings change
  useEffect(() => {
    if (settings.primaryColor) {
      document.documentElement.style.setProperty('--primary-color', settings.primaryColor)
      // Convert hex to HSL for Tailwind compatibility
      const hex = settings.primaryColor.replace('#', '')
      const r = parseInt(hex.substring(0, 2), 16) / 255
      const g = parseInt(hex.substring(2, 4), 16) / 255
      const b = parseInt(hex.substring(4, 6), 16) / 255
      const max = Math.max(r, g, b), min = Math.min(r, g, b)
      const l = (max + min) / 2
      let h = 0, s = 0
      if (max !== min) {
        const d = max - min
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
          case g: h = ((b - r) / d + 2) / 6; break
          case b: h = ((r - g) / d + 4) / 6; break
        }
      }
      document.documentElement.style.setProperty('--primary', `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`)
    }
  }, [settings.primaryColor])

  return (
    <SiteSettingsContext.Provider value={{ settings, isLoading }}>
      {children}
    </SiteSettingsContext.Provider>
  )
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext)
}
