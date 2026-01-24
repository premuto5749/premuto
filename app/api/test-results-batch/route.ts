import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { BatchSaveRequest } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body: BatchSaveRequest = await request.json()
    const {
      batch_id,
      test_date,
      hospital_name,
      uploaded_files,
      results
    } = body

    // 입력 검증
    if (!batch_id || !test_date || !results || !Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request body. Required fields: batch_id, test_date, results' },
        { status: 400 }
      )
    }

    // 날짜 검증
    if (test_date === 'Unknown' || test_date === 'null') {
      return NextResponse.json(
        {
          success: false,
          error: '검사 날짜가 필요합니다. Preview 페이지에서 날짜를 입력해주세요.'
        },
        { status: 400 }
      )
    }

    // 날짜 형식 검증 (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(test_date)) {
      return NextResponse.json(
        {
          success: false,
          error: '날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식이어야 합니다.'
        },
        { status: 400 }
      )
    }

    console.log(`💾 Batch save started for ${results.length} items (batch: ${batch_id})`)

    const supabase = await createClient()

    // 중복 체크: 같은 날짜 + 같은 병원의 기존 검사가 있는지 확인
    const { data: existingRecords, error: checkError } = await supabase
      .from('test_records')
      .select(`
        id,
        test_results (
          standard_item_id,
          value,
          unit
        )
      `)
      .eq('test_date', test_date)
      .eq('hospital_name', hospital_name || null)

    if (checkError) {
      console.error('⚠️  Failed to check for duplicates:', checkError)
    }

    // 완전 동일한 검사가 있는지 확인
    let isDuplicate = false
    if (existingRecords && existingRecords.length > 0) {
      for (const existing of existingRecords) {
        const existingResults = existing.test_results as Array<{
          standard_item_id: string
          value: number
          unit: string | null
        }>

        // 결과 개수가 같고, 모든 항목이 완전히 동일하면 중복으로 판단
        if (existingResults.length === results.length) {
          const allMatch = results.every(newResult => {
            return existingResults.some(existingResult =>
              existingResult.standard_item_id === newResult.standard_item_id &&
              existingResult.value === newResult.value &&
              existingResult.unit === newResult.unit
            )
          })

          if (allMatch) {
            isDuplicate = true
            console.log(`⚠️  Duplicate test detected for ${test_date} at ${hospital_name}`)
            break
          }
        }
      }
    }

    // 중복이면 저장하지 않고 경고 반환
    if (isDuplicate) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        message: '동일한 검사 결과가 이미 존재합니다.',
        data: {
          record_id: null,
          saved_count: 0
        }
      })
    }

    // 트랜잭션 시작: RPC 함수를 사용하거나 순차적 저장
    // Supabase는 명시적 트랜잭션을 지원하지 않으므로, 오류 발생 시 롤백 처리를 직접 구현

    let recordId: string | null = null

    try {
      // 1. test_records 생성 (v2 필드 포함)
      const { data: recordData, error: recordError } = await supabase
        .from('test_records')
        .insert({
          test_date,
          hospital_name: hospital_name || null,
          machine_type: null, // v2에서는 각 결과마다 다를 수 있으므로 null
          uploaded_files: uploaded_files || [],
          file_count: uploaded_files?.length || results.length,
          batch_upload_id: batch_id
        })
        .select('id')
        .single()

      if (recordError) {
        console.error('❌ Failed to create test_record:', recordError)
        throw new Error(`Failed to create test record: ${recordError.message}`)
      }

      recordId = recordData.id
      console.log(`✅ Created test_record: ${recordId}`)

      // 2. 각 결과의 상태 계산 및 test_results 생성
      const testResultsToInsert = results.map(result => {
        // 상태 계산 (Low/Normal/High/Unknown)
        let status: 'Low' | 'Normal' | 'High' | 'Unknown' = 'Unknown'

        if (result.ref_min !== null && result.ref_max !== null) {
          if (result.value < result.ref_min) {
            status = 'Low'
          } else if (result.value > result.ref_max) {
            status = 'High'
          } else {
            status = 'Normal'
          }
        }

        return {
          record_id: recordId,
          standard_item_id: result.standard_item_id,
          value: result.value,
          ref_min: result.ref_min,
          ref_max: result.ref_max,
          ref_text: result.ref_text,
          status,
          unit: result.unit,
          // v2 추가 필드
          source_filename: result.source_filename || null,
          ocr_raw_name: result.ocr_raw_name || null,
          mapping_confidence: result.mapping_confidence || null,
          user_verified: result.user_verified || false
        }
      })

      // 3. test_results 일괄 삽입
      const { data: resultsData, error: resultsError } = await supabase
        .from('test_results')
        .insert(testResultsToInsert)
        .select('id')

      if (resultsError) {
        console.error('❌ Failed to create test_results:', resultsError)

        // 롤백: 생성된 test_record 삭제
        if (recordId) {
          console.log(`🔄 Rolling back: deleting test_record ${recordId}`)
          await supabase
            .from('test_records')
            .delete()
            .eq('id', recordId)
        }

        throw new Error(`Failed to create test results: ${resultsError.message}`)
      }

      console.log(`✅ Created ${resultsData?.length || 0} test_results`)

      return NextResponse.json({
        success: true,
        data: {
          record_id: recordId,
          saved_count: resultsData?.length || 0
        }
      })

    } catch (dbError) {
      // 데이터베이스 오류 시 이미 생성된 레코드 정리
      if (recordId) {
        console.log(`🔄 Error occurred, rolling back test_record ${recordId}`)
        try {
          await supabase
            .from('test_records')
            .delete()
            .eq('id', recordId)
          console.log('✅ Rollback successful')
        } catch (rollbackError) {
          console.error('❌ Rollback failed:', rollbackError)
        }
      }

      throw dbError
    }

  } catch (error) {
    console.error('Batch Save API error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET 메서드: 특정 배치의 저장된 결과 조회 (선택사항)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const batchId = searchParams.get('batch_id')

    if (!batchId) {
      return NextResponse.json(
        { error: 'batch_id query parameter is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 해당 배치로 저장된 test_record 조회
    const { data: records, error } = await supabase
      .from('test_records')
      .select(`
        *,
        test_results (
          id,
          standard_item_id,
          value,
          ref_min,
          ref_max,
          ref_text,
          status,
          unit,
          source_filename,
          ocr_raw_name,
          mapping_confidence,
          user_verified,
          standard_items (
            name,
            display_name_ko,
            category
          )
        )
      `)
      .eq('batch_upload_id', batchId)

    if (error) {
      console.error('❌ Failed to fetch batch results:', error)
      return NextResponse.json(
        { error: 'Failed to fetch batch results' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: records || []
    })

  } catch (error) {
    console.error('Batch Get API error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
