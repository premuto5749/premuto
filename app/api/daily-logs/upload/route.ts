import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_FILES = 5
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const BUCKET_NAME = 'daily-log-photos'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 인증된 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const formData = await request.formData()

    const files: File[] = []

    // FormData에서 모든 파일 추출 (photo* 또는 files 키 지원)
    for (const [key, value] of Array.from(formData.entries())) {
      if ((key.startsWith('photo') || key === 'files') && value instanceof File) {
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

      // 이미지 타입 체크 (모든 이미지 형식 허용)
      if (!file.type.startsWith('image/')) {
        return NextResponse.json(
          { error: `Invalid file type for ${file.name}. Only image files are supported.` },
          { status: 400 }
        )
      }
    }

    // 파일 업로드 (사용자별 폴더)
    const uploadedUrls: string[] = []
    const timestamp = Date.now()

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const ext = file.name.split('.').pop() || 'jpg'
      const fileName = `${timestamp}_${i}.${ext}`
      const filePath = `uploads/${user.id}/${fileName}`

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
            return `uploads/${user.id}/${parts[parts.length - 1]}`
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
