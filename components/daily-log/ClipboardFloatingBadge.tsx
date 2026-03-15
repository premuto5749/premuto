'use client'

import { Button } from '@/components/ui/button'
import { ClipboardPaste, X } from 'lucide-react'

interface ClipboardFloatingBadgeProps {
  count: number
  onPaste: () => void
  onClear: () => void
}

export function ClipboardFloatingBadge({ count, onPaste, onClear }: ClipboardFloatingBadgeProps) {
  if (count === 0) return null

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-4">
      <div className="bg-primary text-primary-foreground rounded-full shadow-lg flex items-center gap-1 pl-4 pr-1 py-1">
        <span className="text-sm font-medium whitespace-nowrap">
          📋 {count}개 복사됨
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-primary-foreground hover:bg-primary-foreground/20 rounded-full"
          onClick={onPaste}
        >
          <ClipboardPaste className="w-4 h-4 mr-1" />
          붙여넣기
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20 rounded-full"
          onClick={onClear}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div>
  )
}
