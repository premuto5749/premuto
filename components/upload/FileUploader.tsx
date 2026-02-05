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
}

export function FileUploader({
  onFilesSelect,
  onFileRemove,
  selectedFiles,
  isProcessing = false
}: FileUploaderProps) {
  const [filesWithPreview, setFilesWithPreview] = useState<FileWithPreview[]>([])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return

    // 기존 파일과 합쳐서 최대 10개 제한
    if (selectedFiles.length + acceptedFiles.length > 10) {
      alert('최대 10개 파일까지만 업로드할 수 있습니다.')
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
  }, [selectedFiles, onFilesSelect])

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 10,
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: true,
    disabled: isProcessing,
    noClick: false,
    noKeyboard: false,
    noDrag: false,
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

  return (
    <div className="space-y-4">
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
            <p className="text-xs text-blue-600 mt-2">
              💡 예: CBC 결과지 + Chemistry 결과지 + 특수 검사 결과지
            </p>
          </>
        )}
      </div>

      {/* 모바일 대체 버튼 */}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={open}
        disabled={isProcessing}
      >
        <Upload className="w-4 h-4 mr-2" />
        파일 선택하기
      </Button>
    </div>
  )
}
