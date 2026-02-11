import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkCurrentUserIsAdmin } from '@/lib/auth/admin'
import JSZip from 'jszip'
import {
  BUCKET_NAME,
  FOLDER,
  ALLOWED_IMAGE_EXTENSIONS,
  MAX_IMAGE_SIZE,
  getFlyerSettings,
  saveFlyerSettings,
  Flyer,
} from '../shared'

export const dynamic = 'force-dynamic'

const MAX_ZIP_SIZE = 50 * 1024 * 1024 // 50MB
const ALLOWED_ZIP_TYPES = ['application/zip', 'application/x-zip-compressed']

function getContentType(ext: string): string {
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    default:
      return 'application/octet-stream'
  }
}

export async function POST(request: NextRequest) {
  try {
    const { isAdmin } = await checkCurrentUserIsAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
    }

    const formData = await request.formData()
    const zipFile = formData.get('zipFile') as File | null
    const title = (formData.get('title') as string | null)?.trim() || '소중한 우리 가족을 찾습니다'

    if (!zipFile) {
      return NextResponse.json({ error: 'ZIP 파일이 필요합니다' }, { status: 400 })
    }
    if (!ALLOWED_ZIP_TYPES.includes(zipFile.type)) {
      return NextResponse.json({ error: 'ZIP 파일만 업로드할 수 있습니다' }, { status: 400 })
    }
    if (zipFile.size > MAX_ZIP_SIZE) {
      return NextResponse.json({ error: 'ZIP 파일 크기가 50MB를 초과합니다' }, { status: 400 })
    }

    const supabase = await createClient()
    const zipBuffer = await zipFile.arrayBuffer()
    const zip = await JSZip.loadAsync(zipBuffer)

    const newFlyers: Flyer[] = []
    const failed: string[] = []
    const now = new Date().toISOString()
    const timestamp = Date.now()

    for (const [filename, entry] of Object.entries(zip.files)) {
      // 디렉토리, __MACOSX, .DS_Store 제외
      if (entry.dir) continue
      if (filename.startsWith('__MACOSX')) continue
      if (filename.includes('.DS_Store')) continue

      // 이미지 확장자만 처리
      const ext = filename.split('.').pop()?.toLowerCase() || ''
      if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
        failed.push(filename)
        continue
      }

      try {
        const buffer = await entry.async('arraybuffer')

        // 개별 이미지 크기 검증
        if (buffer.byteLength > MAX_IMAGE_SIZE) {
          failed.push(`${filename} (5MB 초과)`)
          continue
        }

        const baseName = filename.split('/').pop() || filename
        const safeName = baseName.replace(/[^a-zA-Z0-9._-]/g, '_')
        const storageName = `${timestamp}_bulk_${safeName}`
        const filePath = `${FOLDER}/${storageName}`
        const contentType = getContentType(ext)

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(filePath, buffer, {
            contentType,
            upsert: true,
            cacheControl: '31536000',
          })

        if (uploadError) {
          console.error(`Bulk upload error for ${filename}:`, uploadError)
          failed.push(filename)
          continue
        }

        const { data: publicUrlData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(uploadData.path)

        newFlyers.push({
          id: crypto.randomUUID(),
          imagePath: uploadData.path,
          imageUrl: publicUrlData.publicUrl,
          title,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        })
      } catch (err) {
        console.error(`Failed to process ${filename}:`, err)
        failed.push(filename)
      }
    }

    if (newFlyers.length === 0) {
      return NextResponse.json(
        { error: '업로드할 수 있는 이미지가 없습니다', failed },
        { status: 400 }
      )
    }

    // JSONB에 일괄 추가
    const settings = await getFlyerSettings(supabase)
    settings.flyers.push(...newFlyers)

    const { error: saveError } = await saveFlyerSettings(supabase, settings)
    if (saveError) {
      console.error('Failed to save bulk flyer settings:', saveError)
      return NextResponse.json({ error: '전단지 저장 실패' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: newFlyers, failed })
  } catch (error) {
    console.error('Lost animals bulk POST error:', error)
    return NextResponse.json({ error: '일괄 업로드 중 오류가 발생했습니다' }, { status: 500 })
  }
}
