'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileUploader } from '@/components/upload/FileUploader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ArrowRight, AlertCircle } from 'lucide-react'
import type { OcrResponse } from '@/types'

export default function UploadPage() {
  const router = useRouter()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
    setError(null)
  }

  const handleFileRemove = () => {
    setSelectedFile(null)
    setError(null)
  }

  const handleAnalyze = async () => {
    if (!selectedFile) return

    setIsProcessing(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch('/api/ocr', {
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

      // OCR 결과를 세션 스토리지에 저장
      const ocrData: OcrResponse = result.data
      sessionStorage.setItem('ocrResult', JSON.stringify(ocrData))

      // Staging 페이지로 이동
      router.push('/staging')

    } catch (err) {
      console.error('OCR error:', err)
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="container max-w-4xl mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">검사지 업로드</h1>
        <p className="text-muted-foreground">
          혈액검사 결과지를 업로드하면 AI가 자동으로 분석합니다
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>1단계: 파일 선택</CardTitle>
          <CardDescription>
            JPG, PNG 또는 PDF 형식의 검사지를 업로드하세요 (최대 10MB)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUploader
            onFileSelect={handleFileSelect}
            onFileRemove={handleFileRemove}
            selectedFile={selectedFile}
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
          <CardTitle>2단계: AI 분석</CardTitle>
          <CardDescription>
            GPT-4o Vision이 검사지를 분석하여 항목별 결과를 추출합니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              onClick={handleAnalyze}
              disabled={!selectedFile || isProcessing}
              className="flex-1"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  AI 분석 중...
                </>
              ) : (
                <>
                  분석 시작
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
          
          {isProcessing && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-sm text-center text-muted-foreground">
                검사지를 분석하고 있습니다. 약 10-30초 정도 소요됩니다...
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="font-medium mb-2">💡 팁</h3>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>검사지 전체가 선명하게 촬영된 이미지를 사용하세요</li>
          <li>글씨가 흐리거나 잘린 경우 인식 정확도가 낮을 수 있습니다</li>
          <li>분석 후 검수 페이지에서 결과를 확인하고 수정할 수 있습니다</li>
        </ul>
      </div>
    </div>
  )
}
