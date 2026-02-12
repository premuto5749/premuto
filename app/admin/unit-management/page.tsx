'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AppHeader } from '@/components/layout/AppHeader'
import { Loader2, ShieldCheck, Plus, Trash2, Save } from 'lucide-react'

interface UnitAliases {
  [category: string]: {
    [standardUnit: string]: string[]
  }
}

interface OcrCorrections {
  _description: string
  rules: Record<string, string>
}

function UnitManagementContent() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const [unitAliases, setUnitAliases] = useState<UnitAliases>({})
  const [corrections, setCorrections] = useState<OcrCorrections>({ _description: '', rules: {} })

  // 새 별칭 입력 상태
  const [newAliasInputs, setNewAliasInputs] = useState<Record<string, string>>({})
  // 새 보정 규칙 입력 상태
  const [newCorrectionFrom, setNewCorrectionFrom] = useState('')
  const [newCorrectionTo, setNewCorrectionTo] = useState('')

  useEffect(() => {
    const init = async () => {
      try {
        const authRes = await fetch('/api/admin/stats')
        if (authRes.status === 403) {
          setAuthError('관리자 권한이 필요합니다')
          setAuthorized(false)
          setLoading(false)
          return
        }
        if (!authRes.ok) {
          setAuthError('권한 확인 실패')
          setAuthorized(false)
          setLoading(false)
          return
        }
        setAuthorized(true)
        await fetchConfig()
      } catch {
        setAuthError('서버 오류가 발생했습니다')
        setLoading(false)
      }
    }
    init()
  }, [])

  const fetchConfig = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/unit-config')
      const result = await response.json()
      if (result.success) {
        setUnitAliases(result.data.unit_aliases)
        setCorrections(result.data.ocr_corrections)
      }
    } catch (error) {
      console.error('Failed to fetch unit config:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/admin/unit-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_aliases: unitAliases,
          ocr_corrections: corrections,
        })
      })
      const result = await response.json()
      if (result.success) {
        alert('저장되었습니다.')
      } else {
        alert(`저장 실패: ${result.error}`)
      }
    } catch (error) {
      console.error('Save error:', error)
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 별칭 추가
  const handleAddAlias = (category: string, standardUnit: string) => {
    const key = `${category}:${standardUnit}`
    const newAlias = newAliasInputs[key]?.trim()
    if (!newAlias) return

    setUnitAliases(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [standardUnit]: [...(prev[category]?.[standardUnit] || []), newAlias]
      }
    }))
    setNewAliasInputs(prev => ({ ...prev, [key]: '' }))
  }

  // 별칭 삭제
  const handleRemoveAlias = (category: string, standardUnit: string, alias: string) => {
    setUnitAliases(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [standardUnit]: prev[category][standardUnit].filter(a => a !== alias)
      }
    }))
  }

  // 보정 규칙 추가
  const handleAddCorrection = () => {
    const from = newCorrectionFrom.trim()
    const to = newCorrectionTo.trim()
    if (!from || !to) return

    setCorrections(prev => ({
      ...prev,
      rules: { ...prev.rules, [from]: to }
    }))
    setNewCorrectionFrom('')
    setNewCorrectionTo('')
  }

  // 보정 규칙 삭제
  const handleRemoveCorrection = (key: string) => {
    setCorrections(prev => {
      const newRules = { ...prev.rules }
      delete newRules[key]
      return { ...prev, rules: newRules }
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-muted">
        <AppHeader title="[관리자] 단위 관리" />
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-muted">
        <AppHeader title="[관리자] 단위 관리" />
        <div className="container max-w-4xl mx-auto py-10 px-4">
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <ShieldCheck className="w-5 h-5" />
                접근 권한 없음
              </CardTitle>
              <CardDescription>
                {authError || '이 페이지에 접근할 권한이 없습니다.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/')}>메인으로 돌아가기</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader title="[관리자] 단위 관리" />

      <div className="container max-w-7xl mx-auto py-10 px-4">
        {/* 관리자 배지 */}
        <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-primary" />
            <div>
              <p className="font-medium text-primary">관리자 전용</p>
              <p className="text-sm text-muted-foreground">단위 별칭 및 OCR 보정 규칙을 관리합니다.</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />저장 중...</>
            ) : (
              <><Save className="w-4 h-4 mr-2" />변경사항 저장</>
            )}
          </Button>
        </div>

        {/* 섹션 1: 단위 별칭 관리 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>단위 별칭 관리</CardTitle>
            <CardDescription>
              표준 단위별로 동의어(별칭) 목록을 관리합니다. OCR에서 추출된 다양한 표기를 표준 단위로 변환하는 데 사용됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {Object.entries(unitAliases).map(([category, units]) => (
                <div key={category}>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-3">
                    {category}
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(units).map(([standardUnit, aliases]) => {
                      const inputKey = `${category}:${standardUnit}`
                      return (
                        <div key={standardUnit} className="p-3 bg-background rounded-lg border">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="default" className="font-mono">{standardUnit}</Badge>
                            <span className="text-xs text-muted-foreground">({aliases.length}개 별칭)</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {aliases.map((alias, idx) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className="font-mono text-xs cursor-pointer hover:bg-destructive/10 hover:border-destructive"
                                onClick={() => handleRemoveAlias(category, standardUnit, alias)}
                                title="클릭하여 삭제"
                              >
                                {alias}
                                <Trash2 className="w-3 h-3 ml-1 opacity-50" />
                              </Badge>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Input
                              placeholder="새 별칭 입력..."
                              className="h-8 text-sm font-mono max-w-[200px]"
                              value={newAliasInputs[inputKey] || ''}
                              onChange={(e) => setNewAliasInputs(prev => ({ ...prev, [inputKey]: e.target.value }))}
                              onKeyDown={(e) => e.key === 'Enter' && handleAddAlias(category, standardUnit)}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={() => handleAddAlias(category, standardUnit)}
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              추가
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 섹션 2: OCR 보정 규칙 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>OCR 보정 규칙</CardTitle>
            <CardDescription>
              OCR에서 잘려 인식된 단위를 올바른 단위로 보정하는 규칙입니다. (예: &quot;mg/d&quot; → &quot;mg/dL&quot;)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 mb-4">
              {Object.entries(corrections.rules).map(([from, to]) => (
                <div key={from} className="flex items-center gap-3 p-2 bg-background rounded-lg border">
                  <Badge variant="outline" className="font-mono">{from}</Badge>
                  <span className="text-muted-foreground">→</span>
                  <Badge variant="default" className="font-mono">{to}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-7 text-destructive hover:text-destructive"
                    onClick={() => handleRemoveCorrection(from)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <Input
                placeholder="잘린 단위 (예: mg/d)"
                className="h-8 text-sm font-mono max-w-[200px]"
                value={newCorrectionFrom}
                onChange={(e) => setNewCorrectionFrom(e.target.value)}
              />
              <span className="text-muted-foreground">→</span>
              <Input
                placeholder="올바른 단위 (예: mg/dL)"
                className="h-8 text-sm font-mono max-w-[200px]"
                value={newCorrectionTo}
                onChange={(e) => setNewCorrectionTo(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCorrection()}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={handleAddCorrection}
              >
                <Plus className="w-3 h-3 mr-1" />
                추가
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function UnitManagementPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
      <UnitManagementContent />
    </Suspense>
  )
}
