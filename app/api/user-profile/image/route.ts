import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/with-auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/user-profile/image
 * 프로필 이미지 업로드
 */
export const POST = withAuth(async (request, { supabase, user }) => {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: '파일이 필요합니다' }, { status: 400 })
    }

    // 이미지 파일만 허용
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: '이미지 파일만 업로드 가능합니다' }, { status: 400 })
    }

    // 5MB 제한
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: '파일 크기는 5MB 이하여야 합니다' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() || 'jpg'
    const filePath = `${user.id}/profile.${ext}`

    // 기존 프로필 이미지 삭제 (있으면)
    const { data: existingFiles } = await supabase.storage
      .from('uploads')
      .list(user.id, { search: 'profile.' })
    if (existingFiles && existingFiles.length > 0) {
      const toRemove = existingFiles
        .filter(f => f.name.startsWith('profile.'))
        .map(f => `${user.id}/${f.name}`)
      if (toRemove.length > 0) {
        await supabase.storage.from('uploads').remove(toRemove)
      }
    }

    // 업로드
    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(filePath, file, { upsert: true })

    if (uploadError) {
      console.error('Profile image upload error:', uploadError)
      return NextResponse.json({ error: '업로드에 실패했습니다' }, { status: 500 })
    }

    // Signed URL 생성 (7일)
    const { data: signedData } = await supabase.storage
      .from('uploads')
      .createSignedUrl(filePath, 60 * 60 * 24 * 7)

    const imageUrl = signedData?.signedUrl || null

    // user_profiles에 저장 (Storage path 저장)
    await supabase
      .from('user_profiles')
      .update({ profile_image: filePath })
      .eq('user_id', user.id)

    return NextResponse.json({ success: true, data: { profile_image: imageUrl, path: filePath } })
  } catch (error) {
    console.error('Profile image upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

/**
 * DELETE /api/user-profile/image
 * 프로필 이미지 삭제
 */
export const DELETE = withAuth(async (request, { supabase, user }) => {
  try {
    // 기존 프로필 이미지 삭제
    const { data: existingFiles } = await supabase.storage
      .from('uploads')
      .list(user.id, { search: 'profile.' })
    if (existingFiles && existingFiles.length > 0) {
      const toRemove = existingFiles
        .filter(f => f.name.startsWith('profile.'))
        .map(f => `${user.id}/${f.name}`)
      if (toRemove.length > 0) {
        await supabase.storage.from('uploads').remove(toRemove)
      }
    }

    // user_profiles에서 이미지 URL 제거
    await supabase
      .from('user_profiles')
      .update({ profile_image: null })
      .eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Profile image delete error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
