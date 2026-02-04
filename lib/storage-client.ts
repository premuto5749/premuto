/**
 * 클라이언트 측 Supabase Storage 업로드 유틸리티
 *
 * Vercel Serverless Function의 4.5MB payload 제한을 우회하기 위해
 * 클라이언트에서 직접 Supabase Storage로 업로드합니다.
 */

import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/image-compressor'

const BUCKET_NAME = 'daily-log-photos'

interface UploadResult {
  success: boolean
  paths: string[]
  errors: string[]
}

/**
 * 클라이언트에서 직접 Supabase Storage로 사진을 업로드합니다.
 * API를 거치지 않으므로 Vercel의 payload 제한을 우회합니다.
 *
 * @param photos 업로드할 사진 파일 배열
 * @returns 업로드된 파일 경로 배열
 */
export async function uploadPhotosDirectly(photos: File[]): Promise<UploadResult> {
  if (photos.length === 0) {
    return { success: true, paths: [], errors: [] }
  }

  const supabase = createClient()

  // 현재 사용자 확인
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return {
      success: false,
      paths: [],
      errors: ['로그인이 필요합니다']
    }
  }

  const uploadedPaths: string[] = []
  const errors: string[] = []
  const timestamp = Date.now()

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i]

    try {
      // 이미지 압축 (큰 파일만)
      const compressedPhoto = await compressImage(photo)

      // 파일 확장자 결정
      let ext = 'jpg'
      if (compressedPhoto.type === 'image/png') ext = 'png'
      else if (compressedPhoto.type === 'image/webp') ext = 'webp'
      else if (compressedPhoto.type === 'image/gif') ext = 'gif'
      else if (compressedPhoto.type === 'image/heic' || compressedPhoto.type === 'image/heif') ext = 'heic'

      const fileName = `${timestamp}_${i}.${ext}`
      const filePath = `uploads/${user.id}/${fileName}`

      console.log('Direct upload:', {
        name: photo.name,
        originalSize: `${(photo.size / 1024 / 1024).toFixed(2)}MB`,
        compressedSize: `${(compressedPhoto.size / 1024 / 1024).toFixed(2)}MB`,
        path: filePath
      })

      const { data, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, compressedPhoto, {
          contentType: compressedPhoto.type || 'image/jpeg',
          upsert: false
        })

      if (uploadError) {
        console.error('Direct upload error:', uploadError)

        // 에러 메시지 개선
        let errorMessage = uploadError.message
        if (uploadError.message.includes('security') || uploadError.message.includes('policy')) {
          errorMessage = `Storage 권한 오류: Supabase Dashboard에서 'daily-log-photos' 버킷의 RLS 정책을 확인하세요.`
        } else if (uploadError.message.includes('Bucket not found')) {
          errorMessage = `Storage 버킷 'daily-log-photos'가 존재하지 않습니다.`
        }

        errors.push(`${photo.name}: ${errorMessage}`)
        continue
      }

      uploadedPaths.push(data.path)
    } catch (err) {
      console.error('Photo processing error:', err)
      errors.push(`${photo.name}: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
    }
  }

  // 일부 성공도 성공으로 처리 (업로드된 파일이 있으면)
  return {
    success: uploadedPaths.length > 0 || errors.length === 0,
    paths: uploadedPaths,
    errors
  }
}

/**
 * 업로드된 사진을 삭제합니다.
 */
export async function deleteUploadedPhotos(paths: string[]): Promise<void> {
  if (paths.length === 0) return

  const supabase = createClient()

  try {
    await supabase.storage.from(BUCKET_NAME).remove(paths)
  } catch (err) {
    console.error('Failed to delete photos:', err)
  }
}
