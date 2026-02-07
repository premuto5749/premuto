import { createClient } from '@/lib/supabase/server'

export type TierName = 'free' | 'basic' | 'premium'

export interface TierConfig {
  label: string
  daily_ocr_limit: number      // -1 = 무제한
  max_files_per_ocr: number
  daily_log_max_photos: number
  daily_log_max_photo_size_mb: number
  daily_description_gen_limit: number  // -1 = 무제한, 0 = 잠금
  monthly_detailed_export_limit: number  // -1 = 무제한
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
    daily_description_gen_limit: 0,
    monthly_detailed_export_limit: 1,
  },
  basic: {
    label: '기본',
    daily_ocr_limit: 5,
    max_files_per_ocr: 5,
    daily_log_max_photos: 5,
    daily_log_max_photo_size_mb: 10,
    daily_description_gen_limit: 30,
    monthly_detailed_export_limit: -1,
  },
  premium: {
    label: '프리미엄',
    daily_ocr_limit: -1,
    max_files_per_ocr: 10,
    daily_log_max_photos: 10,
    daily_log_max_photo_size_mb: 10,
    daily_description_gen_limit: -1,
    monthly_detailed_export_limit: -1,
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
      console.warn('[Tier] tier_config not found in app_settings, using defaults:', error?.message)
      return DEFAULT_TIER_CONFIG
    }

    return data.value as TierConfigMap
  } catch (err) {
    console.error('[Tier] getTierConfig error:', err)
    return DEFAULT_TIER_CONFIG
  }
}

/** 사용자 tier 조회 (없으면 free로 자동 생성) */
export async function getUserTier(userId: string): Promise<TierName> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('user_profiles')
    .select('tier')
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // 프로필이 없음 → 자동 생성
      const { error: insertError } = await supabase
        .from('user_profiles')
        .insert({ user_id: userId, tier: 'free' })

      if (insertError) {
        console.error('[Tier] Failed to create user_profile:', insertError.message)
      }
      return 'free'
    }
    // 테이블 자체가 없는 경우 등
    console.error('[Tier] getUserTier error:', error.message, error.code)
    return 'free'
  }

  return (data?.tier as TierName) || 'free'
}

/** 오늘 사용량 조회 */
export async function getTodayUsage(
  userId: string,
  action: string
): Promise<number> {
  const supabase = await createClient()

  // 오늘 시작 (KST 기준 = UTC+9)
  const now = new Date()
  const kstOffset = 9 * 60 * 60 * 1000
  const kstNow = new Date(now.getTime() + kstOffset)
  const todayStart = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()) - kstOffset)

  const { count, error } = await supabase
    .from('usage_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', action)
    .gte('created_at', todayStart.toISOString())

  if (error) {
    console.error(`[Tier] getTodayUsage error (${action}):`, error.message, error.code)
    return 0
  }
  return count || 0
}

/** 사용량 기록 */
export async function logUsage(
  userId: string,
  action: string,
  fileCount: number = 1,
  metadata: Record<string, unknown> = {}
): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('usage_logs')
    .insert({
      user_id: userId,
      action,
      file_count: fileCount,
      metadata,
    })

  if (error) {
    console.error(`[Tier] logUsage FAILED (${action}):`, error.message, error.code)
    return false
  }

  console.log(`[Tier] Usage logged: user=${userId.substring(0, 8)}... action=${action} files=${fileCount}`)
  return true
}

/** 이번 달 사용량 조회 (KST 기준) */
export async function getMonthlyUsage(
  userId: string,
  action: string
): Promise<number> {
  const supabase = await createClient()

  const now = new Date()
  const kstOffset = 9 * 60 * 60 * 1000
  const kstNow = new Date(now.getTime() + kstOffset)
  const monthStart = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), 1) - kstOffset)

  const { count, error } = await supabase
    .from('usage_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', action)
    .gte('created_at', monthStart.toISOString())

  if (error) {
    console.error(`[Tier] getMonthlyUsage error (${action}):`, error.message, error.code)
    return 0
  }
  return count || 0
}

/** 월간 사용 가능 여부 체크 (tier + 월간 사용량) */
export async function checkMonthlyUsageLimit(
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
    getMonthlyUsage(userId, action),
  ])

  const tierConfig = tierConfigMap[tierName] || tierConfigMap.free

  let limit: number
  if (action === 'detailed_export') {
    limit = tierConfig.monthly_detailed_export_limit ?? -1
  } else {
    limit = -1
  }

  const allowed = limit === -1 || used < limit
  const remaining = limit === -1 ? -1 : Math.max(0, limit - used)

  console.log(`[Tier] Monthly check: user=${userId.substring(0, 8)}... tier=${tierName} action=${action} used=${used}/${limit} allowed=${allowed}`)

  return {
    allowed,
    tier: tierName,
    tierConfig,
    used,
    limit,
    remaining,
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
  } else if (action === 'description_generation') {
    limit = tierConfig.daily_description_gen_limit
  } else {
    limit = tierConfig.daily_log_max_photos
  }

  // -1 = 무제한
  const allowed = limit === -1 || used < limit
  const remaining = limit === -1 ? -1 : Math.max(0, limit - used)

  console.log(`[Tier] Check: user=${userId.substring(0, 8)}... tier=${tierName} action=${action} used=${used}/${limit} allowed=${allowed}`)

  return {
    allowed,
    tier: tierName,
    tierConfig,
    used,
    limit,
    remaining,
  }
}
