import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkCurrentUserIsAdmin } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

const BUCKET_NAME = 'site-assets'

// 허용되는 이미지 타입
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/x-icon', 'image/svg+xml']

// 에셋 타입별 설정
const ASSET_CONFIG: Record<string, { folder: string; maxSize: number }> = {
  favicon: { folder: 'favicon', maxSize: 1 * 1024 * 1024 }, // 1MB
  logo: { folder: 'logo', maxSize: 2 * 1024 * 1024 }, // 2MB (로그인 페이지용 정방형)
  headerLogo: { folder: 'header-logo', maxSize: 2 * 1024 * 1024 }, // 2MB (헤더 메뉴용 가로형)
  loginBgImage: { folder: 'login-bg', maxSize: 5 * 1024 * 1024 }, // 5MB (로그인 배경 이미지)
  ogImage: { folder: 'og', maxSize: 5 * 1024 * 1024 }, // 5MB
  shareLogo: { folder: 'share-logo', maxSize: 2 * 1024 * 1024 }, // 2MB (건강 기록 공유 로고)
  popupImage: { folder: 'popup-images', maxSize: 2 * 1024 * 1024 }, // 2MB (공지 팝업 본문 이미지)
}

// 여러 이미지가 공존하는 에셋 타입 (기존 파일 삭제 안 함)
const MULTI_FILE_TYPES = new Set(['popupImage'])

export async function POST(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const { isAdmin } = await checkCurrentUserIsAdmin()
    if (!isAdmin) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다' },
        { status: 403 }
      )
    }

    const supabase = await createClient()
    const formData = await request.formData()

    const file = formData.get('file') as File | null
    const assetType = formData.get('assetType') as string | null

    if (!file) {
      return NextResponse.json(
        { error: '파일이 필요합니다' },
        { status: 400 }
      )
    }

    if (!assetType || !ASSET_CONFIG[assetType]) {
      return NextResponse.json(
        { error: '유효한 에셋 타입이 필요합니다 (favicon, logo, headerLogo, ogImage)' },
        { status: 400 }
      )
    }

    const config = ASSET_CONFIG[assetType]

    // 파일 크기 검증
    if (file.size > config.maxSize) {
      return NextResponse.json(
        { error: `파일 크기가 ${config.maxSize / 1024 / 1024}MB를 초과합니다` },
        { status: 400 }
      )
    }

    // 파일 타입 검증
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: '지원하지 않는 파일 형식입니다. PNG, JPEG, WebP, GIF, ICO, SVG만 허용됩니다.' },
        { status: 400 }
      )
    }

    // 파일 확장자 결정
    let ext = 'png'
    if (file.type === 'image/jpeg') ext = 'jpg'
    else if (file.type === 'image/webp') ext = 'webp'
    else if (file.type === 'image/gif') ext = 'gif'
    else if (file.type === 'image/x-icon') ext = 'ico'
    else if (file.type === 'image/svg+xml') ext = 'svg'

    // 파일명: 타입_타임스탬프.확장자
    const timestamp = Date.now()
    const fileName = `${assetType}_${timestamp}.${ext}`
    const filePath = `${config.folder}/${fileName}`

    console.log('Uploading site asset:', { assetType, fileName, size: file.size, type: file.type })

    // 기존 파일 삭제 (같은 폴더의 이전 파일들) - 여러 이미지가 공존하는 타입은 건너뜀
    if (!MULTI_FILE_TYPES.has(assetType)) {
      const { data: existingFiles } = await supabase.storage
        .from(BUCKET_NAME)
        .list(config.folder)

      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles
          .filter(f => f.name.startsWith(assetType))
          .map(f => `${config.folder}/${f.name}`)

        if (filesToDelete.length > 0) {
          await supabase.storage.from(BUCKET_NAME).remove(filesToDelete)
          console.log('Deleted old files:', filesToDelete)
        }
      }
    }

    // 새 파일 업로드
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        contentType: file.type,
        upsert: true,
        cacheControl: '31536000' // 1년 캐시
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)

      let errorMessage = uploadError.message
      if (uploadError.message.includes('Bucket not found')) {
        errorMessage = `Storage 버킷 '${BUCKET_NAME}'이 존재하지 않습니다. Supabase Dashboard에서 버킷을 생성하세요.`
      }

      return NextResponse.json(
        { error: `업로드 실패: ${errorMessage}` },
        { status: 500 }
      )
    }

    // Public URL 생성
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(uploadData.path)

    console.log('✅ Site asset uploaded:', { path: uploadData.path, url: publicUrlData.publicUrl })

    return NextResponse.json({
      success: true,
      data: {
        path: uploadData.path,
        url: publicUrlData.publicUrl,
        assetType
      }
    })

  } catch (error) {
    console.error('Site asset upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '업로드 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

// DELETE: 에셋 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { isAdmin } = await checkCurrentUserIsAdmin()
    if (!isAdmin) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다' },
        { status: 403 }
      )
    }

    const { assetType } = await request.json()

    if (!assetType || !ASSET_CONFIG[assetType]) {
      return NextResponse.json(
        { error: '유효한 에셋 타입이 필요합니다' },
        { status: 400 }
      )
    }

    const config = ASSET_CONFIG[assetType]
    const supabase = await createClient()

    // 해당 폴더의 파일들 삭제
    const { data: existingFiles } = await supabase.storage
      .from(BUCKET_NAME)
      .list(config.folder)

    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles
        .filter(f => f.name.startsWith(assetType))
        .map(f => `${config.folder}/${f.name}`)

      if (filesToDelete.length > 0) {
        await supabase.storage.from(BUCKET_NAME).remove(filesToDelete)
      }
    }

    return NextResponse.json({
      success: true,
      message: `${assetType} 이미지가 삭제되었습니다`
    })

  } catch (error) {
    console.error('Site asset delete error:', error)
    return NextResponse.json(
      { error: '삭제 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
