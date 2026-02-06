import { createClient } from '@/lib/supabase/server'

export type TierName = 'free' | 'basic' | 'premium'

export interface TierConfig {
  label: string
  daily_ocr_limit: number      // -1 = 무제한
  max_files_per_ocr: number
  daily_log_max_photos: number
  daily_log_max_photo_size_mb: number
}

export type TierConfigMap = Record<TierName, TierConfig>

// 기본 tier 설정 (DB 조회 실패 시 폴백)
const DEFAULT_TIER_CONFIG: TierConfigMap = {
  free: {
    label: '무료',
    daily_ocr_limit: 2,
    max_files_per_ocr: 3,
    daily_log_max_photos: 3,
    daily_log_max_photo_size_mb: 5,
  },
  basic: {
    label: '기본',
    daily_ocr_limit: 5,
    max_files_per_ocr: 5,
    daily_log_max_photos: 5,
    daily_log_max_photo_size_mb: 10,
  },
  premium: {
    label: '프리미엄',
    daily_ocr_limit: -1,
    max_files_per_ocr: 10,
    daily_log_max_photos: 10,
    daily_log_max_photo_size_mb: 10,
  },
}

/** app_settings에서 tier 설정 조회 */
export async function getTierConfig(): Promise<TierConfigMap> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'tier_config')
      .single()

    if (error || !data) {
      return DEFAULT_TIER_CONFIG
    }

    return data.value as TierConfigMap
  } catch {
    return DEFAULT_TIER_CONFIG
  }
}

/** 사용자 tier 조회 (없으면 free로 자동 생성) */
export async function getUserTier(userId: string): Promise<TierName> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('user_profiles')
      .select('tier')
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      // 프로필이 없으면 자동 생성
      await supabase
        .from('user_profiles')
        .upsert({ user_id: userId, tier: 'free' }, { onConflict: 'user_id' })
      return 'free'
    }

    return data.tier as TierName
  } catch {
    return 'free'
  }
}

/** 오늘 사용량 조회 */
export async function getTodayUsage(
  userId: string,
  action: string
): Promise<number> {
  try {
    const supabase = await createClient()

    // 오늘 시작 (UTC 기준)
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)

    const { count, error } = await supabase
      .from('usage_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action', action)
      .gte('created_at', todayStart.toISOString())

    if (error) return 0
    return count || 0
  } catch {
    return 0
  }
}

/** 사용량 기록 */
export async function logUsage(
  userId: string,
  action: string,
  fileCount: number = 1,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase
      .from('usage_logs')
      .insert({
        user_id: userId,
        action,
        file_count: fileCount,
        metadata,
      })
  } catch (err) {
    console.error('Failed to log usage:', err)
  }
}

/** 사용 가능 여부 체크 (tier + 사용량) */
export async function checkUsageLimit(
  userId: string,
  action: string
): Promise<{
  allowed: boolean
  tier: TierName
  tierConfig: TierConfig
  used: number
  limit: number
  remaining: number
}> {
  const [tierName, tierConfigMap, used] = await Promise.all([
    getUserTier(userId),
    getTierConfig(),
    getTodayUsage(userId, action),
  ])

  const tierConfig = tierConfigMap[tierName] || tierConfigMap.free

  let limit: number
  if (action === 'ocr_analysis') {
    limit = tierConfig.daily_ocr_limit
  } else {
    limit = tierConfig.daily_log_max_photos
  }

  // -1 = 무제한
  const allowed = limit === -1 || used < limit
  const remaining = limit === -1 ? -1 : Math.max(0, limit - used)

  return {
    allowed,
    tier: tierName,
    tierConfig,
    used,
    limit,
    remaining,
  }
}
