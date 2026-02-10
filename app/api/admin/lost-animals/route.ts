import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkCurrentUserIsAdmin } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

const BUCKET_NAME = 'site-assets'
const FOLDER = 'lost-animals'
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

interface Flyer {
  id: string
  imagePath: string
  imageUrl?: string
  title: string
  status: 'active' | 'closed'
  createdAt: string
  updatedAt: string
}

interface FlyerSettings {
  flyers: Flyer[]
}

async function getFlyerSettings(supabase: Awaited<ReturnType<typeof createClient>>): Promise<FlyerSettings> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'lost_animal_flyers')
    .single()

  return data?.value || { flyers: [] }
}

async function saveFlyerSettings(supabase: Awaited<ReturnType<typeof createClient>>, settings: FlyerSettings) {
  return supabase
    .from('app_settings')
    .upsert({
      key: 'lost_animal_flyers',
      value: settings,
      description: '유실 동물 전단지 설정'
    }, { onConflict: 'key' })
}

// POST: 새 전단지 업로드
export async function POST(request: NextRequest) {
  try {
    const { isAdmin } = await checkCurrentUserIsAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
    }

    const supabase = await createClient()
    const formData = await request.formData()

    const file = formData.get('file') as File | null
    const title = formData.get('title') as string | null

    if (!file) {
      return NextResponse.json({ error: '파일이 필요합니다' }, { status: 400 })
    }
    if (!title?.trim()) {
      return NextResponse.json({ error: '제목이 필요합니다' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: '파일 크기가 5MB를 초과합니다' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: '지원하지 않는 파일 형식입니다. PNG, JPEG, WebP, GIF만 허용됩니다.' }, { status: 400 })
    }

    // 파일 확장자
    let ext = 'png'
    if (file.type === 'image/jpeg') ext = 'jpg'
    else if (file.type === 'image/webp') ext = 'webp'
    else if (file.type === 'image/gif') ext = 'gif'

    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const fileName = `${timestamp}_${safeName}.${ext}`
    const filePath = `${FOLDER}/${fileName}`

    // 스토리지 업로드
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        contentType: file.type,
        upsert: true,
        cacheControl: '31536000',
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({ error: `업로드 실패: ${uploadError.message}` }, { status: 500 })
    }

    // Public URL 생성
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(uploadData.path)

    const now = new Date().toISOString()
    const newFlyer: Flyer = {
      id: crypto.randomUUID(),
      imagePath: uploadData.path,
      imageUrl: publicUrlData.publicUrl,
      title: title.trim(),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }

    // JSONB에 추가
    const settings = await getFlyerSettings(supabase)
    settings.flyers.push(newFlyer)

    const { error: saveError } = await saveFlyerSettings(supabase, settings)
    if (saveError) {
      console.error('Failed to save flyer settings:', saveError)
      return NextResponse.json({ error: '전단지 저장 실패' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: newFlyer })
  } catch (error) {
    console.error('Lost animals POST error:', error)
    return NextResponse.json({ error: '업로드 중 오류가 발생했습니다' }, { status: 500 })
  }
}

// PATCH: 활성/종료 토글
export async function PATCH(request: NextRequest) {
  try {
    const { isAdmin } = await checkCurrentUserIsAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
    }

    const body = await request.json()
    const { id, status } = body

    if (!id || !status || !['active', 'closed'].includes(status)) {
      return NextResponse.json({ error: '유효한 ID와 상태가 필요합니다' }, { status: 400 })
    }

    const supabase = await createClient()
    const settings = await getFlyerSettings(supabase)

    const idx = settings.flyers.findIndex(f => f.id === id)
    if (idx === -1) {
      return NextResponse.json({ error: '전단지를 찾을 수 없습니다' }, { status: 404 })
    }

    settings.flyers[idx] = {
      ...settings.flyers[idx],
      status,
      updatedAt: new Date().toISOString(),
    }

    const { error } = await saveFlyerSettings(supabase, settings)
    if (error) {
      return NextResponse.json({ error: '상태 변경 실패' }, { status: 500 })
    }

    // URL 재생성
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(settings.flyers[idx].imagePath)

    return NextResponse.json({
      success: true,
      data: { ...settings.flyers[idx], imageUrl: urlData.publicUrl },
    })
  } catch (error) {
    console.error('Lost animals PATCH error:', error)
    return NextResponse.json({ error: '상태 변경 중 오류가 발생했습니다' }, { status: 500 })
  }
}

// DELETE: 전단지 삭제 (스토리지 + JSONB)
export async function DELETE(request: NextRequest) {
  try {
    const { isAdmin } = await checkCurrentUserIsAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: '전단지 ID가 필요합니다' }, { status: 400 })
    }

    const supabase = await createClient()
    const settings = await getFlyerSettings(supabase)

    const idx = settings.flyers.findIndex(f => f.id === id)
    if (idx === -1) {
      return NextResponse.json({ error: '전단지를 찾을 수 없습니다' }, { status: 404 })
    }

    // 스토리지에서 파일 삭제
    const imagePath = settings.flyers[idx].imagePath
    await supabase.storage.from(BUCKET_NAME).remove([imagePath])

    // JSONB에서 제거
    settings.flyers.splice(idx, 1)
    const { error } = await saveFlyerSettings(supabase, settings)
    if (error) {
      return NextResponse.json({ error: '전단지 삭제 실패' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: '전단지가 삭제되었습니다' })
  } catch (error) {
    console.error('Lost animals DELETE error:', error)
    return NextResponse.json({ error: '삭제 중 오류가 발생했습니다' }, { status: 500 })
  }
}
