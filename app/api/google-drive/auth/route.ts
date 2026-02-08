import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserTier, getTierConfig } from '@/lib/tier'
import { cookies } from 'next/headers'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    // Tier 확인 (Basic 이상만)
    const [tierName, tierConfigMap] = await Promise.all([
      getUserTier(user.id),
      getTierConfig(),
    ])
    const config = tierConfigMap[tierName]
    if (!config.google_drive_enabled) {
      return NextResponse.json(
        { error: '베이직 이상 플랜에서 사용 가능합니다.' },
        { status: 403 }
      )
    }

    // CSRF state 생성
    const state = crypto.randomBytes(32).toString('hex')
    const cookieStore = await cookies()
    cookieStore.set('google_drive_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10분
      path: '/',
    })

    // Google OAuth URL 생성
    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) {
      return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 500 })
    }

    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/google-drive/callback`
    const scope = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email'

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope,
      state,
      access_type: 'offline',
      prompt: 'consent',
    })

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

    return NextResponse.json({ url })
  } catch (error) {
    console.error('[GoogleDrive] Auth error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
