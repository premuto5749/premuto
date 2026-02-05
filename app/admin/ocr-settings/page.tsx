'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AppHeader } from '@/components/layout/AppHeader'
import { Loader2, ShieldCheck, Save, RotateCcw, Zap, FileText } from 'lucide-react'
import type { OcrSettings, OcrSettingsResponse } from '@/app/api/admin/ocr-settings/route'

export default function OcrSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [quickSettings, setQuickSettings] = useState<OcrSettings>({
    maxSizeMB: 1,
    initialQuality: 0.85,
    maxFiles: 5,
    maxTokens: 8000
  })

  const [batchSettings, setBatchSettings] = useState<OcrSettings>({
    maxSizeMB: 1,
    initialQuality: 0.85,
    maxFiles: 10,
    maxTokens: 8000
  })

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
        const res = await fetch('/api/admin/ocr-settings')
        const data = await res.json()

        if (data.success) {
          setQuickSettings(data.data.quick_upload)
          setBatchSettings(data.data.batch_upload)
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
      const res = await fetch('/api/admin/ocr-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quick_upload: quickSettings,
          batch_upload: batchSettings
        } as OcrSettingsResponse)
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '저장 실패')
      }

      setSuccess('설정이 저장되었습니다. 새로운 업로드부터 적용됩니다.')
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setQuickSettings({
      maxSizeMB: 1,
      initialQuality: 0.85,
      maxFiles: 5,
      maxTokens: 8000
    })
    setBatchSettings({
      maxSizeMB: 1,
      initialQuality: 0.85,
      maxFiles: 10,
      maxTokens: 8000
    })
    setSuccess(null)
    setError(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-muted">
        <AppHeader title="OCR 설정" />
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-muted">
        <AppHeader title="OCR 설정" />
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

  const SettingsCard = ({
    title,
    description,
    icon: Icon,
    settings,
    setSettings
  }: {
    title: string
    description: string
    icon: React.ElementType
    settings: OcrSettings
    setSettings: React.Dispatch<React.SetStateAction<OcrSettings>>
  }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className="w-5 h-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`${title}-maxSizeMB`}>
              최대 파일 크기 (MB)
              <span className="text-xs text-muted-foreground ml-2">0.1~10</span>
            </Label>
            <Input
              id={`${title}-maxSizeMB`}
              type="number"
              step="0.1"
              min="0.1"
              max="10"
              value={settings.maxSizeMB}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                maxSizeMB: parseFloat(e.target.value) || 1
              }))}
            />
            <p className="text-xs text-muted-foreground">
              압축 후 최대 크기. 클수록 인식률 ↑, 속도 ↓
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${title}-initialQuality`}>
              이미지 품질
              <span className="text-xs text-muted-foreground ml-2">0.1~1.0</span>
            </Label>
            <Input
              id={`${title}-initialQuality`}
              type="number"
              step="0.05"
              min="0.1"
              max="1"
              value={settings.initialQuality}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                initialQuality: parseFloat(e.target.value) || 0.85
              }))}
            />
            <p className="text-xs text-muted-foreground">
              JPEG 품질. 1.0 = 최고 품질
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${title}-maxFiles`}>
              최대 파일 수
              <span className="text-xs text-muted-foreground ml-2">1~20</span>
            </Label>
            <Input
              id={`${title}-maxFiles`}
              type="number"
              min="1"
              max="20"
              value={settings.maxFiles}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                maxFiles: parseInt(e.target.value) || 5
              }))}
            />
            <p className="text-xs text-muted-foreground">
              한 번에 업로드 가능한 최대 파일 수
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${title}-maxTokens`}>
              AI 최대 토큰
              <span className="text-xs text-muted-foreground ml-2">1000~32000</span>
            </Label>
            <Input
              id={`${title}-maxTokens`}
              type="number"
              step="1000"
              min="1000"
              max="32000"
              value={settings.maxTokens}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                maxTokens: parseInt(e.target.value) || 8000
              }))}
            />
            <p className="text-xs text-muted-foreground">
              Claude API max_tokens. 클수록 많은 항목 추출 가능
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader title="OCR 설정" />

      <div className="container max-w-4xl mx-auto py-6 px-4">
        {/* 관리자 배지 */}
        <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-lg flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-primary" />
          <div>
            <p className="font-medium text-primary">OCR 설정 관리</p>
            <p className="text-sm text-muted-foreground">
              이미지 압축 및 AI 처리 설정을 조정합니다. 변경 후 새로운 업로드부터 적용됩니다.
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

        {/* 설정 카드 */}
        <div className="space-y-6">
          <SettingsCard
            title="간편 업로드"
            description="단일 검사일 업로드 설정 (/upload-quick)"
            icon={Zap}
            settings={quickSettings}
            setSettings={setQuickSettings}
          />

          <SettingsCard
            title="일괄 업로드"
            description="다중 파일 일괄 업로드 설정 (/upload)"
            icon={FileText}
            settings={batchSettings}
            setSettings={setBatchSettings}
          />
        </div>

        {/* 액션 버튼 */}
        <div className="mt-6 flex gap-4">
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
            기본값으로 초기화
          </Button>
        </div>

        {/* 참고 정보 */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-sm">설정 가이드</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p><strong>인식률 우선:</strong> maxSizeMB ↑, initialQuality ↑, maxTokens ↑</p>
            <p><strong>속도 우선:</strong> maxSizeMB ↓, initialQuality ↓, maxTokens ↓</p>
            <p><strong>균형 추천:</strong> maxSizeMB=1, initialQuality=0.85, maxTokens=8000</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
