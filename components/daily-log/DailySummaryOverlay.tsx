'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Camera, Image as ImageIcon, Loader2, Sun, Moon, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useSiteSettings } from '@/contexts/SiteSettingsContext'
import { renderSummaryImage, type SummaryTheme } from '@/lib/summary-image-renderer'
import type { DailyStats } from '@/types'

interface DailySummaryOverlayProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stats: DailyStats | null
  date: string
  petName: string
}

export function DailySummaryOverlay({ open, onOpenChange, stats, date, petName }: DailySummaryOverlayProps) {
  const [photo, setPhoto] = useState<File | null>(null)
  const [theme, setTheme] = useState<SummaryTheme>('white')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isRendering, setIsRendering] = useState(false)
  const [resultBlob, setResultBlob] = useState<Blob | null>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const logoImgRef = useRef<HTMLImageElement | null>(null)
  const { toast } = useToast()
  const { settings } = useSiteSettings()

  // 로고 프리로드
  useEffect(() => {
    if (!open) return
    const img = new Image()
    img.onload = () => { logoImgRef.current = img }
    img.src = settings.shareLogoUrl || '/email/logo.png'
  }, [open, settings.shareLogoUrl])

  // 사진 선택 시 렌더링
  const renderPreview = useCallback(async (file: File, t: SummaryTheme) => {
    if (!stats || !logoImgRef.current) return

    setIsRendering(true)
    try {
      const blob = await renderSummaryImage({
        photo: file,
        petName,
        date,
        stats,
        theme: t,
        logoImg: logoImgRef.current,
      })

      setResultBlob(blob)

      // 이전 preview URL 정리
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      setPreviewUrl(URL.createObjectURL(blob))
    } catch (err) {
      console.error('Render failed:', err)
      toast({
        title: '이미지 생성 실패',
        description: '다시 시도해 주세요.',
        variant: 'destructive',
      })
    } finally {
      setIsRendering(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats, petName, date, toast]) // previewUrl 의존성 제거 - 추가 시 무한 렌더 루프

  // 사진 변경 시 렌더링
  useEffect(() => {
    if (photo && open) {
      renderPreview(photo, theme)
    }
  }, [photo, theme, open, renderPreview])

  // cleanup on close
  useEffect(() => {
    if (!open) {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      setPhoto(null)
      setPreviewUrl(null)
      setResultBlob(null)
      setTheme('white')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]) // previewUrl 의존성 제거 - close 시에만 실행

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast({
        title: '지원하지 않는 형식',
        description: '이미지 파일만 선택할 수 있습니다.',
        variant: 'destructive',
      })
      return
    }

    setPhoto(file)

    // input 초기화
    if (cameraInputRef.current) cameraInputRef.current.value = ''
    if (galleryInputRef.current) galleryInputRef.current.value = ''
  }

  const handleSave = async () => {
    if (!resultBlob) return

    const filename = `${petName}_${date}_건강요약.jpg`

    // Web Share API 시도 (모바일)
    if (navigator.share && navigator.canShare) {
      try {
        const file = new File([resultBlob], filename, { type: 'image/jpeg' })
        const shareData = { files: [file] }
        if (navigator.canShare(shareData)) {
          await navigator.share(shareData)
          return
        }
      } catch (err) {
        // 사용자가 공유 취소한 경우 무시
        if (err instanceof Error && err.name === 'AbortError') return
      }
    }

    // 폴백: 다운로드
    const url = URL.createObjectURL(resultBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: '저장 완료',
      description: '이미지가 다운로드되었습니다.',
    })
  }

  if (!stats) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>사진으로 공유</DialogTitle>
        </DialogHeader>

        {!photo ? (
          // 사진 선택 화면
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground text-center">
              반려동물 사진을 선택하면<br />
              오늘의 건강 기록이 함께 표시됩니다
            </p>

            {/* 카메라 촬영 */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              className="w-full h-14"
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera className="w-5 h-5 mr-3" />
              카메라로 촬영
            </Button>

            {/* 갤러리 선택 */}
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              className="w-full h-14"
              onClick={() => galleryInputRef.current?.click()}
            >
              <ImageIcon className="w-5 h-5 mr-3" />
              갤러리에서 선택
            </Button>
          </div>
        ) : (
          // 미리보기 + 옵션 화면
          <div className="space-y-4 py-2">
            {/* 테마 토글 */}
            <div className="flex items-center justify-center gap-2">
              <Button
                variant={theme === 'white' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('white')}
              >
                <Sun className="w-4 h-4 mr-1" />
                화이트
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('dark')}
              >
                <Moon className="w-4 h-4 mr-1" />
                다크
              </Button>
            </div>

            {/* 미리보기 */}
            <div className="relative rounded-lg overflow-hidden bg-muted">
              {isRendering && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              )}
              {previewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="미리보기"
                  className="w-full h-auto"
                />
              )}
            </div>

            {/* 하단 버튼 */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setPhoto(null)
                  if (previewUrl) URL.revokeObjectURL(previewUrl)
                  setPreviewUrl(null)
                  setResultBlob(null)
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                다른 사진
              </Button>
              <Button
                className="flex-1"
                onClick={handleSave}
                disabled={!resultBlob || isRendering}
              >
                저장
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
