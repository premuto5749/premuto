'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AppHeader } from '@/components/layout/AppHeader'
import { Loader2, ShieldCheck, Save, RotateCcw } from 'lucide-react'

const DEFAULT_MAX_TOKENS = 8000

export default function OcrSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [maxTokens, setMaxTokens] = useState(DEFAULT_MAX_TOKENS)

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

        if (data.success && data.data.quick_upload) {
          setMaxTokens(data.data.quick_upload.maxTokens || DEFAULT_MAX_TOKENS)
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
      // 고정 압축 설정과 함께 저장
      const settingsData = {
        maxSizeMB: 1,
        initialQuality: 0.85,
        maxFiles: 5,
        maxTokens: maxTokens
      }

      const res = await fetch('/api/admin/ocr-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quick_upload: settingsData,
          batch_upload: { ...settingsData, maxFiles: 10 }
        })
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
    setMaxTokens(DEFAULT_MAX_TOKENS)
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

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader title="OCR 설정" />

      <div className="container max-w-2xl mx-auto py-6 px-4">
        {/* 관리자 배지 */}
        <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-lg flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-primary" />
          <div>
            <p className="font-medium text-primary">OCR 설정 관리</p>
            <p className="text-sm text-muted-foreground">
              AI 출력 토큰 설정을 조정합니다. 변경 후 새로운 업로드부터 적용됩니다.
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
        <Card>
          <CardHeader>
            <CardTitle>AI 최대 토큰 (max_tokens)</CardTitle>
            <CardDescription>
              Claude API의 max_tokens 값입니다. 클수록 많은 검사 항목을 추출할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="maxTokens">
                max_tokens
                <span className="text-xs text-muted-foreground ml-2">1000~32000</span>
              </Label>
              <Input
                id="maxTokens"
                type="number"
                step="1000"
                min="1000"
                max="32000"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value) || DEFAULT_MAX_TOKENS)}
                className="max-w-xs"
              />
              <p className="text-xs text-muted-foreground">
                기본값: 8000 | 항목이 많은 검사지: 12000~16000 권장
              </p>
            </div>
          </CardContent>
        </Card>

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
            기본값
          </Button>
        </div>

        {/* 참고 정보 */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-sm">고정된 클라이언트 설정</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>이미지 압축: 1MB, 2400px, 품질 0.85</p>
            <p>간편 업로드 최대 파일: 5개</p>
            <p>일괄 업로드 최대 파일: 10개</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
