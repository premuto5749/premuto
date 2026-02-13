'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import imageCompression from 'browser-image-compression'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AppHeader } from '@/components/layout/AppHeader'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, ArrowRight, AlertCircle, Info } from 'lucide-react'
import { usePet } from '@/contexts/PetContext'
import { useAuth } from '@/contexts/AuthContext'

const FileUploader = dynamic(
  () => import('@/components/upload/FileUploader').then(mod => ({ default: mod.FileUploader })),
  { ssr: false, loading: () => <div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div> }
)

// 압축 설정
const COMPRESSION_SETTINGS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 2400,
  initialQuality: 0.85,
  useWebWorker: true,
}

export default function UploadQuickPage() {
  const router = useRouter()
  const { currentPet } = usePet()
  const { tier: tierData, tierLoading, refreshTier } = useAuth()
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rateLimitError, setRateLimitError] = useState(false)
  const [tierLimitError, setTierLimitError] = useState(false)

  const maxFiles = tierData?.config.max_files_per_ocr ?? 5

  const handleFilesSelect = (files: File[]) => {
    if (files.length > maxFiles) {
      setError(`최대 ${maxFiles}개 파일만 업로드 가능합니다.`)
      setSelectedFiles(files.slice(0, maxFiles))
      return
    }
    setSelectedFiles(files)
    setError(null)
  }

  const handleFileRemove = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
    setError(null)
  }

  const ocrUsage = tierData?.usage.ocr_analysis
  const isLimitReached = ocrUsage ? (ocrUsage.limit !== -1 && ocrUsage.remaining <= 0) : false

  const handleAnalyze = async () => {
    if (selectedFiles.length === 0) return

    setIsProcessing(true)
    setError(null)

    try {
      const formData = new FormData()
      const MAX_PAYLOAD_MB = 4.5

      // pet_id 추가 (Google Drive 백업용)
      if (currentPet?.id) {
        formData.append('pet_id', currentPet.id)
      }

      // 이미지 압축 후 FormData에 추가
      let totalSize = 0
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i]
        let processedFile = file

        // 이미지 파일만 압축 (PDF는 제외)
        if (file.type.startsWith('image/')) {
          try {
            processedFile = await imageCompression(file, COMPRESSION_SETTINGS)
            console.log(`Compressed ${file.name}: ${(file.size / 1024).toFixed(1)}KB -> ${(processedFile.size / 1024).toFixed(1)}KB`)
          } catch (compressError) {
            console.warn(`Failed to compress ${file.name}, using original`, compressError)
          }
        }

        totalSize += processedFile.size
        formData.append(`file${i}`, processedFile, file.name)
      }

      // 압축 후 전체 크기 체크
      const totalMB = totalSize / (1024 * 1024)
      if (totalMB > MAX_PAYLOAD_MB) {
        throw new Error(
          `파일 합계 ${totalMB.toFixed(1)}MB가 업로드 제한(${MAX_PAYLOAD_MB}MB)을 초과합니다.\n` +
          `이미지는 자동 압축되지만, PDF는 원본 크기 그대로 전송됩니다.\n` +
          `파일 수를 줄이거나 PDF 대신 이미지를 사용해보세요.`
        )
      }

      const response = await fetch('/api/ocr-batch', {
        method: 'POST',
        body: formData,
      })

      // 413 에러 처리 (Payload Too Large) - 서버 측 추가 안전망
      if (response.status === 413) {
        throw new Error('파일 크기가 서버 제한을 초과했습니다. 파일 수를 줄여주세요.')
      }

      // JSON 파싱 시도
      let result
      try {
        result = await response.json()
      } catch {
        throw new Error('서버 응답을 처리할 수 없습니다. 파일 크기가 너무 크거나 서버에 문제가 있을 수 있습니다.')
      }

      if (!response.ok) {
        // AI 사용량 제한 에러 처리 (Anthropic Rate Limit)
        if (response.status === 429 || result.error === 'AI_RATE_LIMIT') {
          setRateLimitError(true)
          return
        }
        // Tier 일일 제한 초과
        if (result.error === 'TIER_LIMIT_EXCEEDED') {
          setTierLimitError(true)
          await refreshTier()
          return
        }
        throw new Error(result.error || result.message || 'OCR 처리 중 오류가 발생했습니다')
      }

      if (!result.success) {
        throw new Error('OCR 결과를 가져오는데 실패했습니다')
      }

      // 배치 OCR 결과를 세션 스토리지에 저장
      sessionStorage.setItem('ocrBatchResult', JSON.stringify(result.data))

      // 사용량 갱신
      await refreshTier()

      // Preview 페이지로 이동
      router.push('/preview')

    } catch (err) {
      console.error('OCR Batch error:', err)
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader title="검사지 업로드" />

      <div className="container max-w-4xl mx-auto py-10 px-4">

      {/* 사용량 배지 */}
      {!tierLoading && tierData && ocrUsage && (
        <div className="mb-6 flex items-center justify-between p-3 bg-background border rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded">
              {tierData.config.label}
            </span>
            <span className="text-muted-foreground">오늘 AI 분석</span>
          </div>
          <div className="text-sm font-medium">
            {ocrUsage.limit === -1 ? (
              <span className="text-green-600">무제한</span>
            ) : (
              <span className={ocrUsage.remaining <= 0 ? 'text-destructive' : ''}>
                {ocrUsage.remaining}/{ocrUsage.limit} 남음
              </span>
            )}
          </div>
        </div>
      )}

      {/* 안내 배너 */}
      <Card className="mb-6 border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">AI가 날짜와 병원을 자동 분류합니다</p>
              <p className="text-sm text-blue-700 mt-1">
                여러 날짜의 검사지를 올려도 자동으로 날짜별로 분리됩니다.
                분석 후 확인 화면에서 날짜와 병원을 수정할 수 있습니다.
              </p>
              <p className="text-sm text-blue-700 mt-1">
                같은 날짜인데 검사결과가 분리되었다면, 저장 후 검사기록 관리 메뉴에서 병합할 수 있습니다.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>파일 선택</CardTitle>
          <CardDescription>
            검사지를 선택하세요 (최대 {maxFiles}개, 각 10MB 이하)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUploader
            onFilesSelect={handleFilesSelect}
            onFileRemove={handleFileRemove}
            selectedFiles={selectedFiles}
            isProcessing={isProcessing}
            maxFiles={maxFiles}
          />
        </CardContent>
      </Card>

      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">오류 발생</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <Button
          onClick={handleAnalyze}
          disabled={selectedFiles.length === 0 || isProcessing || isLimitReached}
          className="w-full"
          size="lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              AI로 파일 읽는 중... ({selectedFiles.length}개)
            </>
          ) : isLimitReached ? (
            '오늘 분석 한도에 도달했습니다'
          ) : (
            <>
              AI로 파일 읽기
              {selectedFiles.length > 0 && ` (${selectedFiles.length}개)`}
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>

        <p className="text-[11px] text-muted-foreground/70 leading-relaxed text-center">
          본 서비스는 검사 결과를 기록·보관하는 도구이며, 어떠한 의료적 의견이나 진단을 제공하지 않습니다.
          OCR 분석 결과의 정확성 확인은 사용자 본인의 책임이며, 의학적 판단은 반드시 수의사와 상의하세요.
        </p>

        {isProcessing && (
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-center text-muted-foreground">
              이미지를 분석하고 있습니다. 파일 수에 따라 10-60초 정도 소요됩니다...
            </p>
          </div>
        )}

        {isLimitReached && (
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm text-orange-800">
              오늘 AI 분석 {ocrUsage?.limit}회를 모두 사용했습니다. 내일 다시 이용할 수 있습니다.
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="font-medium mb-2">안내</h3>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>검사지 전체가 선명하게 촬영된 이미지를 사용하세요</li>
          <li>여러 날짜가 포함되어 있어도 AI가 자동으로 분리합니다</li>
          <li>분석 후 확인 화면에서 항목을 검수하고 저장합니다</li>
        </ul>
      </div>
      </div>

      {/* AI Rate Limit 에러 모달 */}
      <Dialog open={rateLimitError} onOpenChange={setRateLimitError}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              AI 서비스 일시 제한
            </DialogTitle>
            <DialogDescription className="pt-2">
              AI 서비스 사용량 제한에 도달하였습니다. 잠시 후 다시 시도해주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="pt-4">
            <Button className="w-full" onClick={() => setRateLimitError(false)}>
              확인
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tier 일일 제한 에러 모달 */}
      <Dialog open={tierLimitError} onOpenChange={setTierLimitError}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              일일 분석 한도 초과
            </DialogTitle>
            <DialogDescription className="pt-2">
              오늘 AI 분석 {ocrUsage?.limit}회를 모두 사용했습니다.
              내일 다시 이용할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="pt-4">
            <Button className="w-full" onClick={() => setTierLimitError(false)}>
              확인
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
