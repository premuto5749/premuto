import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// PATCH: 개별 검사 결과 항목 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // 사용자 인증 확인
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const { value, unit, ref_min, ref_max, ref_text, status } = body

    // 업데이트할 필드만 포함
    const updateData: Record<string, unknown> = {}
    if (value !== undefined) updateData.value = value
    if (unit !== undefined) updateData.unit = unit
    if (ref_min !== undefined) updateData.ref_min = ref_min
    if (ref_max !== undefined) updateData.ref_max = ref_max
    if (ref_text !== undefined) updateData.ref_text = ref_text
    if (status !== undefined) updateData.status = status

    // status 자동 계산 (value, ref_min, ref_max가 변경된 경우)
    if ((value !== undefined || ref_min !== undefined || ref_max !== undefined) && status === undefined) {
      // 현재 값 조회
      const { data: currentItem } = await supabase
        .from('test_results')
        .select('value, ref_min, ref_max')
        .eq('id', id)
        .single()

      if (currentItem) {
        const newValue = value !== undefined ? value : currentItem.value
        const newRefMin = ref_min !== undefined ? ref_min : currentItem.ref_min
        const newRefMax = ref_max !== undefined ? ref_max : currentItem.ref_max

        updateData.status = calculateStatus(newValue, newRefMin, newRefMax)
      }
    }

    const { data, error } = await supabase
      .from('test_results')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Failed to update test result:', error)
      return NextResponse.json(
        { error: '검사 결과 수정에 실패했습니다', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })

  } catch (error) {
    console.error('Update test result error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// DELETE: 개별 검사 결과 항목 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // 사용자 인증 확인
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { error } = await supabase
      .from('test_results')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Failed to delete test result:', error)
      return NextResponse.json(
        { error: '검사 결과 삭제에 실패했습니다', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '검사 결과가 삭제되었습니다'
    })

  } catch (error) {
    console.error('Delete test result error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

function calculateStatus(
  value: number | string | null,
  refMin: number | null,
  refMax: number | null
): 'Low' | 'Normal' | 'High' | 'Unknown' {
  if (value === null || value === '') return 'Unknown'
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(numValue)) return 'Unknown'
  if (refMin !== null && numValue < refMin) return 'Low'
  if (refMax !== null && numValue > refMax) return 'High'
  if (refMin !== null || refMax !== null) return 'Normal'
  return 'Unknown'
}
