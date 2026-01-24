'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { autoMapItem, getAllStandardItems, calculateStatus } from '@/lib/ocr/mapper'
import type { OcrResult, StandardItem, StagingItem } from '@/types'
import { Plus } from 'lucide-react'

interface StagingTableProps {
  ocrItems: OcrResult[]
  onItemsChange: (items: StagingItem[]) => void
}

export function StagingTable({ ocrItems, onItemsChange }: StagingTableProps) {
  const [stagingItems, setStagingItems] = useState<StagingItem[]>([])
  const [standardItems, setStandardItems] = useState<StandardItem[]>([])
  const [loading, setLoading] = useState(true)

  // 초기 로드: 표준 항목 조회 및 자동 매핑
  useEffect(() => {
    async function initializeData() {
      // 1. 표준 항목 조회
      const items = await getAllStandardItems()
      setStandardItems(items)

      // 2. OCR 결과를 StagingItem으로 변환 및 자동 매핑
      const mapped = await Promise.all(
        ocrItems.map(async (ocrItem, index) => {
          const standardItemId = await autoMapItem(ocrItem.name)
          const standardItem = items.find(i => i.id === standardItemId)
          
          const status = calculateStatus(
            ocrItem.value,
            ocrItem.ref_min,
            ocrItem.ref_max
          )

          return {
            id: `staging-${index}`,
            name: ocrItem.name,
            value: ocrItem.value,
            unit: ocrItem.unit,
            ref_min: ocrItem.ref_min,
            ref_max: ocrItem.ref_max,
            ref_text: ocrItem.ref_text,
            standard_item_id: standardItemId,
            standard_item_name: standardItem?.name || null,
            status,
            is_mapped: !!standardItemId
          } as StagingItem
        })
      )

      setStagingItems(mapped)
      onItemsChange(mapped)
      setLoading(false)
    }

    initializeData()
  }, [ocrItems, onItemsChange])

  // 항목 업데이트 핸들러
  const updateItem = (index: number, updates: Partial<StagingItem>) => {
    const newItems = [...stagingItems]
    newItems[index] = { ...newItems[index], ...updates }
    
    // 값이 변경되면 상태 재계산
    if ('value' in updates || 'ref_min' in updates || 'ref_max' in updates) {
      const item = newItems[index]
      newItems[index].status = calculateStatus(item.value, item.ref_min, item.ref_max)
    }
    
    setStagingItems(newItems)
    onItemsChange(newItems)
  }

  // 표준 항목 선택 핸들러
  const handleStandardItemSelect = (index: number, standardItemId: string) => {
    const standardItem = standardItems.find(i => i.id === standardItemId)
    updateItem(index, {
      standard_item_id: standardItemId,
      standard_item_name: standardItem?.name || null,
      is_mapped: true
    })
  }

  // 상태 아이콘
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'High':
        return <span className="text-red-500">🔴 High</span>
      case 'Low':
        return <span className="text-blue-500">🔵 Low</span>
      case 'Normal':
        return <span className="text-green-500">🟢 Normal</span>
      default:
        return <span className="text-muted-foreground">- Unknown</span>
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">매핑 중...</div>
  }

  return (
    <div className="space-y-4">
      {stagingItems.map((item, index) => (
        <div
          key={item.id}
          className={`p-4 border rounded-lg ${!item.is_mapped ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20' : ''}`}
        >
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* OCR 항목명 */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">OCR 항목명</label>
              <Input
                value={item.name}
                onChange={(e) => updateItem(index, { name: e.target.value })}
                className="font-medium"
              />
            </div>

            {/* 표준 항목 매핑 */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                표준 항목 {!item.is_mapped && <span className="text-yellow-600">⚠️ 매핑 필요</span>}
              </label>
              <Select
                value={item.standard_item_id || ''}
                onValueChange={(value) => handleStandardItemSelect(index, value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="항목 선택..." />
                </SelectTrigger>
                <SelectContent>
                  {standardItems.map((stdItem) => (
                    <SelectItem key={stdItem.id} value={stdItem.id}>
                      {stdItem.name} ({stdItem.display_name_ko})
                    </SelectItem>
                  ))}
                  <SelectItem value="new-item" disabled>
                    <Plus className="w-4 h-4 inline mr-2" />
                    신규 항목 추가 (Phase 4)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 결과값 */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">결과값</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.01"
                  value={item.value}
                  onChange={(e) => updateItem(index, { value: parseFloat(e.target.value) })}
                  className="flex-1"
                />
                <Input
                  value={item.unit}
                  onChange={(e) => updateItem(index, { unit: e.target.value })}
                  className="w-20"
                  placeholder="단위"
                />
              </div>
            </div>

            {/* 참고치 */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">참고치</label>
              <div className="flex gap-1 items-center">
                <Input
                  type="number"
                  step="0.01"
                  value={item.ref_min || ''}
                  onChange={(e) => updateItem(index, { ref_min: e.target.value ? parseFloat(e.target.value) : null })}
                  placeholder="Min"
                  className="w-full"
                />
                <span className="text-muted-foreground">~</span>
                <Input
                  type="number"
                  step="0.01"
                  value={item.ref_max || ''}
                  onChange={(e) => updateItem(index, { ref_max: e.target.value ? parseFloat(e.target.value) : null })}
                  placeholder="Max"
                  className="w-full"
                />
              </div>
            </div>

            {/* 상태 */}
            <div className="flex items-end">
              <div className="w-full">
                <label className="text-xs text-muted-foreground block mb-1">상태</label>
                <div className="h-9 flex items-center font-medium">
                  {getStatusIcon(item.status)}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
