'use client'

import { useEffect, useState, useCallback } from 'react'
import { AppHeader } from '@/components/layout/AppHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2 } from 'lucide-react'
import type { MedicinePreset, SnackPreset } from '@/types'
import { SnackPresetSection } from '@/components/manage/SnackPresetSection'
import { MedicinePresetSection } from '@/components/manage/MedicinePresetSection'

export default function ManagePage() {
  const [loading, setLoading] = useState(true)
  const [medicinePresets, setMedicinePresets] = useState<MedicinePreset[]>([])
  const [snackPresets, setSnackPresets] = useState<SnackPreset[]>([])

  const loadData = useCallback(async () => {
    try {
      const [medicineRes, snackRes] = await Promise.all([
        fetch('/api/medicine-presets'),
        fetch('/api/snack-presets')
      ])

      const [medicineData, snackData] = await Promise.all([
        medicineRes.json(),
        snackRes.json()
      ])

      if (medicineData.success) setMedicinePresets(medicineData.data)
      if (snackData.success) setSnackPresets(snackData.data)
    } catch (error) {
      console.error('Failed to load manage data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) {
    return (
      <div className="min-h-screen bg-muted">
        <AppHeader title="간식 / 약 관리" />
        <div className="container max-w-4xl mx-auto py-10">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader title="간식 / 약 관리" />
      <div className="container max-w-4xl mx-auto py-6 px-4">
        <Tabs defaultValue="snack" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="snack" className="text-xs sm:text-sm">
              🍪 간식 관리
            </TabsTrigger>
            <TabsTrigger value="medicine" className="text-xs sm:text-sm">
              💊 약 프리셋
            </TabsTrigger>
          </TabsList>

          <TabsContent value="snack">
            <SnackPresetSection
              presets={snackPresets}
              setPresets={setSnackPresets}
            />
          </TabsContent>

          <TabsContent value="medicine">
            <MedicinePresetSection
              presets={medicinePresets}
              setPresets={setMedicinePresets}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
