import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/with-auth'

export const dynamic = 'force-dynamic'

// GET: 진료 기록 목록 조회
export const GET = withAuth(async (request, { supabase, user }) => {
  const { searchParams } = new URL(request.url)
  const petId = searchParams.get('pet_id')
  const date = searchParams.get('date')

  if (!petId) {
    return NextResponse.json({ error: 'pet_id가 필요합니다' }, { status: 400 })
  }

  let query = supabase
    .from('vet_visits')
    .select('*')
    .eq('user_id', user.id)
    .eq('pet_id', petId)
    .is('deleted_at', null)
    .order('visit_date', { ascending: false })

  if (date) {
    query = query.eq('visit_date', date)
  }

  const { data, error } = await query

  if (error) {
    console.error('[VetVisit] GET error:', error)
    return NextResponse.json({ error: '진료 기록 조회에 실패했습니다' }, { status: 500 })
  }

  // Generate signed URLs for audio files
  if (data && data.length > 0) {
    const pathsToSign = data
      .filter(v => v.audio_file_path)
      .map(v => v.audio_file_path as string)

    if (pathsToSign.length > 0) {
      const { data: signedUrls } = await supabase.storage
        .from('vet-recordings')
        .createSignedUrls(pathsToSign, 7 * 24 * 60 * 60) // 7 days

      if (signedUrls) {
        const urlMap = new Map(signedUrls.map(s => [s.path, s.signedUrl]))
        for (const visit of data) {
          if (visit.audio_file_path) {
            visit.audio_signed_url = urlMap.get(visit.audio_file_path) || null
          }
        }
      }
    }
  }

  return NextResponse.json({ data })
})

// POST: 새 진료 기록 저장 (검수 후)
export const POST = withAuth(async (request, { supabase, user }) => {
  try {
    const body = await request.json()
    const {
      pet_id, visit_date, hospital_name, vet_name,
      diagnosis, prescriptions, procedures,
      next_visit_date, vet_instructions, cost,
      transcript, audio_file_path,
    } = body

    if (!pet_id || !visit_date) {
      return NextResponse.json(
        { error: 'pet_id와 visit_date는 필수입니다' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('vet_visits')
      .insert({
        user_id: user.id,
        pet_id,
        visit_date,
        hospital_name: hospital_name || null,
        vet_name: vet_name || null,
        diagnosis: diagnosis || [],
        prescriptions: prescriptions || [],
        procedures: procedures || null,
        next_visit_date: next_visit_date || null,
        vet_instructions: vet_instructions || null,
        cost: cost != null ? Number(cost) : null,
        transcript: transcript || null,
        audio_file_path: audio_file_path || null,
      })
      .select()
      .single()

    if (error) {
      console.error('[VetVisit] POST error:', error)
      return NextResponse.json({ error: '진료 기록 저장에 실패했습니다' }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[VetVisit] POST unexpected error:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
})

// PATCH: 진료 기록 수정
export const PATCH = withAuth(async (request, { supabase, user }) => {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 })
  }

  try {
    const body = await request.json()
    const allowedFields = [
      'visit_date', 'hospital_name', 'vet_name',
      'diagnosis', 'prescriptions', 'procedures',
      'next_visit_date', 'vet_instructions', 'cost',
    ]

    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '수정할 필드가 없습니다' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('vet_visits')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .select()
      .single()

    if (error) {
      console.error('[VetVisit] PATCH error:', error)
      return NextResponse.json({ error: '진료 기록 수정에 실패했습니다' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[VetVisit] PATCH unexpected error:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
})

// DELETE: soft delete
export const DELETE = withAuth(async (request, { supabase, user }) => {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 })
  }

  const { error } = await supabase
    .from('vet_visits')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .is('deleted_at', null)

  if (error) {
    console.error('[VetVisit] DELETE error:', error)
    return NextResponse.json({ error: '진료 기록 삭제에 실패했습니다' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
})
