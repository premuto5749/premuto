'use client'

import { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { AuthProvider } from '@/contexts/AuthContext'
import { PetProvider } from '@/contexts/PetContext'
import { SiteSettingsProvider } from '@/contexts/SiteSettingsContext'
import { RequirePetGuard } from '@/components/RequirePetGuard'

// 팝업/프롬프트 컴포넌트는 초기 렌더링에 불필요 → 지연 로드
const AnnouncementPopup = dynamic(
  () => import('@/components/AnnouncementPopup').then(mod => ({ default: mod.AnnouncementPopup })),
  { ssr: false }
)
const LostAnimalPopup = dynamic(
  () => import('@/components/LostAnimalPopup').then(mod => ({ default: mod.LostAnimalPopup })),
  { ssr: false }
)
const InstallPrompt = dynamic(
  () => import('@/components/InstallPrompt').then(mod => ({ default: mod.InstallPrompt })),
  { ssr: false }
)

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SiteSettingsProvider>
      <AuthProvider>
        <PetProvider>
          <RequirePetGuard>
            {children}
          </RequirePetGuard>
          <AnnouncementPopup />
          <LostAnimalPopup />
          <InstallPrompt />
        </PetProvider>
      </AuthProvider>
    </SiteSettingsProvider>
  )
}
