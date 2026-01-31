import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { StagingItem } from '@/types'

interface SaveTestResultRequest {
  test_date: string
  hospital_name?: string
  machine_type?: string
  items: StagingItem[]
}

export async function POST(request: NextRequest) {
  try {
    const body: SaveTestResultRequest = await request.json()
    const { test_date, hospital_name, machine_type, items } = body

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

    // 1. test_records 테이블에 헤더 정보 삽입
    const { data: recordData, error: recordError } = await supabase
      .from('test_records')
      .insert({
        test_date,
        hospital_name: hospital_name || null,
        machine_type: machine_type || null
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

// GET: 모든 검사 기록 조회 (대시보드용)
export async function GET() {
  try {
    const supabase = await createClient()

    // test_records와 test_results를 조인하여 조회
    const { data: records, error } = await supabase
      .from('test_records')
      .select(`
        id,
        test_date,
        hospital_name,
        machine_type,
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
          standard_items (
            name,
            display_name_ko,
            category,
            default_unit
          )
        )
      `)
      .order('test_date', { ascending: false })

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

    // test_results가 CASCADE DELETE로 설정되어 있으므로
    // test_records만 삭제하면 관련 결과도 자동 삭제됨
    const { error } = await supabase
      .from('test_records')
      .delete()
      .eq('id', recordId)

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
