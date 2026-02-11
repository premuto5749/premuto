import { createClient } from '@/lib/supabase/server'

export const BUCKET_NAME = 'site-assets'
export const FOLDER = 'lost-animals'
export const ALLOWED_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif']
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB per image

export interface Flyer {
  id: string
  imagePath: string
  imageUrl?: string
  title: string
  status: 'active' | 'closed'
  createdAt: string
  updatedAt: string
}

export interface FlyerSettings {
  flyers: Flyer[]
}

export async function getFlyerSettings(supabase: Awaited<ReturnType<typeof createClient>>): Promise<FlyerSettings> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'lost_animal_flyers')
    .single()

  return data?.value || { flyers: [] }
}

export async function saveFlyerSettings(supabase: Awaited<ReturnType<typeof createClient>>, settings: FlyerSettings) {
  return supabase
    .from('app_settings')
    .upsert({
      key: 'lost_animal_flyers',
      value: settings,
      description: '유실 동물 전단지 설정'
    }, { onConflict: 'key' })
}
