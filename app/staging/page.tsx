'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Loader2, Save, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { StagingTable } from '@/components/staging/StagingTable'
import type { OcrResponse, StagingItem } from '@/types'

export default function StagingPage() {
  const router = useRouter()
  const [ocrData, setOcrData] = useState<OcrResponse | null>(null)
  const [stagingItems, setStagingItems] = useState<StagingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // 검사 정보 편집 상태
  const [testDate, setTestDate] = useState('')
  const [hospitalName, setHospitalName] = useState('')
  const [machineType, setMachineType] = useState('')

  useEffect(() => {
    // 세션 스토리지에서 OCR 결과 가져오기
    const stored = sessionStorage.getItem('ocrResult')
    if (stored) {
      try {
        const data = JSON.parse(stored) as OcrResponse
        setOcrData(data)
        setTestDate(data.test_date || '')
        setHospitalName(data.hospital_name || '')
        setMachineType(data.machine_type || '')
      } catch (error) {
        console.error('Failed to parse OCR data:', error)
      }
    }
    setLoading(false)
  }, [])

  const handleSave = async () => {
    // 모든 항목이 매핑되었는지 확인
    const unmappedItems = stagingItems.filter(item => !item.is_mapped)
    if (unmappedItems.length > 0) {
      alert(`매핑되지 않은 항목이 ${unmappedItems.length}개 있습니다. 모든 항목을 매핑해주세요.`)
      return
    }

    if (!testDate) {
      alert('검사 날짜를 입력해주세요.')
      return
    }

    setSaving(true)

    try {
      // Phase 5에서 구현될 저장 API 호출
      const response = await fetch('/api/test-results', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          test_date: testDate,
          hospital_name: hospitalName,
          machine_type: machineType,
          items: stagingItems
        })
      })

      if (!response.ok) {
        throw new Error('저장에 실패했습니다')
      }

      // 세션 스토리지 정리
      sessionStorage.removeItem('ocrResult')

      // 대시보드로 이동
      router.push('/dashboard?saved=true')

    } catch (error) {
      console.error('Save error:', error)
      alert(error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container max-w-6xl mx-auto py-10">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!ocrData) {
    return (
      <div className="container max-w-6xl mx-auto py-10">
        <Card>
          <CardHeader>
            <CardTitle>데이터가 없습니다</CardTitle>
            <CardDescription>
              먼저 검사지를 업로드해주세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/upload">
                <ArrowLeft className="w-4 h-4 mr-2" />
                업로드 페이지로 이동
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const unmappedCount = stagingItems.filter(item => !item.is_mapped).length

  return (
    <div className="container max-w-6xl mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">검수 및 매핑</h1>
        <p className="text-muted-foreground">
          AI가 추출한 결과를 확인하고 수정한 후 저장하세요
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>검사 정보</CardTitle>
          <CardDescription>
            필요한 경우 검사 정보를 수정할 수 있습니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="test-date">검사 날짜 *</Label>
              <Input
                id="test-date"
                type="date"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="hospital">병원명</Label>
              <Input
                id="hospital"
                value={hospitalName}
                onChange={(e) => setHospitalName(e.target.value)}
                placeholder="예: 타임즈동물의료센터"
              />
            </div>
            <div>
              <Label htmlFor="machine">장비명</Label>
              <Input
                id="machine"
                value={machineType}
                onChange={(e) => setMachineType(e.target.value)}
                placeholder="예: Fuji DRI-CHEM"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {unmappedCount > 0 && (
        <Card className="mb-6 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-900 dark:text-yellow-100">
                  매핑 필요
                </p>
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                  {unmappedCount}개 항목이 표준 항목으로 매핑되지 않았습니다. 
                  드롭다운에서 해당하는 표준 항목을 선택해주세요.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>검사 결과 ({ocrData.items.length}개 항목)</CardTitle>
          <CardDescription>
            각 항목의 값과 참고치를 확인하고, 표준 항목으로 매핑하세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StagingTable
            ocrItems={ocrData.items}
            onItemsChange={setStagingItems}
          />

          <div className="mt-6 flex gap-4">
            <Button variant="outline" asChild>
              <Link href="/upload">
                <ArrowLeft className="w-4 h-4 mr-2" />
                다시 업로드
              </Link>
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || unmappedCount > 0 || !testDate}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  저장하기
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
