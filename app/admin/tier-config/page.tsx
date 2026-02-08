'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AppHeader } from '@/components/layout/AppHeader'
import { Loader2, Save, ShieldCheck, RotateCcw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface TierConfig {
  label: string
  daily_ocr_limit: number
  max_files_per_ocr: number
  daily_log_max_photos: number
  daily_log_max_photo_size_mb: number
  monthly_detailed_export_limit: number
  daily_description_gen_limit: number
  daily_excel_export_limit: number
  weekly_photo_export_limit: number
}

type TierConfigMap = Record<string, TierConfig>

const TIER_KEYS = ['free', 'basic', 'premium'] as const

const FIELD_LABELS: Record<string, { label: string; description: string }> = {
  label: { label: '표시 이름', description: '사용자에게 보이는 등급명' },
  daily_ocr_limit: { label: '일일 OCR 분석 횟수', description: '-1 = 무제한' },
  max_files_per_ocr: { label: 'OCR 1회당 최대 파일 수', description: '업로드 시 파일 개수 제한' },
  daily_log_max_photos: { label: '일일 기록 사진 수', description: '1회 업로드 시 최대 사진 수' },
  daily_log_max_photo_size_mb: { label: '사진 최대 크기 (MB)', description: '개별 사진 파일 크기 제한' },
  monthly_detailed_export_limit: { label: '월간 상세 내보내기 횟수', description: '-1 = 무제한 (레거시)' },
  daily_description_gen_limit: { label: 'AI 설명 생성 횟수', description: '-1 = 무제한, 0 = 잠금' },
  daily_excel_export_limit: { label: '일일 엑셀 내보내기 횟수', description: '-1 = 무제한' },
  weekly_photo_export_limit: { label: '주간 사진 내보내기 횟수', description: '-1 = 무제한' },
}

export default function TierConfigPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [config, setConfig] = useState<TierConfigMap | null>(null)
  const [originalConfig, setOriginalConfig] = useState<TierConfigMap | null>(null)

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/admin/tier-config')
      if (res.status === 403) {
        setAuthorized(false)
        setLoading(false)
        return
      }
      const result = await res.json()
      if (result.success) {
        setAuthorized(true)
        setConfig(result.data)
        setOriginalConfig(JSON.parse(JSON.stringify(result.data)))
      }
    } catch {
      toast({ title: '오류', description: '설정 조회에 실패했습니다', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (tier: string, field: string, value: string) => {
    if (!config) return
    setConfig(prev => {
      if (!prev) return prev
      const updated = { ...prev }
      updated[tier] = { ...updated[tier] }
      if (field === 'label') {
        updated[tier].label = value
      } else {
        const numValue = parseInt(value, 10)
        if (!isNaN(numValue)) {
          const t = updated[tier]
          if (field === 'daily_ocr_limit') t.daily_ocr_limit = numValue
          else if (field === 'max_files_per_ocr') t.max_files_per_ocr = numValue
          else if (field === 'daily_log_max_photos') t.daily_log_max_photos = numValue
          else if (field === 'daily_log_max_photo_size_mb') t.daily_log_max_photo_size_mb = numValue
          else if (field === 'monthly_detailed_export_limit') t.monthly_detailed_export_limit = numValue
          else if (field === 'daily_description_gen_limit') t.daily_description_gen_limit = numValue
          else if (field === 'daily_excel_export_limit') t.daily_excel_export_limit = numValue
          else if (field === 'weekly_photo_export_limit') t.weekly_photo_export_limit = numValue
        }
      }
      return updated
    })
  }

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/tier-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const result = await res.json()
      if (result.success) {
        setOriginalConfig(JSON.parse(JSON.stringify(config)))
        toast({ title: '저장 완료', description: 'Tier 설정이 저장되었습니다.' })
      } else {
        toast({ title: '오류', description: result.error || '저장에 실패했습니다', variant: 'destructive' })
      }
    } catch {
      toast({ title: '오류', description: '저장에 실패했습니다', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (originalConfig) {
      setConfig(JSON.parse(JSON.stringify(originalConfig)))
    }
  }

  const hasChanges = JSON.stringify(config) !== JSON.stringify(originalConfig)

  if (loading) {
    return (
      <div className="min-h-screen bg-muted">
        <AppHeader title="Tier 설정" showBack backHref="/admin" />
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-muted">
        <AppHeader title="Tier 설정" showBack backHref="/admin" />
        <div className="container max-w-4xl mx-auto py-10 px-4">
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <ShieldCheck className="w-5 h-5" />
                접근 권한 없음
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/admin')}>관리자 홈으로</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader title="Tier 설정" showBack backHref="/admin" />

      <div className="container max-w-5xl mx-auto py-6 px-4">
        <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-lg flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-primary" />
          <div>
            <p className="font-medium text-primary">사용자 등급별 제한 설정</p>
            <p className="text-sm text-muted-foreground">
              각 등급의 일일 제한을 설정합니다. 변경 사항은 즉시 반영됩니다.
            </p>
          </div>
        </div>

        {config && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TIER_KEYS.map(tier => {
              const tierConfig = config[tier]
              if (!tierConfig) return null

              const borderColor = tier === 'free' ? 'border-gray-300' :
                tier === 'basic' ? 'border-blue-300' : 'border-amber-300'
              const bgColor = tier === 'free' ? 'bg-gray-50' :
                tier === 'basic' ? 'bg-blue-50' : 'bg-amber-50'

              return (
                <Card key={tier} className={`${borderColor}`}>
                  <CardHeader className={`${bgColor} rounded-t-lg`}>
                    <CardTitle className="text-lg capitalize">{tier}</CardTitle>
                    <CardDescription>
                      <Input
                        value={tierConfig.label}
                        onChange={e => handleChange(tier, 'label', e.target.value)}
                        className="mt-1 bg-background"
                        placeholder="표시 이름"
                      />
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    {Object.entries(FIELD_LABELS).map(([field, { label, description }]) => {
                      if (field === 'label') return null
                      const value = tierConfig[field as keyof TierConfig]
                      return (
                        <div key={field} className="space-y-1">
                          <Label htmlFor={`${tier}-${field}`} className="text-sm">
                            {label}
                          </Label>
                          <Input
                            id={`${tier}-${field}`}
                            type="number"
                            value={String(value)}
                            onChange={e => handleChange(tier, field, e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">{description}</p>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* 하단 액션 바 */}
        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasChanges || saving}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            되돌리기
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            저장
          </Button>
        </div>
      </div>
    </div>
  )
}
