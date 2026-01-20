'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, File, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

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

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file) {
      onFileSelect(file)
      
      // 이미지 미리보기 생성
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onloadend = () => {
          setPreview(reader.result as string)
        }
        reader.readAsDataURL(file)
      } else {
        setPreview(null)
      }
    }
  }, [onFileSelect])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: isProcessing
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
              <img 
                src={preview} 
                alt="Preview" 
                className="w-32 h-32 object-cover rounded-md"
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
            검사지 이미지를 업로드하세요
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            클릭하거나 드래그앤드롭으로 파일을 선택할 수 있습니다
          </p>
          <p className="text-xs text-muted-foreground">
            지원 형식: JPG, PNG (최대 10MB)
          </p>
          <p className="text-xs text-amber-600 mt-2">
            💡 PDF는 이미지로 변환 후 업로드해주세요
          </p>
        </>
      )}
    </div>
  )
}
