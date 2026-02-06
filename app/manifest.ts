import type { MetadataRoute } from 'next'
import { getSiteSettings } from '@/lib/site-settings'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getSiteSettings()

  return {
    name: settings.siteName,
    short_name: settings.siteName,
    description: settings.siteDescription,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: settings.themeColor,
    icons: settings.faviconUrl
      ? [
          { src: settings.faviconUrl, sizes: 'any', type: 'image/x-icon' },
        ]
      : [
          { src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' },
        ],
  }
}
