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
const CATEGORY_LABEL_KO: Record<string, string> = {
  meal: '식사',
  water: '음수',
  snack: '간식',
  medicine: '약',
  poop: '배변',
  pee: '배뇨',
  breathing: '호흡수',
}

export async function triggerDailyLogDriveBackup(
  userId: string,
  petId: string,
  loggedAt: string,
  photoUrls: string[],
  logId: string,
  category?: string
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

    // Drive 파일명 생성: {날짜}_{시분}_{카테고리}_{순번}.{확장자}
    const dateStr = loggedAt.split('T')[0] || 'unknown-date'
    const timePart = loggedAt.includes('T') ? loggedAt.split('T')[1]?.slice(0, 5).replace(':', '') : ''
    const timeStr = timePart ? `_${timePart}` : ''
    const categoryStr = category ? `_${CATEGORY_LABEL_KO[category] || category}` : ''

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
      const origName = pathOrUrl.split('/').pop() || ''
      const ext = origName.includes('.') ? origName.slice(origName.lastIndexOf('.')) : '.jpg'
      const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg'

      // Drive 파일명: 2025-12-08_1430_식사_1.jpg
      const seq = photoUrls.length > 1 ? `_${i + 1}` : ''
      const driveFileName = `${dateStr}${timeStr}${categoryStr}${seq}${ext}`

      await uploadDailyLogPhotoToDrive(
        userId,
        pet.name,
        loggedAt,
        driveFileName,
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
 * OCR 원본 → Drive 백업 트리거 (스테이징에서)
 * Supabase Storage 스테이징에서 파일을 다운로드 → Drive 업로드 → 스테이징 삭제
 * 저장 시점에 호출되므로 최종 날짜/병원 정보가 정확함
 */
export async function triggerOcrSourceDriveBackupFromStaging(
  userId: string,
  petId: string,
  testDate: string,
  hospitalName: string | null,
  ocrBatchId: string,
  uploadedFiles: Array<{ filename: string }>
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

    // Drive 파일명 생성: {날짜}_{병원}_{순번}.{확장자}
    const dateStr = testDate.split('T')[0] || 'unknown-date'
    const hospitalSuffix = hospitalName ? `_${hospitalName}` : ''

    // 각 파일을 스테이징에서 다운로드 → Drive 업로드
    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i]
      const storagePath = `${userId}/${ocrBatchId}/${file.filename}`

      // 스테이징에서 다운로드
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('ocr-staging')
        .download(storagePath)

      if (downloadError || !fileData) {
        console.error(`[GoogleDrive] Failed to download staging file: ${storagePath}`, downloadError?.message)
        continue
      }

      const buffer = Buffer.from(await fileData.arrayBuffer())
      const ext = file.filename.includes('.') ? file.filename.slice(file.filename.lastIndexOf('.')) : '.jpg'
      const mimeType = ext === '.pdf' ? 'application/pdf'
        : ext === '.png' ? 'image/png'
        : 'image/jpeg'

      // Drive 파일명: 2025-12-08_서울동물병원_1.jpg
      const seq = uploadedFiles.length > 1 ? `_${i + 1}` : ''
      const driveFileName = `${dateStr}${hospitalSuffix}${seq}${ext}`

      await uploadOcrSourceToDrive(
        userId,
        pet.name,
        testDate,
        hospitalName,
        driveFileName,
        buffer,
        mimeType,
        ocrBatchId
      )
    }

    // 스테이징 파일 정리
    await cleanupStagingFiles(userId, ocrBatchId)
  } catch (err) {
    console.error('[GoogleDrive] triggerOcrSourceDriveBackupFromStaging error:', err)
    // 에러가 나도 스테이징 정리 시도
    try { await cleanupStagingFiles(userId, ocrBatchId) } catch { /* ignore */ }
  }
}

/**
 * 스테이징 파일 정리
 * Drive 업로드 완료 후 또는 에러 시 호출
 */
export async function cleanupStagingFiles(
  userId: string,
  ocrBatchId: string
): Promise<void> {
  try {
    const supabase = await createClient()
    const prefix = `${userId}/${ocrBatchId}/`

    // 스테이징 폴더 내 파일 목록 조회
    const { data: files, error: listError } = await supabase.storage
      .from('ocr-staging')
      .list(`${userId}/${ocrBatchId}`)

    if (listError || !files || files.length === 0) return

    // 모든 파일 삭제
    const filePaths = files.map(f => `${prefix}${f.name}`)
    const { error: deleteError } = await supabase.storage
      .from('ocr-staging')
      .remove(filePaths)

    if (deleteError) {
      console.error('[Staging] Cleanup failed:', deleteError.message)
    } else {
      console.log(`[Staging] Cleaned up ${filePaths.length} files for batch ${ocrBatchId}`)
    }
  } catch (err) {
    console.error('[Staging] Cleanup error:', err)
  }
}

/**
 * Drive 파일을 새 폴더로 이동 (병합 시 사용)
 * google_drive_sync_log에서 파일 정보 조회 → Drive API로 이동
 */
export async function moveDriveFilesToFolder(
  userId: string,
  petId: string,
  sourceBatchUploadId: string,
  targetDate: string,
  targetHospital: string | null
): Promise<void> {
  try {
    if (!(await hasActiveDriveConnection(userId))) return
    if (!(await isDriveEnabledForUser(userId))) return

    const { moveFile } = await import('@/lib/google-drive')

    const supabase = await createClient()

    // pet 이름 조회
    const { data: pet } = await supabase
      .from('pets')
      .select('name')
      .eq('id', petId)
      .single()

    if (!pet) return

    // source record의 Drive 파일 조회
    const { data: syncLogs, error: logError } = await supabase
      .from('google_drive_sync_log')
      .select('id, drive_file_id, drive_folder_path')
      .eq('user_id', userId)
      .eq('source_type', 'ocr_source')
      .eq('source_id', sourceBatchUploadId)
      .eq('status', 'success')

    if (logError || !syncLogs || syncLogs.length === 0) {
      console.log('[GoogleDrive] No Drive files found for merge source:', sourceBatchUploadId)
      return
    }

    const accessToken = await getClient(userId)
    if (!accessToken) return

    // root folder 조회
    const { data: conn } = await supabase
      .from('google_drive_connections')
      .select('root_folder_id')
      .eq('user_id', userId)
      .single()

    if (!conn?.root_folder_id) return

    // target 폴더 확보
    const dateStr = targetDate.split('T')[0] || 'unknown-date'
    const folderName = targetHospital ? `${dateStr}_${targetHospital}` : dateStr
    const targetFolderId = await ensureFolderPath(accessToken, conn.root_folder_id, [
      pet.name,
      '혈액검사',
      folderName,
    ])
    const targetFolderPath = `MIMOHARU/${pet.name}/혈액검사/${folderName}`

    // 각 파일 이동
    for (const log of syncLogs) {
      if (!log.drive_file_id) continue

      try {
        // 기존 폴더 경로에서 부모 폴더 ID 추출 (현재 폴더에서 제거하기 위해)
        // 기존 폴더 경로로 ID를 찾기보다, Drive API의 파일 parents 조회
        const fileRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${log.drive_file_id}?fields=parents`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )

        if (!fileRes.ok) {
          console.error(`[GoogleDrive] Failed to get file parents: ${log.drive_file_id}`)
          continue
        }

        const fileData = await fileRes.json()
        const oldParentId = fileData.parents?.[0]

        if (!oldParentId || oldParentId === targetFolderId) continue // 이미 같은 폴더

        await moveFile(accessToken, log.drive_file_id, targetFolderId, oldParentId)

        // sync_log 업데이트
        await supabase
          .from('google_drive_sync_log')
          .update({ drive_folder_path: targetFolderPath })
          .eq('id', log.id)

        console.log(`[GoogleDrive] Moved file ${log.drive_file_id} to ${targetFolderPath}`)
      } catch (err) {
        console.error(`[GoogleDrive] Failed to move file ${log.drive_file_id}:`, err)
      }
    }
  } catch (err) {
    console.error('[GoogleDrive] moveDriveFilesToFolder error:', err)
  }
}
