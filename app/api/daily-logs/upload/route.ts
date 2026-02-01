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
    // 파일 경로만 저장 (Signed URL은 조회 시 생성)
    const uploadedPaths: string[] = []
    const timestamp = Date.now()

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      // 파일 확장자 결정 (MIME 타입 기반 우선, 파일명 폴백)
      let ext = 'jpg'
      if (file.type === 'image/png') ext = 'png'
      else if (file.type === 'image/webp') ext = 'webp'
      else if (file.type === 'image/gif') ext = 'gif'
      else if (file.type === 'image/heic' || file.type === 'image/heif') ext = 'heic'
      else if (file.name && file.name.includes('.')) {
        const nameParts = file.name.split('.')
        ext = nameParts[nameParts.length - 1].toLowerCase()
      }

      const fileName = `${timestamp}_${i}.${ext}`
      const filePath = `uploads/${user.id}/${fileName}`

      console.log('Uploading file:', { name: file.name, type: file.type, size: file.size, path: filePath })

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, {
          contentType: file.type || 'image/jpeg',
          upsert: false
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        // 이미 업로드된 파일들 삭제 시도
        if (uploadedPaths.length > 0) {
          await supabase.storage.from(BUCKET_NAME).remove(uploadedPaths)
        }
        return NextResponse.json(
          { error: `Failed to upload ${file.name}: ${uploadError.message}` },
          { status: 500 }
        )
      }

      // 파일 경로만 저장 (Signed URL은 GET /api/daily-logs에서 생성)
      uploadedPaths.push(uploadData.path)
    }

    return NextResponse.json({
      success: true,
      data: {
        urls: uploadedPaths  // 실제로는 경로지만 기존 인터페이스 유지
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
