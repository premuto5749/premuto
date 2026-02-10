import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkCurrentUserIsAdmin } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

interface PopupAnnouncement {
  id: string
  enabled: boolean
  title: string
  content: string
  startDate: string
  endDate: string
  priority: number
  createdAt: string
  updatedAt: string
}

interface PopupSettings {
  announcements: PopupAnnouncement[]
}

async function getPopupSettings(supabase: Awaited<ReturnType<typeof createClient>>): Promise<PopupSettings> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'popup_settings')
    .single()

  return data?.value || { announcements: [] }
}

async function savePopupSettings(supabase: Awaited<ReturnType<typeof createClient>>, settings: PopupSettings) {
  return supabase
    .from('app_settings')
    .upsert({
      key: 'popup_settings',
      value: settings,
      description: '팝업 공지 설정'
    }, { onConflict: 'key' })
}

// GET: 모든 공지 목록 반환 (비활성, 기간 외 포함)
export async function GET() {
  try {
    const { isAdmin } = await checkCurrentUserIsAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
    }

    const supabase = await createClient()
    const settings = await getPopupSettings(supabase)

    return NextResponse.json({ success: true, data: settings.announcements })
  } catch (error) {
    console.error('Admin popup settings GET error:', error)
    return NextResponse.json({ error: '공지 목록 조회 실패' }, { status: 500 })
  }
}

// POST: 새 공지 추가
export async function POST(request: NextRequest) {
  try {
    const { isAdmin } = await checkCurrentUserIsAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
    }

    const body = await request.json()

    if (!body.title?.trim()) {
      return NextResponse.json({ error: '제목은 필수입니다' }, { status: 400 })
    }
    if (!body.startDate || !body.endDate) {
      return NextResponse.json({ error: '시작일과 종료일은 필수입니다' }, { status: 400 })
    }
    if (body.startDate > body.endDate) {
      return NextResponse.json({ error: '종료일은 시작일 이후여야 합니다' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const newAnnouncement: PopupAnnouncement = {
      id: crypto.randomUUID(),
      enabled: body.enabled ?? true,
      title: body.title.trim(),
      content: body.content || '',
      startDate: body.startDate,
      endDate: body.endDate,
      priority: body.priority ?? 0,
      createdAt: now,
      updatedAt: now,
    }

    const supabase = await createClient()
    const settings = await getPopupSettings(supabase)
    settings.announcements.push(newAnnouncement)

    const { error } = await savePopupSettings(supabase, settings)
    if (error) {
      console.error('Failed to save popup settings:', error)
      return NextResponse.json({ error: '공지 저장 실패' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: newAnnouncement })
  } catch (error) {
    console.error('Admin popup settings POST error:', error)
    return NextResponse.json({ error: '공지 추가 실패' }, { status: 500 })
  }
}

// PUT: 기존 공지 수정
export async function PUT(request: NextRequest) {
  try {
    const { isAdmin } = await checkCurrentUserIsAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
    }

    const body = await request.json()

    if (!body.id) {
      return NextResponse.json({ error: '공지 ID는 필수입니다' }, { status: 400 })
    }
    if (body.title !== undefined && !body.title.trim()) {
      return NextResponse.json({ error: '제목은 비어있을 수 없습니다' }, { status: 400 })
    }
    if (body.startDate && body.endDate && body.startDate > body.endDate) {
      return NextResponse.json({ error: '종료일은 시작일 이후여야 합니다' }, { status: 400 })
    }

    const supabase = await createClient()
    const settings = await getPopupSettings(supabase)

    const idx = settings.announcements.findIndex(a => a.id === body.id)
    if (idx === -1) {
      return NextResponse.json({ error: '공지를 찾을 수 없습니다' }, { status: 404 })
    }

    const existing = settings.announcements[idx]
    settings.announcements[idx] = {
      ...existing,
      enabled: body.enabled ?? existing.enabled,
      title: body.title?.trim() ?? existing.title,
      content: body.content ?? existing.content,
      startDate: body.startDate ?? existing.startDate,
      endDate: body.endDate ?? existing.endDate,
      priority: body.priority ?? existing.priority,
      updatedAt: new Date().toISOString(),
    }

    const { error } = await savePopupSettings(supabase, settings)
    if (error) {
      console.error('Failed to save popup settings:', error)
      return NextResponse.json({ error: '공지 수정 실패' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: settings.announcements[idx] })
  } catch (error) {
    console.error('Admin popup settings PUT error:', error)
    return NextResponse.json({ error: '공지 수정 실패' }, { status: 500 })
  }
}

// DELETE: 공지 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { isAdmin } = await checkCurrentUserIsAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: '공지 ID는 필수입니다' }, { status: 400 })
    }

    const supabase = await createClient()
    const settings = await getPopupSettings(supabase)

    const idx = settings.announcements.findIndex(a => a.id === id)
    if (idx === -1) {
      return NextResponse.json({ error: '공지를 찾을 수 없습니다' }, { status: 404 })
    }

    settings.announcements.splice(idx, 1)

    const { error } = await savePopupSettings(supabase, settings)
    if (error) {
      console.error('Failed to save popup settings:', error)
      return NextResponse.json({ error: '공지 삭제 실패' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: '공지가 삭제되었습니다' })
  } catch (error) {
    console.error('Admin popup settings DELETE error:', error)
    return NextResponse.json({ error: '공지 삭제 실패' }, { status: 500 })
  }
}
