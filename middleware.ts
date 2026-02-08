import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// 7일을 초 단위로 (7 * 24 * 60 * 60)
const COOKIE_MAX_AGE = 604800

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, {
              ...options,
              maxAge: COOKIE_MAX_AGE,
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
            })
          )
        },
      },
    }
  )

  // Supabase가 /auth/callback 대신 루트(/)로 code를 보내는 경우 처리
  // (Supabase 대시보드 Redirect URLs 설정과 무관하게 안전하게 처리)
  const code = request.nextUrl.searchParams.get('code')
  if (code && request.nextUrl.pathname === '/') {
    const callbackUrl = new URL('/auth/callback', request.url)
    callbackUrl.searchParams.set('code', code)
    return NextResponse.redirect(callbackUrl)
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // 로그인이 필요한 경로들
  const protectedPaths = [
    '/daily-log',       // 일일 기록
    '/upload',          // 업로드 (upload-quick 포함)
    '/dashboard',
    '/preview',
    '/staging',
    '/mapping-management',
    '/admin',           // 관리자 페이지
    '/standard-items',  // 표준항목 관리
    '/settings',        // 설정
    '/records-management',
    '/hospital-contacts',
    '/trash',           // 휴지통
  ]
  const isProtectedPath = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path))

  // 보호된 경로에 접근하려는데 세션이 없으면 로그인 페이지로
  if (isProtectedPath && !session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 인증된 사용자가 루트(/)에 접근하면 바로 /daily-log로 리다이렉트
  if (request.nextUrl.pathname === '/' && session) {
    return NextResponse.redirect(new URL('/daily-log', request.url))
  }

  // 로그인 페이지에 접근하려는데 이미 세션이 있으면 일일 기록으로
  if (request.nextUrl.pathname === '/login' && session) {
    return NextResponse.redirect(new URL('/daily-log', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
