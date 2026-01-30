import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_FILES = 5
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const BUCKET_NAME = 'daily-log-photos'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const formData = await request.formData()

    const files: File[] = []

    // FormData에서 모든 파일 추출
    for (const [key, value] of Array.from(formData.entries())) {
      if (key.startsWith('photo') && value instanceof File) {
        files.push(value)
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files uploaded' },
        { status: 400 }
      )
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FILES} files allowed` },
        { status: 400 }
      )
    }

    // 파일 검증
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File ${file.name} exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` },
          { status: 400 }
        )
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `Invalid file type for ${file.name}. Only JPG, PNG, WebP are supported.` },
          { status: 400 }
        )
      }
    }

    // 파일 업로드
    const uploadedUrls: string[] = []
    const timestamp = Date.now()

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const ext = file.name.split('.').pop() || 'jpg'
      const fileName = `${timestamp}_${i}.${ext}`
      const filePath = `uploads/${fileName}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        // 이미 업로드된 파일들 삭제 시도
        if (uploadedUrls.length > 0) {
          const pathsToDelete = uploadedUrls.map(url => {
            const parts = url.split('/')
            return `uploads/${parts[parts.length - 1]}`
          })
          await supabase.storage.from(BUCKET_NAME).remove(pathsToDelete)
        }
        return NextResponse.json(
          { error: `Failed to upload ${file.name}: ${uploadError.message}` },
          { status: 500 }
        )
      }

      // Public URL 생성
      const { data: publicUrl } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(uploadData.path)

      uploadedUrls.push(publicUrl.publicUrl)
    }

    return NextResponse.json({
      success: true,
      data: {
        urls: uploadedUrls
      }
    })

  } catch (error) {
    console.error('Upload API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
