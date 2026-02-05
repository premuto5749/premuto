'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AppHeader } from '@/components/layout/AppHeader'
import { Loader2, ShieldCheck, Save, RotateCcw, Globe, Image, Tag, Palette, ArrowLeft } from 'lucide-react'
import type { SiteSettings } from '@/app/api/admin/site-settings/route'

const DEFAULT_SETTINGS: SiteSettings = {
  siteName: 'Mimo Health Log',
  siteDescription: '미모 건강 기록',
  faviconUrl: null,
  ogImageUrl: null,
  keywords: ['반려동물', '건강기록', '혈액검사', '일일기록'],
  themeColor: '#ffffff',
  language: 'ko'
}

export default function SiteSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS)
  const [keywordsText, setKeywordsText] = useState('')

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // 관리자 권한 확인
        const adminRes = await fetch('/api/admin/stats')
        if (adminRes.status === 403) {
          setError('관리자 권한이 필요합니다')
          setAuthorized(false)
          setLoading(false)
          return
        }

        setAuthorized(true)

        // 설정 조회
        const res = await fetch('/api/admin/site-settings')
        const data = await res.json()

        if (data.success && data.data) {
          setSettings(data.data)
          setKeywordsText(data.data.keywords?.join(', ') || '')
        }
      } catch (err) {
        console.error('Failed to fetch settings:', err)
        setError('설정을 불러오는데 실패했습니다')
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      // 키워드 파싱
      const keywords = keywordsText
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0)

      const settingsToSave: SiteSettings = {
        ...settings,
        keywords
      }

      const res = await fetch('/api/admin/site-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsToSave)
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '저장 실패')
      }

      setSettings(data.data)
      setSuccess('설정이 저장되었습니다. 새로고침 후 적용됩니다.')
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS)
    setKeywordsText(DEFAULT_SETTINGS.keywords.join(', '))
    setSuccess(null)
    setError(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-muted">
        <AppHeader title="사이트 설정" />
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-muted">
        <AppHeader title="사이트 설정" />
        <div className="container max-w-4xl mx-auto py-10 px-4">
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <ShieldCheck className="w-5 h-5" />
                접근 권한 없음
              </CardTitle>
              <CardDescription>
                {error || '이 페이지에 접근할 권한이 없습니다.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/admin')}>
                관리자 대시보드로 돌아가기
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader title="사이트 설정" />

      <div className="container max-w-2xl mx-auto py-6 px-4">
        {/* 뒤로가기 */}
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => router.push('/admin')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          관리자 대시보드
        </Button>

        {/* 관리자 배지 */}
        <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-lg flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-primary" />
          <div>
            <p className="font-medium text-primary">사이트 설정 관리</p>
            <p className="text-sm text-muted-foreground">
              파비콘, 메타태그, 검색 키워드 등을 설정합니다.
            </p>
          </div>
        </div>

        {/* 에러/성공 메시지 */}
        {error && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-700">
            {success}
          </div>
        )}

        {/* 기본 정보 */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              기본 정보
            </CardTitle>
            <CardDescription>
              사이트 이름과 설명을 설정합니다. 브라우저 탭과 검색 결과에 표시됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="siteName">사이트 이름</Label>
              <Input
                id="siteName"
                value={settings.siteName}
                onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                placeholder="Mimo Health Log"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="siteDescription">사이트 설명</Label>
              <Textarea
                id="siteDescription"
                value={settings.siteDescription}
                onChange={(e) => setSettings({ ...settings, siteDescription: e.target.value })}
                placeholder="반려동물 건강 기록 서비스"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">언어 코드</Label>
              <Input
                id="language"
                value={settings.language}
                onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                placeholder="ko"
                className="max-w-[100px]"
              />
              <p className="text-xs text-muted-foreground">
                HTML lang 속성 (예: ko, en, ja)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 이미지 설정 */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="w-5 h-5" />
              이미지 설정
            </CardTitle>
            <CardDescription>
              파비콘과 소셜 미디어 공유 이미지를 설정합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="faviconUrl">파비콘 URL</Label>
              <Input
                id="faviconUrl"
                value={settings.faviconUrl || ''}
                onChange={(e) => setSettings({ ...settings, faviconUrl: e.target.value || null })}
                placeholder="/favicon.ico 또는 외부 URL"
              />
              <p className="text-xs text-muted-foreground">
                비워두면 기본 파비콘(/favicon.ico)을 사용합니다.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ogImageUrl">OG 이미지 URL</Label>
              <Input
                id="ogImageUrl"
                value={settings.ogImageUrl || ''}
                onChange={(e) => setSettings({ ...settings, ogImageUrl: e.target.value || null })}
                placeholder="https://example.com/og-image.png"
              />
              <p className="text-xs text-muted-foreground">
                소셜 미디어에서 공유할 때 표시되는 이미지입니다. 권장 크기: 1200x630px
              </p>
            </div>
          </CardContent>
        </Card>

        {/* SEO 설정 */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5" />
              SEO 설정
            </CardTitle>
            <CardDescription>
              검색 엔진 최적화를 위한 키워드를 설정합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="keywords">검색 키워드</Label>
              <Textarea
                id="keywords"
                value={keywordsText}
                onChange={(e) => setKeywordsText(e.target.value)}
                placeholder="반려동물, 건강기록, 혈액검사"
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                쉼표(,)로 구분하여 입력합니다.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 테마 설정 */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              테마 설정
            </CardTitle>
            <CardDescription>
              브라우저 테마 색상을 설정합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="themeColor">테마 색상</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="themeColor"
                  type="color"
                  value={settings.themeColor}
                  onChange={(e) => setSettings({ ...settings, themeColor: e.target.value })}
                  className="w-12 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={settings.themeColor}
                  onChange={(e) => setSettings({ ...settings, themeColor: e.target.value })}
                  placeholder="#ffffff"
                  className="max-w-[120px]"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                모바일 브라우저 주소창 색상에 적용됩니다.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 액션 버튼 */}
        <div className="flex gap-4">
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                저장 중...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                설정 저장
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            기본값
          </Button>
        </div>

        {/* 미리보기 */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-sm">미리보기</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="p-3 bg-muted rounded border">
              <p className="font-medium">{settings.siteName}</p>
              <p className="text-muted-foreground text-xs">{settings.siteDescription}</p>
            </div>
            <div className="flex flex-wrap gap-1">
              {settings.keywords.map((k, i) => (
                <span key={i} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded">
                  {k}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
