import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// DELETE: 개별 검사 결과 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json(
        { error: 'Test result ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

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

    console.log(`✅ Deleted test_result: ${id}`)

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
