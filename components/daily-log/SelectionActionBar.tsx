'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Copy, X } from 'lucide-react'

interface SelectionActionBarProps {
  selectedCount: number
  isAllSelected: boolean
  onToggleAll: () => void
  onCopy: () => void
  onCancel: () => void
}

export function SelectionActionBar({
  selectedCount,
  isAllSelected,
  onToggleAll,
  onCopy,
  onCancel,
}: SelectionActionBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg z-50 px-4 py-3">
      <div className="max-w-lg mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={isAllSelected}
              onCheckedChange={onToggleAll}
              id="select-all"
            />
            <label htmlFor="select-all" className="text-sm cursor-pointer">
              전체 선택
            </label>
          </div>
          <span className="text-sm text-muted-foreground">
            {selectedCount}개 선택됨
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onCancel}
          >
            <X className="w-4 h-4 mr-1" />
            취소
          </Button>
          <Button
            size="sm"
            onClick={onCopy}
            disabled={selectedCount === 0}
          >
            <Copy className="w-4 h-4 mr-1" />
            복사
          </Button>
        </div>
      </div>
    </div>
  )
}
