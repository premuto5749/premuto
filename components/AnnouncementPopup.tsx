'use client'

import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface PopupAnnouncement {
  id: string
  title: string
  content: string
  updatedAt: string
  type?: 'general' | 'stray_dog'
}

interface DismissState {
  [announcementId: string]: {
    contentKey: string
    dismissUntil: string
  }
}

const DISMISS_STORAGE_KEY = 'mimo_popup_dismissed'
const EXCLUDED_PATHS = ['/login', '/auth', '/admin']

function getDismissState(): DismissState {
  try {
    const stored = localStorage.getItem(DISMISS_STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

function saveDismissState(state: DismissState) {
  try {
    localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore storage errors
  }
}

function shouldShow(announcement: PopupAnnouncement, dismissState: DismissState): boolean {
  const dismiss = dismissState[announcement.id]
  if (!dismiss) return true

  // 내용이 변경되었으면 dismiss 무효화
  if (dismiss.contentKey !== announcement.updatedAt) return true

  // dismiss 기간이 만료되었으면 표시
  if (new Date(dismiss.dismissUntil) <= new Date()) return true

  return false
}

export function AnnouncementPopup() {
  const pathname = usePathname()
  const [announcements, setAnnouncements] = useState<PopupAnnouncement[]>([])
  const [dismissState, setDismissState] = useState<DismissState>({})
  const [currentAnnouncement, setCurrentAnnouncement] = useState<PopupAnnouncement | null>(null)
  const [open, setOpen] = useState(false)

  // 제외 경로 체크
  const isExcluded = EXCLUDED_PATHS.some(p => pathname?.startsWith(p))

  // 표시할 다음 공지 찾기
  const findNextAnnouncement = useCallback((list: PopupAnnouncement[], state: DismissState): PopupAnnouncement | null => {
    return list.find(a => shouldShow(a, state)) || null
  }, [])

  // 공지 목록 fetch
  useEffect(() => {
    if (isExcluded) return

    const fetchAnnouncements = async () => {
      try {
        // 로그인 사용자에게만 공지사항 표시
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const res = await fetch('/api/popup-settings')
        const data = await res.json()
        if (data.success && data.data.length > 0) {
          const stored = getDismissState()
          setDismissState(stored)
          setAnnouncements(data.data)

          const next = findNextAnnouncement(data.data, stored)
          if (next) {
            setCurrentAnnouncement(next)
            setOpen(true)
          }
        }
      } catch (err) {
        console.error('Failed to fetch popup settings:', err)
      }
    }

    fetchAnnouncements()
  }, [isExcluded, findNextAnnouncement])

  const handleDismiss = (days: number) => {
    if (!currentAnnouncement) return

    const dismissUntil = new Date()
    dismissUntil.setDate(dismissUntil.getDate() + days)

    const newState: DismissState = {
      ...dismissState,
      [currentAnnouncement.id]: {
        contentKey: currentAnnouncement.updatedAt,
        dismissUntil: dismissUntil.toISOString(),
      }
    }
    setDismissState(newState)
    saveDismissState(newState)

    // 다음 공지 확인
    const next = findNextAnnouncement(
      announcements.filter(a => a.id !== currentAnnouncement.id),
      newState
    )
    if (next) {
      setCurrentAnnouncement(next)
    } else {
      setOpen(false)
      setCurrentAnnouncement(null)
    }
  }

  const handleDismissToday = () => {
    if (!currentAnnouncement) return

    // KST 기준 오늘 23:59:59
    const kstDateStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
    const dismissUntil = new Date(kstDateStr + 'T23:59:59+09:00')

    const newState: DismissState = {
      ...dismissState,
      [currentAnnouncement.id]: {
        contentKey: currentAnnouncement.updatedAt,
        dismissUntil: dismissUntil.toISOString(),
      }
    }
    setDismissState(newState)
    saveDismissState(newState)

    // 다음 공지 확인
    const next = findNextAnnouncement(
      announcements.filter(a => a.id !== currentAnnouncement.id),
      newState
    )
    if (next) {
      setCurrentAnnouncement(next)
    } else {
      setOpen(false)
      setCurrentAnnouncement(null)
    }
  }

  const handleClose = () => {
    // 닫기: dismiss 저장 없이 닫기 (다음 방문 시 다시 표시)
    setOpen(false)
    setCurrentAnnouncement(null)
  }

  if (isExcluded || !currentAnnouncement) return null

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{currentAnnouncement.title}</DialogTitle>
          <DialogDescription className="sr-only">공지사항</DialogDescription>
        </DialogHeader>
        <div
          className="max-w-none py-2 max-h-[60vh] overflow-y-auto text-sm leading-relaxed [&_p]:mb-2 [&_p:last-child]:mb-0 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_li]:mb-0.5 [&_strong]:font-semibold [&_a]:text-primary [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: currentAnnouncement.content }}
        />
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {currentAnnouncement.type === 'stray_dog' ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDismissToday}
              >
                오늘은 그만 보기
              </Button>
              <Button
                size="sm"
                onClick={handleClose}
              >
                닫기
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDismiss(7)}
              >
                7일간 보지 않기
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDismiss(1)}
              >
                1일간 보지 않기
              </Button>
              <Button
                size="sm"
                onClick={handleClose}
              >
                닫기
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
