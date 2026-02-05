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
import { Loader2, ArrowRight, AlertCircle, Zap } from 'lucide-react'

const FileUploader = dynamic(
  () => import('@/components/upload/FileUploader').then(mod => ({ default: mod.FileUploader })),
  { ssr: false, loading: () => <div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div> }
)

// 개선된 이미지 압축 옵션 (인식률 향상)
const compressionOptions = {
  maxSizeMB: 2,              // 500KB → 2MB (인식률 향상)
  maxWidthOrHeight: 3000,    // 2048 → 3000 (더 선명하게)
  initialQuality: 0.92,      // 품질 유지
  useWebWorker: true,
}

// 파일 개수 제한
const MAX_FILES = 5

export default function UploadQuickPage() {
  const router = useRouter()
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rateLimitError, setRateLimitError] = useState(false)

  const handleFilesSelect = (files: File[]) => {
    // 파일 개수 제한
    if (files.length > MAX_FILES) {
      setError(`최대 ${MAX_FILES}개 파일만 업로드 가능합니다. 여러 날짜의 검사는 '일괄 업로드' 메뉴를 이용해주세요.`)
      setSelectedFiles(files.slice(0, MAX_FILES))
      return
    }
    setSelectedFiles(files)
    setError(null)
  }

  const handleFileRemove = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
    setError(null)
  }

  const handleAnalyze = async () => {
    if (selectedFiles.length === 0) return

    setIsProcessing(true)
    setError(null)

    try {
      const formData = new FormData()

      // 이미지 압축 후 FormData에 추가
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i]
        let processedFile = file

        // 이미지 파일만 압축 (PDF는 제외)
        if (file.type.startsWith('image/')) {
          try {
            processedFile = await imageCompression(file, compressionOptions)
            console.log(`Compressed ${file.name}: ${(file.size / 1024).toFixed(1)}KB -> ${(processedFile.size / 1024).toFixed(1)}KB`)
          } catch (compressError) {
            console.warn(`Failed to compress ${file.name}, using original`, compressError)
          }
        }

        formData.append(`file${i}`, processedFile)
      }

      const response = await fetch('/api/ocr-batch', {
        method: 'POST',
        body: formData,
      })

      // 413 에러 처리 (Payload Too Large)
      if (response.status === 413) {
        throw new Error('파일 크기가 너무 큽니다. 파일 개수를 줄이거나 더 작은 이미지를 사용해주세요. (최대 4MB)')
      }

      // JSON 파싱 시도
      let result
      try {
        result = await response.json()
      } catch {
        throw new Error('서버 응답을 처리할 수 없습니다. 파일 크기가 너무 크거나 서버에 문제가 있을 수 있습니다.')
      }

      if (!response.ok) {
        // AI 사용량 제한 에러 처리
        if (response.status === 429 || result.error === 'AI_RATE_LIMIT') {
          setRateLimitError(true)
          return
        }
        throw new Error(result.error || 'OCR 처리 중 오류가 발생했습니다')
      }

      if (!result.success) {
        throw new Error('OCR 결과를 가져오는데 실패했습니다')
      }

      // 배치 OCR 결과를 세션 스토리지에 저장
      sessionStorage.setItem('ocrBatchResult', JSON.stringify(result.data))

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
      <AppHeader title="간편 업로드" />

      <div className="container max-w-4xl mx-auto py-10 px-4">

      {/* 안내 배너 */}
      <Card className="mb-6 border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">단일 검사일 전용</p>
              <p className="text-sm text-blue-700 mt-1">
                같은 날짜의 검사지만 업로드하세요 (예: CBC + Chemistry).
                여러 날짜를 한번에 올리려면 <a href="/upload" className="underline font-medium">일괄 업로드</a>를 이용하세요.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>파일 선택</CardTitle>
          <CardDescription>
            같은 날짜의 검사지를 선택하세요 (최대 {MAX_FILES}개, 각 10MB 이하)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUploader
            onFilesSelect={handleFilesSelect}
            onFileRemove={handleFileRemove}
            selectedFiles={selectedFiles}
            isProcessing={isProcessing}
            maxFiles={MAX_FILES}
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

      <Card>
        <CardHeader>
          <CardTitle>AI 분석</CardTitle>
          <CardDescription>
            Claude AI가 검사지를 분석하여 항목별 결과를 추출합니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              onClick={handleAnalyze}
              disabled={selectedFiles.length === 0 || isProcessing}
              className="flex-1"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  AI 분석 중... ({selectedFiles.length}개 파일)
                </>
              ) : (
                <>
                  {selectedFiles.length > 0
                    ? `${selectedFiles.length}개 파일 분석 시작`
                    : '분석 시작'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>

          {isProcessing && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-sm text-center text-muted-foreground">
                고품질 이미지로 분석 중입니다. 10-30초 정도 소요됩니다...
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="font-medium mb-2">이 모드의 장점</h3>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>고품질 이미지 분석으로 인식률 향상</li>
          <li>파일 수 제한으로 타임아웃 방지</li>
          <li>같은 날짜 검사지 집중 처리</li>
        </ul>
      </div>
      </div>

      {/* AI 사용량 제한 에러 모달 */}
      <Dialog open={rateLimitError} onOpenChange={setRateLimitError}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              AI 사용량 제한
            </DialogTitle>
            <DialogDescription className="pt-2">
              AI 사용량 제한에 도달하였습니다. 잠시 후 다시 시도해주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="pt-4">
            <Button className="w-full" onClick={() => setRateLimitError(false)}>
              확인
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
