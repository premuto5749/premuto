'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { LOG_CATEGORY_CONFIG } from '@/types'
import type { ClipboardLogItem } from '@/types'

interface PasteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: ClipboardLogItem[]
  targetDate: string  // YYYY-MM-DD
  onConfirm: () => void
  isPasting: boolean
}

function formatDateKorean(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}월 ${parseInt(d)}일`
}

export function PasteConfirmDialog({
  open,
  onOpenChange,
  items,
  targetDate,
  onConfirm,
  isPasting,
}: PasteConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>기록 붙여넣기</AlertDialogTitle>
          <AlertDialogDescription>
            {formatDateKorean(targetDate)}에 {items.length}개 기록을 붙여넣을까요?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="max-h-48 overflow-y-auto space-y-1 my-2">
          {items.map((item, idx) => {
            const config = LOG_CATEGORY_CONFIG[item.category]
            return (
              <div key={idx} className="flex items-center gap-2 text-sm py-1 px-2 rounded bg-muted/50">
                <span>{config.icon}</span>
                <span className="font-medium">{config.label}</span>
                <span className="text-muted-foreground">{item.time}</span>
                {item.amount != null && (
                  <span className="text-muted-foreground">
                    {item.amount}{item.unit}
                  </span>
                )}
                {item.medicine_name && (
                  <span className="text-purple-600 text-xs">{item.medicine_name}</span>
                )}
                {item.snack_name && (
                  <span className="text-pink-600 text-xs">{item.snack_name}</span>
                )}
              </div>
            )
          })}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPasting}>취소</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isPasting}>
            {isPasting ? '붙여넣는 중...' : '붙여넣기'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
