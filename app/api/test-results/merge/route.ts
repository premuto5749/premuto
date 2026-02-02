import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface MergeRequest {
  sourceRecordId: string
  targetRecordId: string
  targetDate: string
  targetHospital: string
  conflictResolutions: {
    standardItemId: string
    useSourceValue: boolean
  }[]
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 사용자 인증 확인
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body: MergeRequest = await request.json()
    const { sourceRecordId, targetRecordId, targetDate, targetHospital, conflictResolutions } = body

    // 1. 두 레코드의 결과 가져오기
    const [sourceResults, targetResults] = await Promise.all([
      supabase
        .from('test_results')
        .select('*, standard_items(id, name)')
        .eq('record_id', sourceRecordId),
      supabase
        .from('test_results')
        .select('*, standard_items(id, name)')
        .eq('record_id', targetRecordId)
    ])

    if (sourceResults.error || targetResults.error) {
      throw new Error('검사 결과를 가져오는데 실패했습니다')
    }

    // 2. target 레코드의 날짜와 병원 업데이트
    const { error: updateRecordError } = await supabase
      .from('test_records')
      .update({
        test_date: targetDate,
        hospital_name: targetHospital,
        updated_at: new Date().toISOString()
      })
      .eq('id', targetRecordId)

    if (updateRecordError) {
      throw new Error('레코드 업데이트에 실패했습니다')
    }

    // 3. source의 결과들을 target으로 이동 (충돌 해결 적용)
    const targetItemIds = new Set(targetResults.data?.map(r => r.standard_item_id) || [])
    const conflictMap = new Map(conflictResolutions.map(c => [c.standardItemId, c.useSourceValue]))

    for (const sourceResult of sourceResults.data || []) {
      const standardItemId = sourceResult.standard_item_id
      const hasConflict = targetItemIds.has(standardItemId)

      if (hasConflict) {
        // 충돌이 있는 경우
        const useSource = conflictMap.get(standardItemId)

        if (useSource) {
          // source 값을 사용: target의 기존 결과 삭제 후 source 결과를 target으로 이동
          await supabase
            .from('test_results')
            .delete()
            .eq('record_id', targetRecordId)
            .eq('standard_item_id', standardItemId)

          await supabase
            .from('test_results')
            .update({ record_id: targetRecordId })
            .eq('id', sourceResult.id)
        }
        // useSource가 false이면 source 결과는 그대로 두고 나중에 source 레코드와 함께 삭제됨
      } else {
        // 충돌 없음: source 결과를 target으로 이동
        await supabase
          .from('test_results')
          .update({ record_id: targetRecordId })
          .eq('id', sourceResult.id)
      }
    }

    // 4. source 레코드 삭제 (남은 결과들도 함께 삭제됨 - cascade)
    const { error: deleteError } = await supabase
      .from('test_records')
      .delete()
      .eq('id', sourceRecordId)

    if (deleteError) {
      throw new Error('원본 레코드 삭제에 실패했습니다')
    }

    return NextResponse.json({
      success: true,
      message: '병합이 완료되었습니다'
    })

  } catch (error) {
    console.error('Merge error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '병합 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

// 병합 전 충돌 확인 API
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sourceId = searchParams.get('sourceId')
    const targetId = searchParams.get('targetId')

    if (!sourceId || !targetId) {
      return NextResponse.json({ error: 'sourceId와 targetId가 필요합니다' }, { status: 400 })
    }

    // 두 레코드 정보 가져오기
    const { data: records, error: recordsError } = await supabase
      .from('test_records')
      .select('*')
      .in('id', [sourceId, targetId])

    if (recordsError || !records || records.length !== 2) {
      throw new Error('레코드를 찾을 수 없습니다')
    }

    const sourceRecord = records.find(r => r.id === sourceId)!
    const targetRecord = records.find(r => r.id === targetId)!

    // 두 레코드의 결과 가져오기
    const [sourceResults, targetResults] = await Promise.all([
      supabase
        .from('test_results')
        .select('*, standard_items(id, name, display_name_ko)')
        .eq('record_id', sourceId),
      supabase
        .from('test_results')
        .select('*, standard_items(id, name, display_name_ko)')
        .eq('record_id', targetId)
    ])

    if (sourceResults.error || targetResults.error) {
      throw new Error('검사 결과를 가져오는데 실패했습니다')
    }

    // 충돌 찾기
    const targetItemMap = new Map(
      (targetResults.data || []).map(r => [r.standard_item_id, r])
    )

    const conflicts = (sourceResults.data || [])
      .filter(sr => targetItemMap.has(sr.standard_item_id))
      .map(sr => {
        const tr = targetItemMap.get(sr.standard_item_id)!
        return {
          standardItemId: sr.standard_item_id,
          itemName: sr.standard_items?.name || 'Unknown',
          itemNameKo: sr.standard_items?.display_name_ko || sr.standard_items?.name || 'Unknown',
          sourceValue: sr.value,
          sourceUnit: sr.unit,
          targetValue: tr.value,
          targetUnit: tr.unit
        }
      })
      .filter(c => c.sourceValue !== c.targetValue) // 값이 다른 경우만

    // 날짜/병원 충돌 확인
    const dateConflict = sourceRecord.test_date !== targetRecord.test_date
    const hospitalConflict = sourceRecord.hospital_name !== targetRecord.hospital_name &&
      sourceRecord.hospital_name && targetRecord.hospital_name

    return NextResponse.json({
      success: true,
      data: {
        sourceRecord: {
          id: sourceRecord.id,
          testDate: sourceRecord.test_date,
          hospitalName: sourceRecord.hospital_name,
          itemCount: sourceResults.data?.length || 0
        },
        targetRecord: {
          id: targetRecord.id,
          testDate: targetRecord.test_date,
          hospitalName: targetRecord.hospital_name,
          itemCount: targetResults.data?.length || 0
        },
        dateConflict,
        hospitalConflict,
        itemConflicts: conflicts
      }
    })

  } catch (error) {
    console.error('Conflict check error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '충돌 확인 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
