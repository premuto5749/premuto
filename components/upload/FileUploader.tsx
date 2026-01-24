'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import Image from 'next/image'
import { Upload, File, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import * as pdfjsLib from 'pdfjs-dist'

// PDF.js worker 설정
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
}

interface FileUploaderProps {
  onFileSelect: (file: File) => void
  onFileRemove: () => void
  selectedFile: File | null
  isProcessing?: boolean
}

export function FileUploader({
  onFileSelect,
  onFileRemove,
  selectedFile,
  isProcessing = false
}: FileUploaderProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [isConverting, setIsConverting] = useState(false)

  // PDF를 이미지로 변환하는 함수
  const convertPdfToImage = async (file: File): Promise<File> => {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const page = await pdf.getPage(1) // 첫 페이지만 사용

    const viewport = page.getViewport({ scale: 2.0 }) // 고해상도
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')!

    canvas.width = viewport.width
    canvas.height = viewport.height

    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvas: canvas
    }).promise

    // Canvas를 Blob으로 변환
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const imageFile = new (File as any)(
            [blob],
            file.name.replace('.pdf', '.png'),
            { type: 'image/png' }
          )
          resolve(imageFile)
        }
      }, 'image/png', 0.95)
    })
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    try {
      let processedFile = file

      // PDF 파일이면 이미지로 변환
      if (file.type === 'application/pdf') {
        setIsConverting(true)
        console.log('📄 PDF 파일 감지, 이미지로 변환 중...')
        processedFile = await convertPdfToImage(file)
        console.log('✅ PDF → PNG 변환 완료')
        setIsConverting(false)
      }

      onFileSelect(processedFile)

      // 이미지 미리보기 생성
      if (processedFile.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onloadend = () => {
          setPreview(reader.result as string)
        }
        reader.readAsDataURL(processedFile)
      } else {
        setPreview(null)
      }
    } catch (error) {
      console.error('❌ PDF 변환 실패:', error)
      setIsConverting(false)
      alert('PDF 변환에 실패했습니다. 다른 파일을 시도해주세요.')
    }
  }, [onFileSelect])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: isProcessing || isConverting
  })

  const handleRemove = () => {
    onFileRemove()
    setPreview(null)
  }

  if (selectedFile) {
    return (
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4 flex-1">
            {preview ? (
              <Image
                src={preview}
                alt="Preview"
                width={128}
                height={128}
                className="object-cover rounded-md"
              />
            ) : (
              <div className="w-32 h-32 bg-muted rounded-md flex items-center justify-center">
                <File className="w-12 h-12 text-muted-foreground" />
              </div>
            )}
            <div>
              <p className="font-medium">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedFile.type}
              </p>
            </div>
          </div>
          {!isProcessing && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRemove}
              className="flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </Card>
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
        <p className="text-lg font-medium">파일을 여기에 놓아주세요</p>
      ) : (
        <>
          <p className="text-lg font-medium mb-2">
            검사지 이미지 또는 PDF를 업로드하세요
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            클릭하거나 드래그앤드롭으로 파일을 선택할 수 있습니다
          </p>
          <p className="text-xs text-muted-foreground">
            지원 형식: JPG, PNG, PDF (최대 10MB)
          </p>
          <p className="text-xs text-green-600 mt-2">
            ✅ PDF는 자동으로 이미지로 변환됩니다
          </p>
        </>
      )}
    </div>
  )
}
