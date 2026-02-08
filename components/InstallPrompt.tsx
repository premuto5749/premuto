'use client'

import { useEffect, useState, useRef } from 'react'
import { usePathname } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, Share, Plus, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_STORAGE_KEY = 'mimo_install_prompt_dismissed'
const EXCLUDED_PATHS = ['/login', '/auth']

type Platform = 'chromium' | 'ios' | null

function getIsStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function getIsDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function detectPlatform(): Platform {
  if (typeof window === 'undefined') return null
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua)
  if (isIOS && isSafari) return 'ios'
  return null // chromium will be detected via beforeinstallprompt event
}

export function InstallPrompt() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [platform, setPlatform] = useState<Platform>(null)
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null)
  const isExcluded = EXCLUDED_PATHS.some(p => pathname?.startsWith(p))

  useEffect(() => {
    if (isExcluded || getIsStandalone() || getIsDismissed()) return

    // Listen for beforeinstallprompt (Chrome/Edge/Samsung Internet)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      deferredPromptRef.current = e as BeforeInstallPromptEvent
      setPlatform('chromium')
      setOpen(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // iOS Safari detection (no beforeinstallprompt event)
    const iosPlatform = detectPlatform()
    if (iosPlatform === 'ios') {
      setPlatform('ios')
      setOpen(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [isExcluded])

  const handleInstall = async () => {
    if (!deferredPromptRef.current) return

    await deferredPromptRef.current.prompt()
    const { outcome } = await deferredPromptRef.current.userChoice

    if (outcome === 'accepted') {
      setOpen(false)
    }
    deferredPromptRef.current = null
  }

  const handleClose = () => {
    setOpen(false)
  }

  const handleDismissForever = () => {
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, 'true')
    } catch {
      // ignore storage errors
    }
    setOpen(false)
  }

  if (isExcluded) return null

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            앱 설치 안내
          </DialogTitle>
          <DialogDescription>
            홈 화면에 추가하면 더 빠르고 편리하게 이용할 수 있어요.
          </DialogDescription>
        </DialogHeader>

        <div className="py-3 space-y-3 text-sm text-muted-foreground">
          {platform === 'chromium' && (
            <p>
              아래 <strong>&quot;설치하기&quot;</strong> 버튼을 누르면 바로 설치할 수 있습니다.
            </p>
          )}

          {platform === 'ios' && (
            <div className="space-y-3">
              <p>Safari에서 아래 단계를 따라 홈 화면에 추가해 주세요:</p>
              <ol className="list-none space-y-2 pl-0">
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">1</span>
                  <span>
                    하단의 <Share className="inline h-4 w-4 align-text-bottom" /> <strong>공유</strong> 버튼을 탭하세요
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">2</span>
                  <span>
                    <Plus className="inline h-4 w-4 align-text-bottom" /> <strong>홈 화면에 추가</strong>를 선택하세요
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">3</span>
                  <span>
                    <strong>추가</strong>를 탭하면 완료!
                  </span>
                </li>
              </ol>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismissForever}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            다시 보지 않기
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClose}
            >
              닫기
            </Button>
            {platform === 'chromium' && (
              <Button
                size="sm"
                onClick={handleInstall}
              >
                <Download className="h-4 w-4 mr-1" />
                설치하기
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
