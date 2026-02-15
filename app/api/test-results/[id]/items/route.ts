import { createClient } from '@/lib/supabase/server'
import { resolveStandardItems } from '@/lib/api/item-resolver'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// POST: 검사 기록에 새 항목 추가
// [id]는 test_records.id (record_id)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: recordId } = await params
    const supabase = await createClient()

    // 사용자 인증 확인
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // 레코드 존재 확인
    const { data: record, error: recordError } = await supabase
      .from('test_records')
      .select('id')
      .eq('id', recordId)
      .single()

    if (recordError || !record) {
      return NextResponse.json(
        { error: '검사 기록을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { standard_item_id, value, unit, ref_min, ref_max, ref_text, status } = body

    if (!standard_item_id) {
      return NextResponse.json(
        { error: '검사 항목 ID가 필요합니다' },
        { status: 400 }
      )
    }

    // 중복 검사 항목 확인
    const { data: existing } = await supabase
      .from('test_results')
      .select('id')
      .eq('record_id', recordId)
      .eq('standard_item_id', standard_item_id)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: '이미 동일한 검사 항목이 존재합니다' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('test_results')
      .insert({
        record_id: recordId,
        standard_item_id,
        value: value ?? null,
        unit: unit || null,
        ref_min: ref_min ?? null,
        ref_max: ref_max ?? null,
        ref_text: ref_text || null,
        status: status || 'Unknown'
      })
      .select('*')
      .single()

    if (error) {
      console.error('Failed to add test result:', error)
      return NextResponse.json(
        { error: '검사 결과 추가에 실패했습니다', details: error.message },
        { status: 500 }
      )
    }

    // 항목 정보 resolve (마스터 + 유저 커스텀 양쪽)
    const resolvedMap = await resolveStandardItems(
      [standard_item_id], user.id, supabase
    )
    const enrichedData = {
      ...data,
      standard_items_master: resolvedMap.get(standard_item_id) ?? null,
    }

    return NextResponse.json({
      success: true,
      data: enrichedData
    })

  } catch (error) {
    console.error('Add test result error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
