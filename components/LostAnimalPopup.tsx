'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Flyer {
  id: string
  imageUrl: string
  title: string
  status: 'active' | 'closed'
}

const DISMISS_STORAGE_KEY = 'mimo_lost_animal_popup_dismissed'
const EXCLUDED_PATHS = ['/login', '/auth', '/admin']

function isDismissedToday(): boolean {
  try {
    const stored = localStorage.getItem(DISMISS_STORAGE_KEY)
    if (!stored) return false

    const dismissedUntil = new Date(stored)
    return dismissedUntil > new Date()
  } catch {
    return false
  }
}

function dismissUntilEndOfDay() {
  try {
    // KST 기준 오늘 23:59:59
    const now = new Date()
    const kstOffset = 9 * 60 * 60 * 1000
    const kstNow = new Date(now.getTime() + kstOffset)
    const kstDateStr = kstNow.toISOString().split('T')[0]
    const dismissUntil = new Date(kstDateStr + 'T23:59:59+09:00')
    localStorage.setItem(DISMISS_STORAGE_KEY, dismissUntil.toISOString())
  } catch {
    // ignore storage errors
  }
}

export function LostAnimalPopup() {
  const pathname = usePathname()
  const router = useRouter()
  const [flyer, setFlyer] = useState<Flyer | null>(null)
  const [open, setOpen] = useState(false)

  const isExcluded = EXCLUDED_PATHS.some(p => pathname?.startsWith(p))

  useEffect(() => {
    if (isExcluded) return

    // 500ms delay to let AnnouncementPopup render first
    const timer = setTimeout(async () => {
      try {
        if (isDismissedToday()) return

        // 로그인 사용자에게만 표시
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const res = await fetch('/api/lost-animals')
        const data = await res.json()
        if (!data.success) return

        // 활성 전단지만 필터
        const activeFlyers = (data.data || []).filter((f: Flyer) => f.status === 'active')
        if (activeFlyers.length === 0) return

        // 랜덤 1장 선택
        const randomIdx = Math.floor(Math.random() * activeFlyers.length)
        setFlyer(activeFlyers[randomIdx])
        setOpen(true)
      } catch (err) {
        console.error('Failed to fetch lost animal flyers:', err)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [isExcluded])

  const handleDismissToday = () => {
    dismissUntilEndOfDay()
    setOpen(false)
    setFlyer(null)
  }

  const handleClose = () => {
    setOpen(false)
    setFlyer(null)
  }

  const handleImageClick = () => {
    setOpen(false)
    setFlyer(null)
    router.push('/lost-animals')
  }

  if (isExcluded || !flyer) return null

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose() }}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="text-base">{flyer.title}</DialogTitle>
          <DialogDescription className="sr-only">유실 동물 전단지</DialogDescription>
        </DialogHeader>
        <div className="px-4">
          <div
            className="relative w-full aspect-[3/4] rounded-lg overflow-hidden cursor-pointer"
            onClick={handleImageClick}
          >
            <Image
              src={flyer.imageUrl}
              alt={flyer.title}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            더 많은 전단지를 보려면 이미지를 클릭하세요
          </p>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2 p-4 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDismissToday}
          >
            하루동안 보지않기
          </Button>
          <Button
            size="sm"
            onClick={handleClose}
          >
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
