import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decryptToken, revokeToken } from '@/lib/google-drive'

export const dynamic = 'force-dynamic'

// GET: Drive 연결 상태 조회
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const { data: connection } = await supabase
      .from('google_drive_connections')
      .select('google_email, is_active, last_sync_at, created_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!connection) {
      return NextResponse.json({
        success: true,
        data: { connected: false },
      })
    }

    // 동기화 통계
    const { data: stats } = await supabase
      .from('google_drive_sync_log')
      .select('status')
      .eq('user_id', user.id)

    const total = stats?.length || 0
    const success = stats?.filter(s => s.status === 'success').length || 0
    const failed = stats?.filter(s => s.status === 'failed').length || 0

    return NextResponse.json({
      success: true,
      data: {
        connected: true,
        google_email: connection.google_email,
        last_sync_at: connection.last_sync_at,
        connected_at: connection.created_at,
        stats: { total, success, failed },
      },
    })
  } catch (error) {
    console.error('[GoogleDrive] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: Drive 연결 해제
export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    // 토큰 조회
    const { data: connection } = await supabase
      .from('google_drive_connections')
      .select('access_token')
      .eq('user_id', user.id)
      .single()

    // Google 토큰 취소
    if (connection?.access_token) {
      try {
        const token = decryptToken(connection.access_token)
        await revokeToken(token)
      } catch {
        // 토큰 취소 실패는 무시
      }
    }

    // DB 레코드 삭제
    await supabase
      .from('google_drive_connections')
      .delete()
      .eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[GoogleDrive] DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
