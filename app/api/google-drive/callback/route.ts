import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encryptToken, createRootFolder } from '@/lib/google-drive'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  // request에서 origin 자동 추출 (NEXT_PUBLIC_SITE_URL 폴백)
  const origin = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin
  const settingsUrl = `${origin}/settings?tab=data`

  // Google에서 에러 반환
  if (error) {
    return NextResponse.redirect(`${settingsUrl}&drive_error=access_denied`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${settingsUrl}&drive_error=missing_params`)
  }

  // CSRF state 검증
  const cookieStore = await cookies()
  const savedState = cookieStore.get('google_drive_state')?.value
  cookieStore.delete('google_drive_state')

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${settingsUrl}&drive_error=invalid_state`)
  }

  try {
    // 사용자 인증 확인
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.redirect(`${settingsUrl}&drive_error=unknown`)
    }

    // authorization code → tokens
    const redirectUri = `${origin}/api/google-drive/callback`
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenRes.ok) {
      console.error('[GoogleDrive] Token exchange failed:', await tokenRes.text())
      return NextResponse.redirect(`${settingsUrl}&drive_error=token_exchange`)
    }

    const tokens = await tokenRes.json()
    const accessToken = tokens.access_token as string
    const refreshToken = tokens.refresh_token as string | undefined
    const expiresIn = tokens.expires_in as number

    if (!accessToken || !refreshToken) {
      return NextResponse.redirect(`${settingsUrl}&drive_error=no_tokens`)
    }

    // Google 이메일 조회
    let googleEmail: string | null = null
    try {
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (userInfoRes.ok) {
        const userInfo = await userInfoRes.json()
        googleEmail = userInfo.email || null
      }
    } catch {
      // 이메일 조회 실패는 무시
    }

    // MIMOHARU 루트 폴더 생성
    let rootFolderId: string | null = null
    try {
      rootFolderId = await createRootFolder(accessToken)
    } catch (err) {
      console.error('[GoogleDrive] Root folder creation failed:', err)
    }

    // DB에 저장 (upsert)
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
    const { error: dbError } = await supabase
      .from('google_drive_connections')
      .upsert(
        {
          user_id: user.id,
          google_email: googleEmail,
          access_token: encryptToken(accessToken),
          refresh_token: encryptToken(refreshToken),
          token_expires_at: expiresAt,
          root_folder_id: rootFolderId,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (dbError) {
      console.error('[GoogleDrive] DB save failed:', dbError)
      return NextResponse.redirect(`${settingsUrl}&drive_error=db_save`)
    }

    return NextResponse.redirect(`${settingsUrl}&drive_connected=true`)
  } catch (err) {
    console.error('[GoogleDrive] Callback error:', err)
    return NextResponse.redirect(`${settingsUrl}&drive_error=unknown`)
  }
}
