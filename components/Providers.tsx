'use client'

import { ReactNode } from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { PetProvider } from '@/contexts/PetContext'
import { SiteSettingsProvider } from '@/contexts/SiteSettingsContext'
import { RequirePetGuard } from '@/components/RequirePetGuard'
import { AnnouncementPopup } from '@/components/AnnouncementPopup'
import { InstallPrompt } from '@/components/InstallPrompt'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SiteSettingsProvider>
      <AuthProvider>
        <PetProvider>
          <RequirePetGuard>
            {children}
          </RequirePetGuard>
          <AnnouncementPopup />
          <InstallPrompt />
        </PetProvider>
      </AuthProvider>
    </SiteSettingsProvider>
  )
}
