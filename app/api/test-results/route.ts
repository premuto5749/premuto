import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { StagingItem } from '@/types'

interface SaveTestResultRequest {
  test_date: string
  hospital_name?: string
  machine_type?: string
  pet_id?: string
  items: StagingItem[]
}

export async function POST(request: NextRequest) {
  try {
    const body: SaveTestResultRequest = await request.json()
    const { test_date, hospital_name, machine_type, pet_id, items } = body

    // 입력 검증
    if (!test_date) {
      return NextResponse.json(
        { error: '검사 날짜는 필수입니다' },
        { status: 400 }
      )
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: '검사 결과 항목이 없습니다' },
        { status: 400 }
      )
    }

    // 모든 항목이 매핑되었는지 확인
    const unmappedItems = items.filter(item => !item.standard_item_id)
    if (unmappedItems.length > 0) {
      return NextResponse.json(
        { error: `${unmappedItems.length}개 항목이 표준 항목으로 매핑되지 않았습니다` },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // pet_id가 없으면 기본 펫 조회
    let finalPetId = pet_id
    if (!finalPetId) {
      const { data: defaultPet } = await supabase
        .from('pets')
        .select('id')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: true })
        .limit(1)
        .single()
      finalPetId = defaultPet?.id
    }

    // 1. test_records 테이블에 헤더 정보 삽입
    const { data: recordData, error: recordError } = await supabase
      .from('test_records')
      .insert({
        test_date,
        hospital_name: hospital_name || null,
        machine_type: machine_type || null,
        user_id: user.id,
        pet_id: finalPetId || null
      })
      .select('id')
      .single()

    if (recordError || !recordData) {
      console.error('Failed to insert test record:', recordError)
      return NextResponse.json(
        { error: '검사 기록 저장에 실패했습니다', details: recordError?.message },
        { status: 500 }
      )
    }

    const recordId = recordData.id

    // 2. test_results 테이블에 각 항목 삽입
    const resultsToInsert = items.map(item => ({
      record_id: recordId,
      standard_item_id: item.standard_item_id!,
      value: item.value,
      ref_min: item.ref_min,
      ref_max: item.ref_max,
      ref_text: item.ref_text,
      status: item.status,
      unit: item.unit
    }))

    const { data: resultsData, error: resultsError } = await supabase
      .from('test_results')
      .insert(resultsToInsert)
      .select()

    if (resultsError) {
      console.error('Failed to insert test results:', resultsError)
      // 롤백: test_records 삭제
      await supabase
        .from('test_records')
        .delete()
        .eq('id', recordId)

      return NextResponse.json(
        { error: '검사 결과 저장에 실패했습니다', details: resultsError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        record_id: recordId,
        items_count: resultsData?.length || 0
      }
    })

  } catch (error) {
    console.error('Save test results error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET: 모든 검사 기록 조회 (대시보드용) 또는 단일 레코드 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const recordId = searchParams.get('recordId')
    const petId = searchParams.get('petId')

    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // 단일 레코드 조회 (수정 페이지용)
    if (recordId) {
      const { data: record, error } = await supabase
        .from('test_records')
        .select(`
          id,
          test_date,
          hospital_name,
          machine_type,
          pet_id,
          created_at,
          test_results (
            id,
            standard_item_id,
            value,
            ref_min,
            ref_max,
            ref_text,
            status,
            unit,
            standard_items_master (
              id,
              name,
              display_name_ko,
              default_unit
            )
          )
        `)
        .eq('id', recordId)
        .eq('user_id', user.id)
        .single()

      if (error) {
        console.error('Failed to fetch test record:', error)
        return NextResponse.json(
          { error: '검사 기록 조회에 실패했습니다', details: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        data: record
      })
    }

    // 전체 레코드 목록 조회
    let query = supabase
      .from('test_records')
      .select(`
        id,
        test_date,
        hospital_name,
        machine_type,
        pet_id,
        created_at,
        test_results (
          id,
          standard_item_id,
          value,
          ref_min,
          ref_max,
          ref_text,
          status,
          unit,
          standard_items_master (
            name,
            display_name_ko,
            category,
            default_unit
          )
        )
      `)
      .eq('user_id', user.id)
      .order('test_date', { ascending: false })

    // pet_id 필터가 있으면 적용
    if (petId) {
      query = query.eq('pet_id', petId)
    }

    const { data: records, error } = await query

    if (error) {
      console.error('Failed to fetch test records:', error)
      return NextResponse.json(
        { error: '검사 기록 조회에 실패했습니다', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: records
    })

  } catch (error) {
    console.error('Fetch test results error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// PATCH: 검사 기록 수정 (날짜, 병원명, 펫)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, test_date, hospital_name, pet_id } = body

    if (!id) {
      return NextResponse.json(
        { error: '수정할 검사 기록 ID가 필요합니다' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const updateData: Record<string, string | null> = {}
    if (test_date !== undefined) updateData.test_date = test_date
    if (hospital_name !== undefined) updateData.hospital_name = hospital_name || null
    if (pet_id !== undefined) updateData.pet_id = pet_id || null

    const { data, error } = await supabase
      .from('test_records')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Failed to update test record:', error)
      return NextResponse.json(
        { error: '검사 기록 수정에 실패했습니다', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })

  } catch (error) {
    console.error('Update test record error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// DELETE: 검사 기록 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const recordId = searchParams.get('id')

    if (!recordId) {
      return NextResponse.json(
        { error: '삭제할 검사 기록 ID가 필요합니다' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // test_results가 CASCADE DELETE로 설정되어 있으므로
    // test_records만 삭제하면 관련 결과도 자동 삭제됨
    const { error } = await supabase
      .from('test_records')
      .delete()
      .eq('id', recordId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Failed to delete test record:', error)
      return NextResponse.json(
        { error: '검사 기록 삭제에 실패했습니다', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '검사 기록이 삭제되었습니다'
    })

  } catch (error) {
    console.error('Delete test record error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
