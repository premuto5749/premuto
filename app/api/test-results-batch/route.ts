import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/with-auth'
import { validateStandardItemIds, resolveStandardItems } from '@/lib/api/item-resolver'
import type { BatchSaveRequest } from '@/types'
import { parseValue } from '@/lib/ocr/value-parser'
import { triggerOcrSourceDriveBackupFromStaging } from '@/lib/google-drive-upload'
import { waitUntil } from '@vercel/functions'

export const dynamic = 'force-dynamic'

// 최대 실행 시간 설정 (30초)
export const maxDuration = 30

export const POST = withAuth(async (request, { supabase, user }) => {
  try {
    const body: BatchSaveRequest & { pet_id?: string } = await request.json()
    const {
      batch_id,
      test_date,
      hospital_name,
      ocr_batch_id,
      uploaded_files,
      results,
      pet_id
    } = body

    // 입력 검증
    if (!batch_id || !test_date || !results || !Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request body. Required fields: batch_id, test_date, results' },
        { status: 400 }
      )
    }

    console.log(`💾 Batch save started for ${results.length} items (batch: ${batch_id})`)
    console.log(`📋 Request data: test_date=${test_date}, hospital=${hospital_name}, pet_id=${pet_id}`)

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
          batch_upload_id: batch_id,
          user_id: user.id,
          pet_id: finalPetId || null
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
      // 중복 제거: 같은 standard_item_id가 여러 개면 0이 아닌 값 우선, 그 다음 마지막 값 사용
      const dedupedResults = new Map<string, typeof results[0] & { numericValue: number | null }>()

      results.forEach(result => {
        const parsed = parseValue(result.value)
        const numericValue = parsed.numeric
        const existing = dedupedResults.get(result.standard_item_id)

        // 기존 값이 없거나, 기존 값이 0이고 새 값이 0이 아니면 덮어쓰기
        if (!existing || (existing.numericValue === 0 && numericValue !== 0 && numericValue !== null)) {
          dedupedResults.set(result.standard_item_id, { ...result, numericValue })
        } else if (existing.numericValue === null && numericValue !== null) {
          // 기존 값이 null이고 새 값이 있으면 덮어쓰기
          dedupedResults.set(result.standard_item_id, { ...result, numericValue })
        }
      })

      const testResultsToInsert = Array.from(dedupedResults.values()).map(result => {
        const numericValue = result.numericValue

        // 상태 계산 (Low/Normal/High/Unknown)
        let status: 'Low' | 'Normal' | 'High' | 'Unknown' = 'Unknown'

        if (numericValue !== null && result.ref_min !== null && result.ref_max !== null) {
          if (numericValue < result.ref_min) {
            status = 'Low'
          } else if (numericValue > result.ref_max) {
            status = 'High'
          } else {
            status = 'Normal'
          }
        }

        return {
          record_id: recordId,
          standard_item_id: result.standard_item_id,
          value: numericValue ?? 0,
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

      console.log(`📊 Deduplicated: ${results.length} → ${testResultsToInsert.length} items`)

      // 2.5. standard_item_id가 실제로 존재하는지 검증 (마스터 + 유저 커스텀 양쪽)
      const uniqueItemIds = [...new Set(testResultsToInsert.map(r => r.standard_item_id))]
      const { validIds: validIdSet, invalidIds } = await validateStandardItemIds(
        uniqueItemIds, user.id, supabase
      )

      if (invalidIds.length > 0) {
        console.warn(`⚠️ Filtering out ${invalidIds.length} items with invalid standard_item_id: ${invalidIds.join(', ')}`)
        const filteredResults = testResultsToInsert.filter(r => validIdSet.has(r.standard_item_id))
        if (filteredResults.length === 0) {
          throw new Error('모든 항목의 standard_item_id가 유효하지 않습니다')
        }
        console.log(`📊 After filtering: ${testResultsToInsert.length} → ${filteredResults.length} items`)
        testResultsToInsert.length = 0
        testResultsToInsert.push(...filteredResults)
      }

      // 3. test_results 일괄 삽입 (upsert로 중복 방지)
      const { data: resultsData, error: resultsError } = await supabase
        .from('test_results')
        .upsert(testResultsToInsert, {
          onConflict: 'record_id,standard_item_id',
          ignoreDuplicates: false
        })
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

      // Google Drive 백업 (waitUntil: 응답 즉시 반환 + 런타임 수명 연장으로 백업 보장)
      if (ocr_batch_id && finalPetId) {
        waitUntil(
          triggerOcrSourceDriveBackupFromStaging(
            user.id,
            finalPetId,
            test_date,
            hospital_name || null,
            ocr_batch_id,
            uploaded_files || []
          ).catch(err => console.error('[GoogleDrive] Staging-to-Drive backup failed:', err))
        )
      }

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
})

// GET 메서드: 특정 배치의 저장된 결과 조회 (선택사항)
export const GET = withAuth(async (request, { supabase, user }) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const batchId = searchParams.get('batch_id')

    if (!batchId) {
      return NextResponse.json(
        { error: 'batch_id query parameter is required' },
        { status: 400 }
      )
    }

    // 해당 배치로 저장된 test_record 조회 (본인 것만)
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
          user_verified
        )
      `)
      .eq('batch_upload_id', batchId)
      .eq('user_id', user.id)

    if (error) {
      console.error('❌ Failed to fetch batch results:', error)
      return NextResponse.json(
        { error: 'Failed to fetch batch results' },
        { status: 500 }
      )
    }

    // 항목 정보 resolve
    if (records) {
      const allItemIds: string[] = []
      for (const record of records) {
        const results = record.test_results as { standard_item_id: string | null }[]
        for (const r of results || []) {
          if (r.standard_item_id) allItemIds.push(r.standard_item_id)
        }
      }

      const resolvedMap = await resolveStandardItems(allItemIds, user.id, supabase)

      for (const record of records) {
        const results = record.test_results as { standard_item_id: string | null }[]
        record.test_results = results.map(r => ({
          ...r,
          standard_items_master: r.standard_item_id
            ? resolvedMap.get(r.standard_item_id) ?? null
            : null,
        })) as unknown as typeof record.test_results
      }
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
})
