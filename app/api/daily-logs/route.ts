import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { DailyLog, DailyLogInput, DailyStats } from '@/types'
import { triggerDailyLogDriveBackup } from '@/lib/google-drive-upload'
import { waitUntil } from '@vercel/functions'

export const dynamic = 'force-dynamic'

const BUCKET_NAME = 'daily-log-photos'
const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 7 // 7일

// 파일 경로를 Signed URL로 변환 (하위 호환: 이미 URL이면 그대로 반환)
// Service Role 클라이언트 사용: Storage RLS를 우회하여 안정적으로 Signed URL 생성
// (API 레벨에서 이미 사용자 인증 검증 완료)
async function convertPathsToSignedUrls(
  photoUrls: string[] | null
): Promise<string[]> {
  if (!photoUrls || photoUrls.length === 0) return []

  const serviceClient = createServiceClient()
  const results: string[] = []
  for (const pathOrUrl of photoUrls) {
    // 이미 URL이면 그대로 사용 (하위 호환)
    if (pathOrUrl.startsWith('http')) {
      results.push(pathOrUrl)
      continue
    }

    // 파일 경로면 Signed URL 생성
    const { data: signedUrl, error } = await serviceClient.storage
      .from(BUCKET_NAME)
      .createSignedUrl(pathOrUrl, SIGNED_URL_EXPIRY)

    if (error || !signedUrl) {
      console.error('Signed URL generation error:', {
        path: pathOrUrl,
        error: error?.message,
        bucket: BUCKET_NAME
      })
      // 실패 시 경로 그대로 반환 (디버깅용)
      results.push(pathOrUrl)
    } else {
      results.push(signedUrl.signedUrl)
    }
  }
  return results
}

// 비산책 로그의 logged_at이 완료된 산책 시간대에 해당하면 walk_id 자동 할당
// 반환값: 할당된 walk_id 또는 null (재조회 불필요하도록)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function autoAssignWalkId(supabase: any, userId: string, logId: string, loggedAt: string, petId: string | null): Promise<string | null> {
  try {
    let query = supabase
      .from('daily_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('category', 'walk')
      .is('deleted_at', null)
      .not('walk_end_at', 'is', null)
      .lte('logged_at', loggedAt)
      .gte('walk_end_at', loggedAt)

    if (petId) {
      query = query.eq('pet_id', petId)
    }

    const { data: walk } = await query.limit(1).maybeSingle()
    if (walk) {
      await supabase
        .from('daily_logs')
        .update({ walk_id: walk.id })
        .eq('id', logId)
        .eq('user_id', userId)
      return walk.id
    }
    return null
  } catch (err) {
    console.error('Auto-assign walk_id error:', err)
    return null
  }
}

// GET: 기록 조회 (날짜 범위 또는 특정 날짜)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    // 인증된 사용자 확인 (뷰 조회 시 RLS가 제대로 적용되지 않을 수 있음)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const date = searchParams.get('date')           // 특정 날짜 (YYYY-MM-DD)
    const startDate = searchParams.get('start')     // 시작일
    const endDate = searchParams.get('end')         // 종료일
    const category = searchParams.get('category')   // 카테고리 필터
    const stats = searchParams.get('stats')         // 통계 조회 여부
    const petId = searchParams.get('pet_id')        // 반려동물 필터
    const showDeleted = searchParams.get('deleted') === 'true' // 삭제된 기록 조회
    const latestWeight = searchParams.get('latest_weight') // 최근 체중 조회
    const activeWalk = searchParams.get('active_walk') // 진행 중 산책 조회

    // 진행 중 산책 조회 (날짜 무관, walk_end_at IS NULL)
    if (activeWalk === 'true' && petId) {
      const { data: walkLog } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('pet_id', petId)
        .eq('category', 'walk')
        .is('deleted_at', null)
        .is('walk_end_at', null)
        .order('logged_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      return NextResponse.json({
        success: true,
        data: walkLog || null
      })
    }

    // 최근 체중 조회 (carry-forward)
    if (latestWeight === 'true' && petId) {
      const targetDate = date || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })

      // 해당 날짜 이전의 가장 최근 weight 기록
      const { data: weightLog } = await supabase
        .from('daily_logs')
        .select('amount, logged_at')
        .eq('user_id', user.id)
        .eq('pet_id', petId)
        .eq('category', 'weight')
        .is('deleted_at', null)
        .lte('logged_at', `${targetDate}T23:59:59.999+09:00`)
        .order('logged_at', { ascending: false })
        .limit(1)
        .single()

      if (weightLog) {
        return NextResponse.json({
          success: true,
          data: { weight: weightLog.amount, logged_at: weightLog.logged_at }
        })
      }

      // 체중 기록이 없으면 pets.weight_kg fallback
      const { data: pet } = await supabase
        .from('pets')
        .select('weight_kg')
        .eq('id', petId)
        .eq('user_id', user.id)
        .single()

      return NextResponse.json({
        success: true,
        data: { weight: pet?.weight_kg || null, logged_at: null }
      })
    }

    // 통계 조회
    if (stats === 'true') {
      let query = supabase.from('daily_stats').select('*')
        .eq('user_id', user.id)  // 명시적 user_id 필터링 (뷰 RLS 보완)

      if (date) {
        query = query.eq('log_date', date)
      } else if (startDate && endDate) {
        query = query.gte('log_date', startDate).lte('log_date', endDate)
      }

      // pet_id 필터링
      if (petId) {
        query = query.eq('pet_id', petId)
      }

      const { data, error } = await query.order('log_date', { ascending: false })

      if (error) {
        console.error('Daily stats query error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: data as DailyStats[]
      })
    }

    // 일반 기록 조회
    let query = supabase.from('daily_logs').select('*')
      .eq('user_id', user.id)  // 명시적 user_id 필터링 (RLS 보완)

    // 삭제된 기록 / 활성 기록 필터
    if (showDeleted) {
      query = query.not('deleted_at', 'is', null)
    } else {
      query = query.is('deleted_at', null)
    }

    if (date) {
      // 특정 날짜의 기록 (KST 기준, UTC+9)
      query = query.gte('logged_at', `${date}T00:00:00+09:00`)
                   .lt('logged_at', `${date}T23:59:59.999+09:00`)
    } else if (startDate && endDate) {
      query = query.gte('logged_at', `${startDate}T00:00:00+09:00`)
                   .lte('logged_at', `${endDate}T23:59:59.999+09:00`)
    }

    if (category) {
      query = query.eq('category', category)
    }

    // pet_id 필터링
    if (petId) {
      query = query.eq('pet_id', petId)
    }

    const { data, error } = await query.order('logged_at', { ascending: false })

    if (error) {
      console.error('Daily logs query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // photo_urls를 Signed URL로 변환
    const processedData = await Promise.all(
      (data || []).map(async (log) => ({
        ...log,
        photo_urls: await convertPathsToSignedUrls(log.photo_urls)
      }))
    )

    return NextResponse.json({
      success: true,
      data: processedData as DailyLog[]
    })

  } catch (error) {
    console.error('Daily logs API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST: 새 기록 추가
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 인증된 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const body: DailyLogInput = await request.json()

    const { category, pet_id, logged_at, amount, leftover_amount, unit, memo, photo_urls, medicine_name, snack_name, calories, input_source, walk_end_at, walk_id } = body

    if (!category) {
      return NextResponse.json(
        { error: 'Category is required' },
        { status: 400 }
      )
    }

    const insertData: Record<string, unknown> = {
      user_id: user.id,
      pet_id: pet_id || null,
      category,
      logged_at: logged_at || new Date().toISOString(),
      amount,
      leftover_amount: category === 'meal' ? (leftover_amount || 0) : null,
      unit,
      memo,
      photo_urls: photo_urls || [],
      medicine_name: category === 'medicine' ? medicine_name : null,
      snack_name: category === 'snack' ? snack_name : null,
      calories: category === 'snack' ? (calories ?? null) : null,
      input_source: input_source || 'manual',
      walk_end_at: category === 'walk' ? (walk_end_at ?? null) : null,
      walk_id: walk_id || null,
    }

    // 첫 번째 시도: leftover_amount 포함
    let { data, error } = await supabase
      .from('daily_logs')
      .insert(insertData)
      .select()
      .single()

    // leftover_amount 컬럼이 없으면 해당 필드 제외하고 재시도
    if (error && error.code === 'PGRST204') {
      delete insertData.leftover_amount
      const retryResult = await supabase
        .from('daily_logs')
        .insert(insertData)
        .select()
        .single()

      data = retryResult.data
      error = retryResult.error
    }

    if (error) {
      console.error('Daily log insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 비산책 로그이고 walk_id가 없으면, 완료된 산책 시간대에 해당하는지 확인 후 자동 할당
    if (data.category !== 'walk' && !data.walk_id && data.logged_at) {
      const assignedWalkId = await autoAssignWalkId(supabase, user.id, data.id, data.logged_at, data.pet_id)
      if (assignedWalkId) data = { ...data, walk_id: assignedWalkId }
    }

    // photo_urls를 Signed URL로 변환
    const processedData = {
      ...data,
      photo_urls: await convertPathsToSignedUrls(data.photo_urls)
    }

    // Google Drive 백업 (waitUntil: 응답 즉시 반환 + 런타임 수명 연장으로 백업 보장)
    if (data.photo_urls?.length > 0 && pet_id) {
      waitUntil(
        triggerDailyLogDriveBackup(user.id, pet_id, data.logged_at, data.photo_urls, data.id, data.category)
          .catch(err => console.error('[GoogleDrive] Daily log backup failed:', err))
      )
    }

    return NextResponse.json({
      success: true,
      data: processedData as DailyLog
    })

  } catch (error) {
    console.error('Daily logs POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE: 기록 삭제
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 인증된 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const permanent = searchParams.get('permanent') === 'true'

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      )
    }

    if (permanent) {
      // 영구 삭제 (이미 소프트 삭제된 레코드만)
      const { error } = await supabase
        .from('daily_logs')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
        .not('deleted_at', 'is', null)

      if (error) {
        console.error('Daily log permanent delete error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: '기록이 영구 삭제되었습니다' })
    }

    // 소프트 삭제: deleted_at 설정 (7일 후 영구 삭제)
    const { error } = await supabase
      .from('daily_logs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .is('deleted_at', null)

    if (error) {
      console.error('Daily log soft-delete error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: '기록이 삭제되었습니다 (7일 후 영구 삭제)' })

  } catch (error) {
    console.error('Daily logs DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH: 기록 수정
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 인증된 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { id, restore, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      )
    }

    // 복원 요청
    if (restore) {
      const { data, error } = await supabase
        .from('daily_logs')
        .update({ deleted_at: null })
        .eq('id', id)
        .eq('user_id', user.id)
        .not('deleted_at', 'is', null)
        .select()
        .single()

      if (error) {
        console.error('Daily log restore error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const processedData = {
        ...data,
        photo_urls: await convertPathsToSignedUrls(data.photo_urls)
      }

      return NextResponse.json({
        success: true,
        data: processedData as DailyLog,
        message: '기록이 복원되었습니다'
      })
    }

    // 첫 번째 시도: leftover_amount 포함
    let { data, error } = await supabase
      .from('daily_logs')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)  // 본인 데이터만 수정 가능
      .select()
      .single()

    // leftover_amount 컬럼이 없으면 해당 필드 제외하고 재시도
    if (error && error.code === 'PGRST204' && 'leftover_amount' in updates) {
      delete updates.leftover_amount
      const retryResult = await supabase
        .from('daily_logs')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)  // 본인 데이터만 수정 가능
        .select()
        .single()

      data = retryResult.data
      error = retryResult.error
    }

    if (error) {
      console.error('Daily log update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 비산책 로그의 시간이 수정된 경우, 완료된 산책 시간대에 해당하면 walk_id 자동 할당/해제
    if (data.category !== 'walk' && 'logged_at' in updates) {
      const previousWalkId = data.walk_id
      try {
        // 먼저 기존 walk_id 해제 (시간이 바뀌었으므로 더 이상 해당 산책 범위가 아닐 수 있음)
        const { error: clearErr } = await supabase
          .from('daily_logs')
          .update({ walk_id: null })
          .eq('id', data.id)
          .eq('user_id', user.id)
        if (clearErr) throw clearErr

        // 새 시간에 해당하는 산책이 있으면 할당
        const assignedWalkId = await autoAssignWalkId(supabase, user.id, data.id, data.logged_at, data.pet_id)
        data = { ...data, walk_id: assignedWalkId }
      } catch (err) {
        console.error('Walk ID re-assign on time edit error:', err)
        // 재할당 실패 시 원래 walk_id로 복구
        if (previousWalkId) {
          const { error: restoreErr } = await supabase
            .from('daily_logs')
            .update({ walk_id: previousWalkId })
            .eq('id', data.id)
            .eq('user_id', user.id)
          if (restoreErr) {
            console.error('Walk ID restore failed:', restoreErr)
            data = { ...data, walk_id: null }
          } else {
            data = { ...data, walk_id: previousWalkId }
          }
        } else {
          data = { ...data, walk_id: null }
        }
      }
    }

    // 산책 기록이 종료되거나 시간이 수정된 경우, 해당 시간대의 로그에 walk_id 자동 할당
    if (data.category === 'walk' && data.walk_end_at && data.logged_at) {
      const walkId = data.id
      const walkStart = data.logged_at
      const walkEnd = data.walk_end_at
      const walkPetId = data.pet_id
      let previousIds: string[] = []

      try {
        // 1) 해제 전에 기존 연결 로그 ID를 기록 (실패 시 복구용)
        const { data: previouslyLinked } = await supabase
          .from('daily_logs')
          .select('id')
          .eq('user_id', user.id)
          .eq('walk_id', walkId)
          .neq('id', walkId)

        previousIds = (previouslyLinked || []).map((r: { id: string }) => r.id)

        // 2) 이전에 이 산책에 연결되었던 로그의 walk_id를 먼저 해제 (시간 변경 대응)
        if (previousIds.length > 0) {
          const { error: unlinkErr } = await supabase
            .from('daily_logs')
            .update({ walk_id: null })
            .eq('user_id', user.id)
            .eq('walk_id', walkId)
            .neq('id', walkId)
          if (unlinkErr) throw unlinkErr
        }

        // 3) 시작~종료 사이에 기록된 로그에 walk_id 할당
        let assignQuery = supabase
          .from('daily_logs')
          .update({ walk_id: walkId })
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .neq('category', 'walk')
          .neq('id', walkId)
          .gte('logged_at', walkStart)
          .lte('logged_at', walkEnd)

        if (walkPetId) {
          assignQuery = assignQuery.eq('pet_id', walkPetId)
        }

        const { error: assignErr } = await assignQuery
        if (assignErr) throw assignErr
      } catch (walkIdError) {
        console.error('Walk ID auto-assign error:', walkIdError)
        // 재할당 실패 시, 해제된 로그를 원래 walk_id로 복구
        if (previousIds.length > 0) {
          const { error: restoreErr } = await supabase
            .from('daily_logs')
            .update({ walk_id: walkId })
            .in('id', previousIds)
            .eq('user_id', user.id)
          if (restoreErr) {
            console.error('Walk ID restore failed:', restoreErr)
          }
        }
      }
    }

    // photo_urls를 Signed URL로 변환
    const processedData = {
      ...data,
      photo_urls: await convertPathsToSignedUrls(data.photo_urls)
    }

    return NextResponse.json({
      success: true,
      data: processedData as DailyLog
    })

  } catch (error) {
    console.error('Daily logs PATCH error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
