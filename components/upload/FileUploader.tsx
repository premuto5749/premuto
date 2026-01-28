'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import Image from 'next/image'
import { Upload, File, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import * as pdfjsLib from 'pdfjs-dist'

// PDF.js worker 설정 - 로컬 파일 사용 (CDN 의존성 제거)
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
}

interface FileWithPreview {
  file: File
  preview: string | null
}

interface FileUploaderProps {
  onFilesSelect: (files: File[]) => void
  onFileRemove: (index: number) => void
  selectedFiles: File[]
  isProcessing?: boolean
}

export function FileUploader({
  onFilesSelect,
  onFileRemove,
  selectedFiles,
  isProcessing = false
}: FileUploaderProps) {
  const [filesWithPreview, setFilesWithPreview] = useState<FileWithPreview[]>([])
  const [isConverting, setIsConverting] = useState(false)

  // PDF를 이미지로 변환하는 함수
  const convertPdfToImage = async (file: File): Promise<File> => {
    // 1. 파일 읽기
    let arrayBuffer: ArrayBuffer
    try {
      arrayBuffer = await file.arrayBuffer()
    } catch (e) {
      console.error('PDF 파일 읽기 실패:', e)
      throw new Error(`PDF 파일을 읽을 수 없습니다: ${file.name}`)
    }

    // 2. PDF 문서 로드
    let pdf: pdfjsLib.PDFDocumentProxy
    try {
      pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    } catch (e) {
      console.error('PDF 파싱 실패:', e)
      throw new Error(`유효하지 않은 PDF 파일입니다: ${file.name}. 파일이 손상되었거나 암호로 보호되어 있을 수 있습니다.`)
    }

    // 3. PDF 페이지 수 확인
    if (pdf.numPages === 0) {
      throw new Error(`PDF 파일에 페이지가 없습니다: ${file.name}`)
    }

    // 4. 첫 페이지 가져오기
    let page: pdfjsLib.PDFPageProxy
    try {
      page = await pdf.getPage(1)
    } catch (e) {
      console.error('PDF 페이지 로드 실패:', e)
      throw new Error(`PDF 첫 페이지를 로드할 수 없습니다: ${file.name}`)
    }

    // 5. Canvas 생성 및 context 확인
    const viewport = page.getViewport({ scale: 2.0 }) // 고해상도
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('Canvas 2D 컨텍스트를 생성할 수 없습니다. 브라우저가 Canvas를 지원하는지 확인하세요.')
    }

    canvas.width = viewport.width
    canvas.height = viewport.height

    // 6. 페이지 렌더링
    try {
      await page.render({
        canvasContext: context,
        viewport: viewport,
        canvas: canvas
      }).promise
    } catch (e) {
      console.error('PDF 렌더링 실패:', e)
      throw new Error(`PDF 페이지 렌더링 실패: ${file.name}`)
    }

    // 7. Canvas를 Blob으로 변환 (타임아웃 포함)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`PDF 이미지 변환 시간 초과: ${file.name}`))
      }, 30000) // 30초 타임아웃

      canvas.toBlob((blob) => {
        clearTimeout(timeout)
        if (blob) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const imageFile = new (File as any)(
            [blob],
            file.name.replace('.pdf', '.png'),
            { type: 'image/png' }
          )
          resolve(imageFile)
        } else {
          reject(new Error(`PDF를 이미지로 변환할 수 없습니다: ${file.name}. 메모리가 부족하거나 파일이 너무 클 수 있습니다.`))
        }
      }, 'image/png', 0.95)
    })
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return

    // 기존 파일과 합쳐서 최대 10개 제한
    if (selectedFiles.length + acceptedFiles.length > 10) {
      alert('최대 10개 파일까지만 업로드할 수 있습니다.')
      return
    }

    try {
      setIsConverting(true)
      const processedFiles: File[] = []

      // 모든 파일 처리 (PDF 변환 포함)
      for (const file of acceptedFiles) {
        let processedFile = file

        // PDF 파일이면 이미지로 변환
        if (file.type === 'application/pdf') {
          console.log(`📄 PDF 파일 감지: ${file.name}, 이미지로 변환 중...`)
          processedFile = await convertPdfToImage(file)
          console.log('✅ PDF → PNG 변환 완료')
        }

        processedFiles.push(processedFile)
      }

      setIsConverting(false)

      // 부모 컴포넌트에 전체 파일 목록 전달
      const allFiles = [...selectedFiles, ...processedFiles]
      onFilesSelect(allFiles)

      // 각 파일의 미리보기 생성
      const newFilesWithPreview = await Promise.all(
        processedFiles.map(async (file) => {
          if (file.type.startsWith('image/')) {
            return new Promise<FileWithPreview>((resolve) => {
              const reader = new FileReader()
              reader.onloadend = () => {
                resolve({
                  file,
                  preview: reader.result as string
                })
              }
              reader.readAsDataURL(file)
            })
          } else {
            return {
              file,
              preview: null
            }
          }
        })
      )

      setFilesWithPreview(prev => [...prev, ...newFilesWithPreview])

    } catch (error) {
      console.error('❌ 파일 처리 실패:', error)
      setIsConverting(false)
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
      alert(`파일 처리에 실패했습니다.\n\n${errorMessage}`)
    }
  }, [selectedFiles, onFilesSelect])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 10,
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: true,
    disabled: isProcessing || isConverting
  })

  const handleRemove = (index: number) => {
    onFileRemove(index)
    setFilesWithPreview(prev => prev.filter((_, i) => i !== index))
  }

  if (selectedFiles.length > 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">
            업로드된 파일 ({selectedFiles.length}/10)
          </p>
          {!isProcessing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                selectedFiles.forEach((_, index) => handleRemove(index))
              }}
            >
              모두 제거
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {selectedFiles.map((file, index) => {
            const fileWithPreview = filesWithPreview.find(f => f.file === file)
            const preview = fileWithPreview?.preview

            return (
              <Card key={`${file.name}-${index}`} className="p-4">
                <div className="flex items-start gap-3">
                  {preview ? (
                    <Image
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      width={80}
                      height={80}
                      className="object-cover rounded-md flex-shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
                      <File className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {file.type}
                    </p>
                  </div>

                  {!isProcessing && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemove(index)}
                      className="flex-shrink-0 h-8 w-8"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>

        {!isProcessing && selectedFiles.length < 10 && (
          <div
            {...getRootProps()}
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors duration-200 border-muted-foreground/25 hover:border-primary hover:bg-primary/5"
          >
            <input {...getInputProps()} />
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">파일 추가하기</p>
            <p className="text-xs text-muted-foreground mt-1">
              최대 {10 - selectedFiles.length}개 더 추가 가능
            </p>
          </div>
        )}
      </div>
    )
  }

  if (isConverting) {
    return (
      <Card className="p-12">
        <div className="flex flex-col items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
          <p className="text-lg font-medium mb-2">PDF를 이미지로 변환 중...</p>
          <p className="text-sm text-muted-foreground">잠시만 기다려주세요</p>
        </div>
      </Card>
    )
  }

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
        transition-colors duration-200
        ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
        ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary hover:bg-primary/5'}
      `}
    >
      <input {...getInputProps()} />
      <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
      {isDragActive ? (
        <p className="text-lg font-medium">파일들을 여기에 놓아주세요</p>
      ) : (
        <>
          <p className="text-lg font-medium mb-2">
            한 번의 검사에 해당하는 모든 문서를 업로드하세요
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            여러 파일을 한 번에 선택하거나 드래그앤드롭할 수 있습니다
          </p>
          <p className="text-xs text-muted-foreground">
            지원 형식: JPG, PNG, PDF (각 파일 최대 10MB, 최대 10개)
          </p>
          <p className="text-xs text-green-600 mt-2">
            ✅ PDF는 자동으로 이미지로 변환됩니다
          </p>
          <p className="text-xs text-blue-600 mt-1">
            💡 예: CBC 결과지 + Chemistry 결과지 + 특수 검사 결과지
          </p>
        </>
      )}
    </div>
  )
}
