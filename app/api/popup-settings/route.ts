import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface PopupAnnouncement {
  id: string
  enabled: boolean
  title: string
  content: string
  startDate: string
  endDate: string
  priority: number
  createdAt: string
  updatedAt: string
}

// GET: 공개 API — 활성+기간 내 공지만 반환
export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'popup_settings')
      .single()

    if (error || !data) {
      return NextResponse.json({ success: true, data: [] })
    }

    const announcements: PopupAnnouncement[] = data.value?.announcements || []

    // KST 기준 현재 날짜 (YYYY-MM-DD)
    const now = new Date()
    const kstOffset = 9 * 60 * 60 * 1000
    const kstDate = new Date(now.getTime() + kstOffset)
    const todayStr = kstDate.toISOString().split('T')[0]

    // 필터링: enabled=true && startDate <= today <= endDate
    const active = announcements
      .filter(a => a.enabled && a.startDate <= todayStr && a.endDate >= todayStr)
      .sort((a, b) => b.priority - a.priority)

    return NextResponse.json({ success: true, data: active })
  } catch (error) {
    console.error('Popup settings API error:', error)
    return NextResponse.json({ success: true, data: [] })
  }
}
