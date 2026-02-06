'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import Image from 'next/image'
import { Upload, File, X, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface FileWithPreview {
  file: File
  preview: string | null
}

interface FileUploaderProps {
  onFilesSelect: (files: File[]) => void
  onFileRemove: (index: number) => void
  selectedFiles: File[]
  isProcessing?: boolean
  maxFiles?: number
  maxSizeMB?: number
  onError?: (message: string) => void
}

export function FileUploader({
  onFilesSelect,
  onFileRemove,
  selectedFiles,
  isProcessing = false,
  maxFiles = 10,
  maxSizeMB = 10,
  onError,
}: FileUploaderProps) {
  const [filesWithPreview, setFilesWithPreview] = useState<FileWithPreview[]>([])
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null)

  const showError = useCallback((msg: string) => {
    setRejectionMessage(msg)
    if (onError) onError(msg)
    setTimeout(() => setRejectionMessage(null), 5000)
  }, [onError])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return
    setRejectionMessage(null)

    // 기존 파일과 합쳐서 최대 개수 제한
    if (selectedFiles.length + acceptedFiles.length > maxFiles) {
      showError(`최대 ${maxFiles}개 파일까지만 업로드할 수 있습니다. (현재 ${selectedFiles.length}개)`)
      return
    }

    // PDF는 변환 없이 그대로 전달 (서버에서 GPT-4o가 직접 처리)
    const allFiles = [...selectedFiles, ...acceptedFiles]
    onFilesSelect(allFiles)

    // 각 파일의 미리보기 생성 (이미지만)
    const newFilesWithPreview = await Promise.all(
      acceptedFiles.map(async (file) => {
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
  }, [selectedFiles, onFilesSelect, maxFiles, showError])

  const onDropRejected = useCallback((rejections: readonly { file: File; errors: readonly { code: string }[] }[]) => {
    const reasons: string[] = []
    let tooManyShown = false
    for (const rejection of rejections) {
      for (const err of rejection.errors) {
        if (err.code === 'file-too-large') {
          reasons.push(`${rejection.file.name}: 파일 크기 초과 (최대 ${maxSizeMB}MB)`)
        } else if (err.code === 'file-invalid-type') {
          reasons.push(`${rejection.file.name}: 지원하지 않는 형식`)
        } else if (err.code === 'too-many-files' && !tooManyShown) {
          reasons.push(`최대 ${maxFiles}개 파일까지만 업로드 가능합니다.`)
          tooManyShown = true
        }
      }
    }
    if (reasons.length > 0) {
      showError(reasons.join('\n'))
    }
  }, [maxFiles, maxSizeMB, showError])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/pdf': ['.pdf']
    },
    maxFiles: maxFiles,
    maxSize: maxSizeMB * 1024 * 1024,
    multiple: true,
    disabled: isProcessing
  })

  const handleRemove = (index: number) => {
    onFileRemove(index)
    setFilesWithPreview(prev => prev.filter((_, i) => i !== index))
  }

  const errorBanner = rejectionMessage && (
    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
      <p className="text-sm text-destructive whitespace-pre-line">{rejectionMessage}</p>
    </div>
  )

  if (selectedFiles.length > 0) {
    return (
      <div className="space-y-4">
        {errorBanner}
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">
            업로드된 파일 ({selectedFiles.length}/{maxFiles})
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
            const isPdf = file.type === 'application/pdf'

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
                      {isPdf ? (
                        <FileText className="w-8 h-8 text-red-500" />
                      ) : (
                        <File className="w-8 h-8 text-muted-foreground" />
                      )}
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
                      {isPdf ? 'PDF 문서' : file.type}
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

        {!isProcessing && selectedFiles.length < maxFiles && (
          <div
            {...getRootProps()}
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors duration-200 border-muted-foreground/25 hover:border-primary hover:bg-primary/5"
          >
            <input {...getInputProps()} />
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">파일 추가하기</p>
            <p className="text-xs text-muted-foreground mt-1">
              최대 {maxFiles - selectedFiles.length}개 더 추가 가능
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {errorBanner}
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
              지원 형식: JPG, PNG, PDF | 최대 {maxFiles}개 | 이미지는 자동 압축
            </p>
          </>
        )}
      </div>
    </div>
  )
}
