'use client'

import { ReactNode } from 'react'
import { PetProvider } from '@/contexts/PetContext'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <PetProvider>
      {children}
    </PetProvider>
  )
}
