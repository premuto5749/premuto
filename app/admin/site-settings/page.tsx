'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AppHeader } from '@/components/layout/AppHeader'
import { Loader2, ShieldCheck, Save, RotateCcw, Globe, ImageIcon, Tag, Palette, ArrowLeft, Upload, X, FileImage } from 'lucide-react'
import type { SiteSettings } from '@/app/api/admin/site-settings/route'

const DEFAULT_SETTINGS: SiteSettings = {
  siteName: 'Mimo Health Log',
  siteDescription: '미모 건강 기록',
  faviconUrl: null,
  logoUrl: null,
  headerLogoUrl: null,
  loginBgImageUrl: null,
  ogImageUrl: null,
  keywords: ['반려동물', '건강기록', '혈액검사', '일일기록'],
  themeColor: '#ffffff',
  primaryColor: '#f97316',
  language: 'ko'
}

type AssetType = 'favicon' | 'logo' | 'headerLogo' | 'loginBgImage' | 'ogImage'

interface UploadState {
  uploading: boolean
  error: string | null
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
  const [uploadStates, setUploadStates] = useState<Record<AssetType, UploadState>>({
    favicon: { uploading: false, error: null },
    logo: { uploading: false, error: null },
    headerLogo: { uploading: false, error: null },
    loginBgImage: { uploading: false, error: null },
    ogImage: { uploading: false, error: null }
  })

  const faviconInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const headerLogoInputRef = useRef<HTMLInputElement>(null)
  const loginBgImageInputRef = useRef<HTMLInputElement>(null)
  const ogImageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const adminRes = await fetch('/api/admin/stats')
        if (adminRes.status === 403) {
          setError('관리자 권한이 필요합니다')
          setAuthorized(false)
          setLoading(false)
          return
        }

        setAuthorized(true)

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

  const handleUpload = async (assetType: AssetType, file: File) => {
    setUploadStates(prev => ({
      ...prev,
      [assetType]: { uploading: true, error: null }
    }))

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('assetType', assetType)

      const res = await fetch('/api/admin/site-assets', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '업로드 실패')
      }

      // 설정에 URL 업데이트
      const urlKey = assetType === 'favicon' ? 'faviconUrl'
        : assetType === 'logo' ? 'logoUrl'
        : assetType === 'headerLogo' ? 'headerLogoUrl'
        : assetType === 'loginBgImage' ? 'loginBgImageUrl'
        : 'ogImageUrl'

      setSettings(prev => ({ ...prev, [urlKey]: data.data.url }))
      const assetName = assetType === 'favicon' ? '파비콘'
        : assetType === 'logo' ? '로그인 로고'
        : assetType === 'headerLogo' ? '헤더 로고'
        : assetType === 'loginBgImage' ? '로그인 배경'
        : 'OG 이미지'
      setSuccess(`${assetName}가 업로드되었습니다`)
    } catch (err) {
      setUploadStates(prev => ({
        ...prev,
        [assetType]: { uploading: false, error: err instanceof Error ? err.message : '업로드 실패' }
      }))
    } finally {
      setUploadStates(prev => ({
        ...prev,
        [assetType]: { ...prev[assetType], uploading: false }
      }))
    }
  }

  const handleDeleteAsset = async (assetType: AssetType) => {
    try {
      const res = await fetch('/api/admin/site-assets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetType })
      })

      if (!res.ok) {
        throw new Error('삭제 실패')
      }

      const urlKey = assetType === 'favicon' ? 'faviconUrl'
        : assetType === 'logo' ? 'logoUrl'
        : assetType === 'headerLogo' ? 'headerLogoUrl'
        : assetType === 'loginBgImage' ? 'loginBgImageUrl'
        : 'ogImageUrl'

      setSettings(prev => ({ ...prev, [urlKey]: null }))
      setSuccess('이미지가 삭제되었습니다')
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제 실패')
    }
  }

  const handleFileChange = (assetType: AssetType, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleUpload(assetType, file)
    }
    e.target.value = ''
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
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

  const ImageUploadCard = ({
    assetType,
    title,
    description,
    imageUrl,
    inputRef,
    accept = 'image/*',
    previewSize = 'md'
  }: {
    assetType: AssetType
    title: string
    description: string
    imageUrl: string | null
    inputRef: React.RefObject<HTMLInputElement>
    accept?: string
    previewSize?: 'sm' | 'md' | 'lg' | 'horizontal' | 'square'
  }) => {
    const state = uploadStates[assetType]
    const sizeClass = previewSize === 'sm' ? 'w-16 h-16'
      : previewSize === 'lg' ? 'w-full max-w-md h-40'
      : previewSize === 'horizontal' ? 'w-48 h-12'
      : previewSize === 'square' ? 'w-[200px] h-[200px]'
      : 'w-24 h-24'

    return (
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <Label>{title}</Label>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>

        {imageUrl ? (
          <div className="flex items-center gap-4">
            <div className={`relative ${sizeClass} rounded border overflow-hidden bg-muted`}>
              <Image
                src={imageUrl}
                alt={title}
                fill
                className="object-contain"
                unoptimized
              />
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
                disabled={state.uploading}
              >
                {state.uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span className="ml-2">변경</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteAsset(assetType)}
                className="text-destructive hover:text-destructive"
              >
                <X className="w-4 h-4" />
                <span className="ml-2">삭제</span>
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={`${sizeClass} rounded border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors`}
            onClick={() => inputRef.current?.click()}
          >
            {state.uploading ? (
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <FileImage className="w-6 h-6 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">클릭하여 업로드</span>
              </>
            )}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={(e) => handleFileChange(assetType, e)}
          className="hidden"
        />

        {state.error && (
          <p className="text-xs text-destructive">{state.error}</p>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader title="사이트 설정" />

      <div className="container max-w-2xl mx-auto py-6 px-4">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => router.push('/admin')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          관리자 대시보드
        </Button>

        <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-lg flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-primary" />
          <div>
            <p className="font-medium text-primary">사이트 설정 관리</p>
            <p className="text-sm text-muted-foreground">
              파비콘, 로고, 메타태그, 검색 키워드 등을 설정합니다.
            </p>
          </div>
        </div>

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
              <ImageIcon className="w-5 h-5" />
              이미지 설정
            </CardTitle>
            <CardDescription>
              파비콘, 로고, 소셜 미디어 공유 이미지를 업로드합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ImageUploadCard
              assetType="favicon"
              title="파비콘"
              description="브라우저 탭에 표시되는 아이콘 (권장: 32x32px, ICO/PNG)"
              imageUrl={settings.faviconUrl}
              inputRef={faviconInputRef}
              accept="image/png,image/x-icon,image/jpeg"
              previewSize="sm"
            />

            <hr />

            <ImageUploadCard
              assetType="logo"
              title="로그인 로고 (정방형)"
              description="로그인 페이지에 표시 (권장: 200x200px)"
              imageUrl={settings.logoUrl}
              inputRef={logoInputRef}
              accept="image/png,image/svg+xml,image/jpeg"
              previewSize="square"
            />

            <hr />

            <ImageUploadCard
              assetType="headerLogo"
              title="헤더 로고 (가로형)"
              description="햄버거 메뉴 상단에 표시 (권장: 가로형, 높이 40px)"
              imageUrl={settings.headerLogoUrl}
              inputRef={headerLogoInputRef}
              accept="image/png,image/svg+xml,image/jpeg"
              previewSize="horizontal"
            />

            <hr />

            <ImageUploadCard
              assetType="loginBgImage"
              title="로그인 배경 이미지"
              description="로그인 페이지 우측 배경 (권장: 세로형, 최소 800x1200px)"
              imageUrl={settings.loginBgImageUrl}
              inputRef={loginBgImageInputRef}
              accept="image/png,image/jpeg,image/webp"
              previewSize="lg"
            />

            <hr />

            <ImageUploadCard
              assetType="ogImage"
              title="OG 이미지"
              description="소셜 미디어 공유 시 표시 (권장: 1200x630px)"
              imageUrl={settings.ogImageUrl}
              inputRef={ogImageInputRef}
              accept="image/png,image/jpeg,image/webp"
              previewSize="lg"
            />
          </CardContent>
        </Card>

        {/* 로고 사용처 안내 */}
        <Card className="mb-4 bg-blue-50/50 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-blue-800">로고 사용처</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-700 space-y-1">
            <p>• <strong>로그인 로고</strong>: 로그인 페이지 상단 (정방형 200x200px)</p>
            <p>• <strong>헤더 로고</strong>: 햄버거 메뉴 상단 (가로형, 높이 40px)</p>
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
              브라우저 및 UI 색상을 설정합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Primary 색상 (버튼, 강조)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="primaryColor"
                  type="color"
                  value={settings.primaryColor}
                  onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                  className="w-12 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={settings.primaryColor}
                  onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                  placeholder="#f97316"
                  className="max-w-[120px]"
                />
                <div
                  className="px-4 py-2 rounded text-white text-sm font-medium"
                  style={{ backgroundColor: settings.primaryColor }}
                >
                  버튼 미리보기
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                로그인 버튼, 강조 색상 등에 적용됩니다.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="themeColor">브라우저 테마 색상</Label>
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
          <CardContent className="text-sm space-y-3">
            {/* 헤더 미리보기 */}
            <div className="p-3 bg-muted rounded border">
              <p className="text-xs text-muted-foreground mb-2">헤더 메뉴 (40px)</p>
              <div className="flex items-center">
                {settings.headerLogoUrl ? (
                  <Image
                    src={settings.headerLogoUrl}
                    alt="Header Logo"
                    width={160}
                    height={40}
                    className="h-10 w-auto object-contain"
                    unoptimized
                  />
                ) : (
                  <span className="font-medium text-muted-foreground">(헤더 로고 없음)</span>
                )}
              </div>
            </div>
            {/* 로그인 페이지 미리보기 */}
            <div className="p-3 bg-muted rounded border text-center">
              <p className="text-xs text-muted-foreground mb-2">로그인 페이지 (200x200)</p>
              {settings.logoUrl && (
                <Image
                  src={settings.logoUrl}
                  alt="Logo"
                  width={200}
                  height={200}
                  className="w-[200px] h-[200px] object-contain mx-auto mb-2"
                  unoptimized
                />
              )}
              <p className="font-medium">{settings.siteName}</p>
            </div>
            {/* 키워드 */}
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
