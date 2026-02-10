import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface Flyer {
  id: string
  imagePath: string
  imageUrl?: string
  title: string
  status: 'active' | 'closed'
  createdAt: string
  updatedAt: string
}

// GET: 모든 전단지 반환 (active + closed), public URL 재생성
export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'lost_animal_flyers')
      .single()

    if (error || !data) {
      return NextResponse.json({ success: true, data: [] })
    }

    const flyers: Flyer[] = data.value?.flyers || []

    // public URL 재생성
    const flyersWithUrls = flyers.map(flyer => {
      const { data: urlData } = supabase.storage
        .from('site-assets')
        .getPublicUrl(flyer.imagePath)
      return {
        ...flyer,
        imageUrl: urlData.publicUrl,
      }
    })

    return NextResponse.json({ success: true, data: flyersWithUrls })
  } catch (error) {
    console.error('Lost animals API error:', error)
    return NextResponse.json({ success: true, data: [] })
  }
}
