import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// DELETE: 검사 기록 전체 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json(
        { error: 'Test record ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // test_results는 ON DELETE CASCADE로 자동 삭제됨
    const { error } = await supabase
      .from('test_records')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Failed to delete test record:', error)
      return NextResponse.json(
        { error: '검사 기록 삭제에 실패했습니다', details: error.message },
        { status: 500 }
      )
    }

    console.log(`✅ Deleted test_record: ${id}`)

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
