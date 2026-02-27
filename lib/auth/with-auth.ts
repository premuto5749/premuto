import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'

export interface AuthContext {
  supabase: SupabaseClient
  user: User
}

/**
 * 인증이 필요한 API 라우트 래퍼.
 * supabase 클라이언트 생성 및 사용자 인증을 자동 처리합니다.
 *
 * @example 일반 라우트
 * export const GET = withAuth(async (req, { supabase, user }) => {
 *   const { data } = await supabase.from('table').select('*').eq('user_id', user.id)
 *   return NextResponse.json({ data })
 * })
 *
 * @example 동적 라우트 ([id])
 * export const PATCH = withAuth<{ id: string }>(async (req, { supabase, user, params }) => {
 *   const { id } = await params
 *   // ...
 * })
 */
export function withAuth<P extends Record<string, string> = Record<string, string>>(
  handler: (
    request: NextRequest,
    context: AuthContext & { params: Promise<P> }
  ) => Promise<NextResponse>
) {
  return async (
    request: NextRequest,
    routeContext?: { params: Promise<P> }
  ): Promise<NextResponse> => {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }
    return handler(request, {
      supabase,
      user,
      params: routeContext?.params ?? Promise.resolve({} as P),
    })
  }
}
