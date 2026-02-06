import { NextResponse } from 'next/server'
import { checkCurrentUserIsAdmin } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/check-admin
 * 현재 사용자가 관리자인지 확인
 */
export async function GET() {
  try {
    const result = await checkCurrentUserIsAdmin()

    return NextResponse.json({
      isAdmin: result.isAdmin,
      userId: result.userId
    })
  } catch (error) {
    console.error('Check admin error:', error)
    return NextResponse.json({
      isAdmin: false,
      userId: null
    })
  }
}
