/**
 * Google Drive 업로드 헬퍼
 * - 일일기록 사진 → Drive 업로드
 * - OCR 원본 → Drive 업로드
 * - 모든 에러는 내부에서 catch (fire-and-forget)
 */
import { createClient } from '@/lib/supabase/server'
import { getClient, ensureFolderPath, uploadFile } from '@/lib/google-drive'
import { getUserTier, getTierConfig } from '@/lib/tier'

// ============================================
// Drive 연결 여부 확인
// ============================================

export async function hasActiveDriveConnection(userId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('google_drive_connections')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  return !error && !!data
}

// ============================================
// 동기화 로그 기록
// ============================================

async function createSyncLog(
  userId: string,
  sourceType: 'daily_log_photo' | 'ocr_source',
  fileName: string,
  sourceId?: string
): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('google_drive_sync_log')
    .insert({
      user_id: userId,
      source_type: sourceType,
      source_id: sourceId || null,
      file_name: fileName,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) {
    console.error('[GoogleDrive] Failed to create sync log:', error.message)
    return null
  }
  return data.id
}

async function updateSyncLog(
  logId: string,
  status: 'uploading' | 'success' | 'failed',
  driveFileId?: string,
  driveFolderPath?: string,
  errorMessage?: string
): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('google_drive_sync_log')
    .update({
      status,
      drive_file_id: driveFileId || null,
      drive_folder_path: driveFolderPath || null,
      error_message: errorMessage || null,
    })
    .eq('id', logId)
}

async function updateLastSyncAt(userId: string): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('google_drive_connections')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('user_id', userId)
}

// ============================================
// Tier 확인
// ============================================

async function isDriveEnabledForUser(userId: string): Promise<boolean> {
  const [tierName, tierConfigMap] = await Promise.all([
    getUserTier(userId),
    getTierConfig(),
  ])
  const config = tierConfigMap[tierName]
  return config.google_drive_enabled === true
}

// ============================================
// 일일기록 사진 → Drive 업로드
// ============================================

export async function uploadDailyLogPhotoToDrive(
  userId: string,
  petName: string,
  date: string,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string,
  sourceLogId: string
): Promise<void> {
  const logId = await createSyncLog(userId, 'daily_log_photo', fileName, sourceLogId)
  if (!logId) return

  try {
    await updateSyncLog(logId, 'uploading')

    const accessToken = await getClient(userId)
    if (!accessToken) throw new Error('No active Drive connection')

    // 루트 폴더 ID 조회
    const supabase = await createClient()
    const { data: conn } = await supabase
      .from('google_drive_connections')
      .select('root_folder_id')
      .eq('user_id', userId)
      .single()

    if (!conn?.root_folder_id) throw new Error('Root folder not found')

    // 날짜 형식 정리 (YYYY-MM-DD)
    const dateStr = date.split('T')[0]

    // 폴더 경로: MIMOHARU/{petName}/일일기록/{date}/
    const folderId = await ensureFolderPath(accessToken, conn.root_folder_id, [
      petName,
      '일일기록',
      dateStr,
    ])

    const driveFileId = await uploadFile(accessToken, folderId, fileName, fileBuffer, mimeType)
    const folderPath = `MIMOHARU/${petName}/일일기록/${dateStr}`

    await updateSyncLog(logId, 'success', driveFileId, folderPath)
    await updateLastSyncAt(userId)

    console.log(`[GoogleDrive] Daily log photo uploaded: ${folderPath}/${fileName}`)
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[GoogleDrive] Daily log photo upload failed:`, errorMsg)
    await updateSyncLog(logId, 'failed', undefined, undefined, errorMsg)
  }
}

// ============================================
// OCR 원본 → Drive 업로드
// ============================================

export async function uploadOcrSourceToDrive(
  userId: string,
  petName: string,
  testDate: string,
  hospitalName: string | null,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string,
  batchId: string
): Promise<void> {
  const logId = await createSyncLog(userId, 'ocr_source', fileName, batchId)
  if (!logId) return

  try {
    await updateSyncLog(logId, 'uploading')

    const accessToken = await getClient(userId)
    if (!accessToken) throw new Error('No active Drive connection')

    const supabase = await createClient()
    const { data: conn } = await supabase
      .from('google_drive_connections')
      .select('root_folder_id')
      .eq('user_id', userId)
      .single()

    if (!conn?.root_folder_id) throw new Error('Root folder not found')

    // 폴더명: {date}_{hospital} 또는 {date}
    const dateStr = testDate.split('T')[0] || 'unknown-date'
    const folderName = hospitalName ? `${dateStr}_${hospitalName}` : dateStr

    // 폴더 경로: MIMOHARU/{petName}/혈액검사/{date}_{hospital}/
    const folderId = await ensureFolderPath(accessToken, conn.root_folder_id, [
      petName,
      '혈액검사',
      folderName,
    ])

    const driveFileId = await uploadFile(accessToken, folderId, fileName, fileBuffer, mimeType)
    const folderPath = `MIMOHARU/${petName}/혈액검사/${folderName}`

    await updateSyncLog(logId, 'success', driveFileId, folderPath)
    await updateLastSyncAt(userId)

    console.log(`[GoogleDrive] OCR source uploaded: ${folderPath}/${fileName}`)
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[GoogleDrive] OCR source upload failed:`, errorMsg)
    await updateSyncLog(logId, 'failed', undefined, undefined, errorMsg)
  }
}

// ============================================
// 트리거 함수 (기존 API에서 호출)
// ============================================

/**
 * 일일기록 사진 → Drive 백업 트리거
 * Supabase Storage에서 다운로드 → Drive로 업로드
 */
export async function triggerDailyLogDriveBackup(
  userId: string,
  petId: string,
  loggedAt: string,
  photoUrls: string[],
  logId: string
): Promise<void> {
  try {
    // Drive 연결 확인
    if (!(await hasActiveDriveConnection(userId))) return

    // Tier 확인
    if (!(await isDriveEnabledForUser(userId))) return

    // pet 이름 조회
    const supabase = await createClient()
    const { data: pet } = await supabase
      .from('pets')
      .select('name')
      .eq('id', petId)
      .single()

    if (!pet) return

    const BUCKET_NAME = 'daily-log-photos'

    for (let i = 0; i < photoUrls.length; i++) {
      const pathOrUrl = photoUrls[i]

      // 이미 URL인 경우 (하위 호환), Signed URL에서 path 추출 불가 → skip
      if (pathOrUrl.startsWith('http')) continue

      // Storage path에서 파일 다운로드
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(BUCKET_NAME)
        .download(pathOrUrl)

      if (downloadError || !fileData) {
        console.error(`[GoogleDrive] Failed to download photo: ${pathOrUrl}`, downloadError?.message)
        continue
      }

      const buffer = Buffer.from(await fileData.arrayBuffer())
      const fileName = pathOrUrl.split('/').pop() || `photo_${i}.jpg`
      const mimeType = fileName.endsWith('.png') ? 'image/png' : 'image/jpeg'

      await uploadDailyLogPhotoToDrive(
        userId,
        pet.name,
        loggedAt,
        fileName,
        buffer,
        mimeType,
        logId
      )
    }
  } catch (err) {
    console.error('[GoogleDrive] triggerDailyLogDriveBackup error:', err)
  }
}

/**
 * OCR 원본 → Drive 백업 트리거
 * 메모리에 캡처한 파일 버퍼를 직접 업로드
 */
export async function triggerOcrSourceDriveBackup(
  userId: string,
  petId: string,
  testDate: string,
  hospitalName: string | null,
  fileBuffers: Map<string, { buffer: Buffer; mimeType: string }>,
  batchId: string
): Promise<void> {
  try {
    if (!(await hasActiveDriveConnection(userId))) return
    if (!(await isDriveEnabledForUser(userId))) return

    const supabase = await createClient()
    const { data: pet } = await supabase
      .from('pets')
      .select('name')
      .eq('id', petId)
      .single()

    if (!pet) return

    for (const [fileName, { buffer, mimeType }] of fileBuffers) {
      await uploadOcrSourceToDrive(
        userId,
        pet.name,
        testDate,
        hospitalName,
        fileName,
        buffer,
        mimeType,
        batchId
      )
    }
  } catch (err) {
    console.error('[GoogleDrive] triggerOcrSourceDriveBackup error:', err)
  }
}
