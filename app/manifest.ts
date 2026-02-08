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
    icons: [
      ...(settings.faviconUrl
        ? [{ src: settings.faviconUrl, sizes: 'any', type: 'image/x-icon' }]
        : [{ src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' }]),
      { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
}
