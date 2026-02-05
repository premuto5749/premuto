'use client'

import { ReactNode } from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { PetProvider } from '@/contexts/PetContext'
import { RequirePetGuard } from '@/components/RequirePetGuard'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <PetProvider>
        <RequirePetGuard>
          {children}
        </RequirePetGuard>
      </PetProvider>
    </AuthProvider>
  )
}
