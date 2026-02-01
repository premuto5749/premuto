'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { Pet } from '@/types'

interface PetContextType {
  pets: Pet[]
  currentPet: Pet | null
  isLoading: boolean
  error: string | null
  setCurrentPet: (pet: Pet | null) => void
  refreshPets: () => Promise<void>
  addPet: (pet: Pet) => void
  updatePet: (pet: Pet) => void
  removePet: (petId: string) => void
}

const PetContext = createContext<PetContextType | undefined>(undefined)

const CURRENT_PET_KEY = 'mimo_current_pet_id'

export function PetProvider({ children }: { children: ReactNode }) {
  const [pets, setPets] = useState<Pet[]>([])
  const [currentPet, setCurrentPetState] = useState<Pet | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPets = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const res = await fetch('/api/pets')
      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch pets')
      }

      const fetchedPets: Pet[] = data.data || []
      setPets(fetchedPets)

      // 저장된 currentPet ID가 있으면 해당 pet 선택
      const savedPetId = localStorage.getItem(CURRENT_PET_KEY)

      if (savedPetId) {
        const savedPet = fetchedPets.find(p => p.id === savedPetId)
        if (savedPet) {
          setCurrentPetState(savedPet)
          return
        }
      }

      // 저장된 ID가 없거나 해당 pet이 없으면 기본 pet 선택
      const defaultPet = fetchedPets.find(p => p.is_default) || fetchedPets[0] || null
      setCurrentPetState(defaultPet)

      if (defaultPet) {
        localStorage.setItem(CURRENT_PET_KEY, defaultPet.id)
      }

    } catch (err) {
      console.error('Failed to fetch pets:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch pets')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPets()
  }, [fetchPets])

  const setCurrentPet = useCallback((pet: Pet | null) => {
    setCurrentPetState(pet)
    if (pet) {
      localStorage.setItem(CURRENT_PET_KEY, pet.id)
    } else {
      localStorage.removeItem(CURRENT_PET_KEY)
    }
  }, [])

  const addPet = useCallback((pet: Pet) => {
    setPets(prev => [...prev, pet])
    // 첫 번째 반려동물이면 자동 선택
    if (pets.length === 0 || pet.is_default) {
      setCurrentPet(pet)
    }
  }, [pets.length, setCurrentPet])

  const updatePet = useCallback((updatedPet: Pet) => {
    setPets(prev => prev.map(p => p.id === updatedPet.id ? updatedPet : p))
    // 현재 선택된 반려동물이 업데이트된 경우
    if (currentPet?.id === updatedPet.id) {
      setCurrentPetState(updatedPet)
    }
    // 기본 반려동물이 변경된 경우 다른 반려동물의 is_default를 false로
    if (updatedPet.is_default) {
      setPets(prev => prev.map(p =>
        p.id === updatedPet.id ? updatedPet : { ...p, is_default: false }
      ))
    }
  }, [currentPet?.id])

  const removePet = useCallback((petId: string) => {
    setPets(prev => {
      const newPets = prev.filter(p => p.id !== petId)

      // 삭제된 반려동물이 현재 선택된 반려동물이면 다른 것 선택
      if (currentPet?.id === petId) {
        const newDefaultPet = newPets.find(p => p.is_default) || newPets[0] || null
        setCurrentPet(newDefaultPet)
      }

      return newPets
    })
  }, [currentPet?.id, setCurrentPet])

  return (
    <PetContext.Provider value={{
      pets,
      currentPet,
      isLoading,
      error,
      setCurrentPet,
      refreshPets: fetchPets,
      addPet,
      updatePet,
      removePet,
    }}>
      {children}
    </PetContext.Provider>
  )
}

export function usePet() {
  const context = useContext(PetContext)
  if (context === undefined) {
    throw new Error('usePet must be used within a PetProvider')
  }
  return context
}
