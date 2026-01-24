'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Loader2, ArrowRight, AlertCircle } from 'lucide-react'

const FileUploader = dynamic(
  () => import('@/components/upload/FileUploader').then(mod => ({ default: mod.FileUploader })),
  { ssr: false, loading: () => <div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div> }
)

export default function UploadPage() {
  const router = useRouter()
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [estimatedTime, setEstimatedTime] = useState(0)

  const handleFilesSelect = (files: File[]) => {
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
    setProgress(0)

    // 파일당 평균 15초로 예상 (총 예상 시간)
    const estimatedSeconds = selectedFiles.length * 15
    setEstimatedTime(estimatedSeconds)

    // 진행률 시뮬레이션 (실제 API 응답 전까지)
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + (100 / estimatedSeconds)
        // 95%에서 멈추고 실제 완료를 기다림
        return newProgress >= 95 ? 95 : newProgress
      })
      setEstimatedTime(prev => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    try {
      const formData = new FormData()

      // 여러 파일을 FormData에 추가
      selectedFiles.forEach((file, index) => {
        formData.append(`file${index}`, file)
      })

      const response = await fetch('/api/ocr-batch', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'OCR 처리 중 오류가 발생했습니다')
      }

      if (!result.success) {
        throw new Error('OCR 결과를 가져오는데 실패했습니다')
      }

      // 완료 시 100%로 설정
      clearInterval(progressInterval)
      setProgress(100)
      setEstimatedTime(0)

      // 배치 OCR 결과를 세션 스토리지에 저장
      sessionStorage.setItem('ocrBatchResult', JSON.stringify(result.data))

      // 잠깐 대기 후 페이지 이동 (100% 표시를 보여주기 위해)
      setTimeout(() => {
        router.push('/preview')
      }, 500)

    } catch (err) {
      console.error('OCR Batch error:', err)
      clearInterval(progressInterval)
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다')
    } finally {
      clearInterval(progressInterval)
      setIsProcessing(false)
      setProgress(0)
      setEstimatedTime(0)
    }
  }

  return (
    <div className="container max-w-4xl mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">검사지 업로드</h1>
        <p className="text-muted-foreground">
          한 번의 검사에 해당하는 모든 결과지를 업로드하면 AI가 자동으로 분석합니다
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>1단계: 파일 선택</CardTitle>
          <CardDescription>
            여러 검사지를 한 번에 업로드할 수 있습니다 (최대 10개, 각 10MB 이하)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUploader
            onFilesSelect={handleFilesSelect}
            onFileRemove={handleFileRemove}
            selectedFiles={selectedFiles}
            isProcessing={isProcessing}
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
          <CardTitle>2단계: AI 일괄 분석</CardTitle>
          <CardDescription>
            GPT-4o Vision이 모든 검사지를 동시에 분석하여 항목별 결과를 추출합니다
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
            <div className="mt-4 space-y-3">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">
                    {selectedFiles.length}개 파일 분석 중...
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {progress >= 95
                      ? '거의 완료...'
                      : estimatedTime > 0
                        ? `약 ${estimatedTime}초 남음`
                        : '처리 중...'}
                  </p>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-center text-muted-foreground mt-2">
                  GPT-4o가 검사지를 병렬로 분석하고 있습니다
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="font-medium mb-2">💡 팁</h3>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>같은 날짜의 검사 결과지를 모두 한 번에 업로드하세요 (예: CBC + Chemistry + 특수 검사)</li>
          <li>검사지 전체가 선명하게 촬영된 이미지를 사용하세요</li>
          <li>글씨가 흐리거나 잘린 경우 인식 정확도가 낮을 수 있습니다</li>
          <li>분석 후 AI가 자동으로 항목을 매칭하며, 검수 페이지에서 확인 및 수정할 수 있습니다</li>
        </ul>
      </div>
    </div>
  )
}
