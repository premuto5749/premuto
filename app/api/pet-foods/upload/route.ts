import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/with-auth'

export const dynamic = 'force-dynamic'

const BUCKET_NAME = 'pet-food-photos'
const MAX_FILES = 5
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export const POST = withAuth(async (request, { supabase, user }) => {
  try {
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
        { error: `최대 ${MAX_FILES}개 파일만 업로드 가능합니다.` },
        { status: 400 }
      )
    }

    // 파일 검증
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `${file.name} 파일이 10MB 제한을 초과합니다.` },
          { status: 400 }
        )
      }

      // 이미지 타입 체크
      if (!file.type.startsWith('image/')) {
        return NextResponse.json(
          { error: `Invalid file type for ${file.name}. Only image files are supported.` },
          { status: 400 }
        )
      }
    }

    // 파일 업로드 (사용자별 폴더)
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
      const filePath = `uploads/${user.id}/pet-foods/${fileName}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, {
          contentType: file.type || 'image/jpeg',
          upsert: false
        })

      if (uploadError) {
        console.error('Pet food photo upload error:', {
          error: uploadError,
          bucket: BUCKET_NAME,
          filePath,
          userId: user.id,
        })
        // 이미 업로드된 파일들 삭제 시도
        if (uploadedPaths.length > 0) {
          await supabase.storage.from(BUCKET_NAME).remove(uploadedPaths)
        }

        let errorMessage = uploadError.message
        if (uploadError.message.includes('security') || uploadError.message.includes('policy')) {
          errorMessage = `Storage 권한 오류: ${uploadError.message}. Supabase Dashboard에서 '${BUCKET_NAME}' 버킷의 RLS 정책을 확인하세요.`
        } else if (uploadError.message.includes('Bucket not found')) {
          errorMessage = `Storage 버킷 '${BUCKET_NAME}'가 존재하지 않습니다. Supabase Dashboard에서 버킷을 생성하세요.`
        }

        return NextResponse.json(
          { error: `Failed to upload ${file.name}: ${errorMessage}` },
          { status: 500 }
        )
      }

      const storedPath = uploadData?.path
      if (typeof storedPath !== 'string' || storedPath.length === 0) {
        console.error('Upload returned invalid path:', { uploadData, filePath })
        if (uploadedPaths.length > 0) {
          await supabase.storage.from(BUCKET_NAME).remove(uploadedPaths)
        }
        return NextResponse.json(
          { error: `업로드 후 파일 경로를 받지 못했습니다 (${file.name})` },
          { status: 500 }
        )
      }
      uploadedPaths.push(storedPath)
    }

    return NextResponse.json({
      success: true,
      data: {
        urls: uploadedPaths
      }
    })

  } catch (error) {
    console.error('Pet food upload API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
