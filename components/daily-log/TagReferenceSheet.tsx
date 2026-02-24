'use client'

import Image from 'next/image'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'

interface ReferenceItem {
  label: string
  description: string
  color?: string
  icon?: string
  score?: number
}

interface TagReferenceSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  items: ReferenceItem[]
  headerImage?: string
}

export function TagReferenceSheet({ open, onOpenChange, title, items, headerImage }: TagReferenceSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl">
        <SheetHeader className="pb-3">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription className="sr-only">{title} 참고 정보</SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto max-h-[calc(85vh-80px)] -mx-1 px-1 space-y-2 pb-4">
          {headerImage && (
            <div className="rounded-lg overflow-hidden border border-muted mb-3">
              <Image
                src={headerImage}
                alt={title}
                width={600}
                height={800}
                className="w-full h-auto"
                priority
              />
            </div>
          )}
          {items.map((item, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              {/* 색상 또는 아이콘 */}
              <div className="flex-shrink-0 mt-0.5">
                {item.color ? (
                  <span
                    className="block w-8 h-8 rounded-full border border-black/10"
                    style={{ backgroundColor: item.color }}
                  />
                ) : item.icon ? (
                  <span className="text-2xl">{item.icon}</span>
                ) : null}
              </div>
              {/* 텍스트 */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">
                  {item.label}
                  {item.score !== undefined && (
                    <span className="text-muted-foreground font-normal ml-1">
                      (Score {item.score})
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
