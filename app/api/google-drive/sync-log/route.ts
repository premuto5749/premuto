import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/with-auth'

export const dynamic = 'force-dynamic'

// GET: 동기화 로그 조회
export const GET = withAuth(async (request, { supabase, user }) => {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const { data: logs, error, count } = await supabase
      .from('google_drive_sync_log')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[GoogleDrive] Sync log query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        logs: logs || [],
        total: count || 0,
        offset,
        limit,
      },
    })
  } catch (error) {
    console.error('[GoogleDrive] Sync log error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
