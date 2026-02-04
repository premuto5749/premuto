'use client'

import { ReactNode } from 'react'
import { PetProvider } from '@/contexts/PetContext'
import { RequirePetGuard } from '@/components/RequirePetGuard'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <PetProvider>
      <RequirePetGuard>
        {children}
      </RequirePetGuard>
    </PetProvider>
  )
}
