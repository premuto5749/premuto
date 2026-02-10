/**
 * Google Drive REST API v3 클라이언트
 * - googleapis 패키지 없이 fetch로 직접 호출 (번들 크기 절약)
 * - AES-256-GCM 토큰 암호화
 * - 자동 토큰 갱신
 */
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3'
const GOOGLE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke'

// ============================================
// 토큰 암호화/복호화 (AES-256-GCM)
// ============================================

function getEncryptionKey(): Buffer {
  const secret = process.env.GOOGLE_DRIVE_TOKEN_SECRET?.trim()
  if (!secret) throw new Error('GOOGLE_DRIVE_TOKEN_SECRET not configured')
  return crypto.createHash('sha256').update(secret).digest()
}

export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // iv:tag:encrypted (all base64)
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`
}

export function decryptToken(ciphertext: string): string {
  const key = getEncryptionKey()
  const parts = ciphertext.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted token format')
  const iv = Buffer.from(parts[0], 'base64')
  const tag = Buffer.from(parts[1], 'base64')
  const encrypted = Buffer.from(parts[2], 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final('utf8')
}

// ============================================
// 토큰 갱신
// ============================================

interface DriveConnection {
  id: string
  user_id: string
  access_token: string
  refresh_token: string
  token_expires_at: string | null
}

async function refreshAccessToken(connection: DriveConnection): Promise<string> {
  const refreshToken = decryptToken(connection.refresh_token)

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID?.trim() || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET?.trim() || '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[GoogleDrive] Token refresh failed:', err)
    throw new Error('Failed to refresh Google access token')
  }

  const data = await res.json()
  const newAccessToken = data.access_token as string
  const expiresIn = data.expires_in as number // seconds

  // DB에 새 access_token 저장
  const supabase = await createClient()
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
  await supabase
    .from('google_drive_connections')
    .update({
      access_token: encryptToken(newAccessToken),
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.id)

  return newAccessToken
}

// ============================================
// 클라이언트 (access_token 획득)
// ============================================

export async function getClient(userId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('google_drive_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  if (error || !data) return null

  const connection = data as DriveConnection

  // 토큰 만료 체크 (5분 여유)
  const expiresAt = connection.token_expires_at
    ? new Date(connection.token_expires_at).getTime()
    : 0
  const isExpired = Date.now() > expiresAt - 5 * 60 * 1000

  if (isExpired) {
    try {
      return await refreshAccessToken(connection)
    } catch {
      console.error('[GoogleDrive] Token refresh failed for user:', userId)
      return null
    }
  }

  return decryptToken(connection.access_token)
}

// ============================================
// 폴더 관리
// ============================================

export async function ensureFolder(
  accessToken: string,
  parentId: string,
  folderName: string
): Promise<string> {
  // 1. 기존 폴더 검색
  const query = `name='${folderName.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const searchRes = await fetch(
    `${GOOGLE_DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (searchRes.ok) {
    const searchData = await searchRes.json()
    if (searchData.files?.length > 0) {
      return searchData.files[0].id
    }
  }

  // 2. 없으면 생성
  const createRes = await fetch(`${GOOGLE_DRIVE_API}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  })

  if (!createRes.ok) {
    const err = await createRes.text()
    throw new Error(`Failed to create folder "${folderName}": ${err}`)
  }

  const folderData = await createRes.json()
  return folderData.id
}

export async function ensureFolderPath(
  accessToken: string,
  rootId: string,
  pathSegments: string[]
): Promise<string> {
  let currentParentId = rootId
  for (const segment of pathSegments) {
    currentParentId = await ensureFolder(accessToken, currentParentId, segment)
  }
  return currentParentId
}

// ============================================
// 파일 업로드
// ============================================

export async function uploadFile(
  accessToken: string,
  folderId: string,
  fileName: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const boundary = '-------boundary' + Date.now()
  const metadata = JSON.stringify({
    name: fileName,
    parents: [folderId],
  })

  const bodyParts = [
    `--${boundary}\r\n`,
    'Content-Type: application/json; charset=UTF-8\r\n\r\n',
    metadata,
    `\r\n--${boundary}\r\n`,
    `Content-Type: ${mimeType}\r\n`,
    'Content-Transfer-Encoding: base64\r\n\r\n',
    buffer.toString('base64'),
    `\r\n--${boundary}--`,
  ]

  const body = bodyParts.join('')

  const res = await fetch(
    `${GOOGLE_UPLOAD_API}/files?uploadType=multipart&fields=id`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`File upload failed: ${err}`)
  }

  const data = await res.json()
  return data.id
}

// ============================================
// 루트 폴더 생성
// ============================================

export async function createRootFolder(accessToken: string): Promise<string> {
  // 기존 MIMOHARU 폴더 검색 (루트에서)
  const query = `name='MIMOHARU' and 'root' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const searchRes = await fetch(
    `${GOOGLE_DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (searchRes.ok) {
    const searchData = await searchRes.json()
    if (searchData.files?.length > 0) {
      return searchData.files[0].id
    }
  }

  // 없으면 생성
  const createRes = await fetch(`${GOOGLE_DRIVE_API}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'MIMOHARU',
      mimeType: 'application/vnd.google-apps.folder',
    }),
  })

  if (!createRes.ok) {
    throw new Error('Failed to create MIMOHARU root folder')
  }

  const data = await createRes.json()
  return data.id
}

// ============================================
// 파일 이동 (폴더 변경)
// ============================================

export async function moveFile(
  accessToken: string,
  fileId: string,
  newParentId: string,
  oldParentId: string
): Promise<void> {
  const res = await fetch(
    `${GOOGLE_DRIVE_API}/files/${fileId}?addParents=${newParentId}&removeParents=${oldParentId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to move file ${fileId}: ${err}`)
  }
}

// ============================================
// 토큰 취소
// ============================================

export async function revokeToken(accessToken: string): Promise<void> {
  try {
    await fetch(`${GOOGLE_REVOKE_URL}?token=${accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
  } catch {
    // 토큰 취소 실패는 무시 (이미 만료되었을 수 있음)
    console.warn('[GoogleDrive] Token revocation failed (may already be expired)')
  }
}
