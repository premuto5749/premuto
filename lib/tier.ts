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
  daily_excel_export_limit: number    // 일일 엑셀 내보내기 (-1=무제한)
  weekly_photo_export_limit: number   // 주간 사진 ZIP 내보내기 (-1=무제한)
  google_drive_enabled: boolean       // Google Drive 백업 활성화
  ocr_max_tokens: number              // OCR API max_tokens (-1=무제한은 없음)
  pdf_max_pages: number               // PDF 최대 페이지 수 (-1=무제한)
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
    daily_excel_export_limit: 1,
    weekly_photo_export_limit: 1,
    google_drive_enabled: false,
    ocr_max_tokens: 8000,
    pdf_max_pages: 3,
  },
  basic: {
    label: '기본',
    daily_ocr_limit: 5,
    max_files_per_ocr: 5,
    daily_log_max_photos: 5,
    daily_log_max_photo_size_mb: 10,
    daily_description_gen_limit: 30,
    monthly_detailed_export_limit: -1,
    daily_excel_export_limit: -1,
    weekly_photo_export_limit: -1,
    google_drive_enabled: true,
    ocr_max_tokens: 16000,
    pdf_max_pages: 10,
  },
  premium: {
    label: '프리미엄',
    daily_ocr_limit: -1,
    max_files_per_ocr: 10,
    daily_log_max_photos: 10,
    daily_log_max_photo_size_mb: 10,
    daily_description_gen_limit: -1,
    monthly_detailed_export_limit: -1,
    daily_excel_export_limit: -1,
    weekly_photo_export_limit: -1,
    google_drive_enabled: true,
    ocr_max_tokens: 32000,
    pdf_max_pages: -1,
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

    // DB 값에 새 필드가 없을 수 있으므로 defaults와 merge
    const dbConfig = data.value as TierConfigMap
    const merged: TierConfigMap = {} as TierConfigMap
    for (const tier of ['free', 'basic', 'premium'] as TierName[]) {
      merged[tier] = { ...DEFAULT_TIER_CONFIG[tier], ...(dbConfig[tier] || {}) }
    }
    return merged
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
      // user_metadata에서 이용약관 동의 시점, 카카오 닉네임/전화번호 읽기
      let termsAcceptedAt: string | null = null
      let nickname: string | null = null
      let phone: string | null = null
      let profileImage: string | null = null
      try {
        const { data: { user } } = await supabase.auth.getUser()
        termsAcceptedAt = user?.user_metadata?.terms_accepted_at || null

        // 카카오 identity_data에서 프로필 정보 추출
        const kakaoIdentity = user?.identities?.find(i => i.provider === 'kakao')
        if (kakaoIdentity?.identity_data) {
          const kData = kakaoIdentity.identity_data as Record<string, string>
          phone = kData.phone_number || null
          nickname = kData.name || null
          profileImage = kData.avatar_url || kData.picture || null
        }

        // 이메일 가입 시 user_metadata에서 전화번호
        if (!phone && user?.user_metadata?.phone) {
          phone = user.user_metadata.phone as string
        }

        // 닉네임이 없으면 랜덤 생성
        if (!nickname) {
          const adjectives = [
            '행복한', '귀여운', '건강한', '씩씩한', '사랑스런', '활발한', '다정한', '용감한',
            '똑똑한', '느긋한', '장난꾸러기', '포근한', '반짝이는', '수줍은', '든든한', '깜찍한',
            '졸린', '배고픈', '신나는', '당당한', '소중한', '따뜻한', '호기심많은', '얌전한',
          ]
          const animals = [
            '강아지', '고양이', '토끼', '햄스터', '앵무새', '거북이', '물고기', '다람쥐',
            '고슴도치', '수달', '펭귄', '부엉이', '여우', '판다', '코알라', '미어캣',
            '치와와', '푸들', '시바견', '먼치킨', '페르시안', '래브라도', '비숑', '말티즈',
          ]
          const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
          const animal = animals[Math.floor(Math.random() * animals.length)]
          const num = Math.floor(Math.random() * 1000)
          nickname = `${adj}${animal}${num}`
        }
      } catch {
        // metadata 조회 실패 시 무시
      }

      const { error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: userId,
          tier: 'free',
          ...(termsAcceptedAt ? { terms_accepted_at: termsAcceptedAt } : {}),
          ...(nickname ? { nickname } : {}),
          ...(phone ? { phone } : {}),
          ...(profileImage ? { profile_image: profileImage } : {}),
        })

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

/** 오늘 시작 시각 (KST 기준) */
function getTodayStartKST(): Date {
  const now = new Date()
  const kstOffset = 9 * 60 * 60 * 1000
  const kstNow = new Date(now.getTime() + kstOffset)
  return new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()) - kstOffset)
}

/** 오늘 사용량 조회 */
export async function getTodayUsage(
  userId: string,
  action: string
): Promise<number> {
  const supabase = await createClient()
  const todayStart = getTodayStartKST()

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

/** 오늘 사용량 일괄 조회 (여러 action을 1회 쿼리로 집계) */
export async function getTodayUsageBatch(
  userId: string,
  actions: string[]
): Promise<Record<string, number>> {
  const supabase = await createClient()
  const todayStart = getTodayStartKST()
  const result: Record<string, number> = {}
  for (const a of actions) result[a] = 0

  const { data, error } = await supabase
    .from('usage_logs')
    .select('action')
    .eq('user_id', userId)
    .in('action', actions)
    .gte('created_at', todayStart.toISOString())

  if (error) {
    console.error(`[Tier] getTodayUsageBatch error:`, error.message, error.code)
    return result
  }

  for (const row of data || []) {
    result[row.action] = (result[row.action] || 0) + 1
  }
  return result
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

/** 이번 주 사용량 조회 (KST 기준, 월요일 시작) */
export async function getWeeklyUsage(
  userId: string,
  action: string
): Promise<number> {
  const supabase = await createClient()

  const now = new Date()
  const kstOffset = 9 * 60 * 60 * 1000
  const kstNow = new Date(now.getTime() + kstOffset)
  // KST 기준 요일 (0=일, 1=월, ..., 6=토)
  const dayOfWeek = kstNow.getUTCDay()
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const weekStart = new Date(
    Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate() - daysSinceMonday) - kstOffset
  )

  const { count, error } = await supabase
    .from('usage_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', action)
    .gte('created_at', weekStart.toISOString())

  if (error) {
    console.error(`[Tier] getWeeklyUsage error (${action}):`, error.message, error.code)
    return 0
  }
  return count || 0
}

/** 주간 사용 가능 여부 체크 (tier + 주간 사용량) */
export async function checkWeeklyUsageLimit(
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
    getWeeklyUsage(userId, action),
  ])

  const tierConfig = tierConfigMap[tierName] || tierConfigMap.free

  let limit: number
  if (action === 'daily_log_photo_export') {
    limit = tierConfig.weekly_photo_export_limit ?? -1
  } else {
    limit = -1
  }

  const allowed = limit === -1 || used < limit
  const remaining = limit === -1 ? -1 : Math.max(0, limit - used)

  console.log(`[Tier] Weekly check: user=${userId.substring(0, 8)}... tier=${tierName} action=${action} used=${used}/${limit} allowed=${allowed}`)

  return {
    allowed,
    tier: tierName,
    tierConfig,
    used,
    limit,
    remaining,
  }
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
  } else if (action === 'daily_log_excel_export') {
    limit = tierConfig.daily_excel_export_limit ?? -1
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
