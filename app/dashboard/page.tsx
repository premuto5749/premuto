'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, Loader2, CheckCircle2, Edit, Save } from 'lucide-react'
import Link from 'next/link'
import { PivotTable } from '@/components/dashboard/PivotTable'
import { TrendChart } from '@/components/dashboard/TrendChart'

interface TestResult {
  id: string
  standard_item_id: string
  value: number
  ref_min: number | null
  ref_max: number | null
  ref_text: string | null
  status: string
  unit: string | null
  standard_items: {
    name: string
    display_name_ko: string | null
    category: string | null
    default_unit: string | null
  }
}

interface TestRecord {
  id: string
  test_date: string
  hospital_name: string | null
  machine_type: string | null
  created_at: string
  test_results: TestResult[]
}

function DashboardContent() {
  const searchParams = useSearchParams()
  const saved = searchParams.get('saved')

  const [records, setRecords] = useState<TestRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [isChartOpen, setIsChartOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)

  useEffect(() => {
    fetchTestRecords()
  }, [])

  const fetchTestRecords = async () => {
    try {
      const response = await fetch('/api/test-results')
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '데이터 조회에 실패했습니다')
      }

      setRecords(result.data || [])
    } catch (err) {
      console.error('Fetch error:', err)
      setError(err instanceof Error ? err.message : '데이터 조회 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  const handleItemClick = (itemName: string) => {
    setSelectedItem(itemName)
    setIsChartOpen(true)
  }

  const handleChartClose = (open: boolean) => {
    setIsChartOpen(open)
    if (!open) {
      setSelectedItem(null)
    }
  }

  const handleDeleteRecord = async (recordId: string, testDate: string) => {
    const confirmed = window.confirm(
      `${testDate} 검사 결과를 전체 삭제하시겠습니까?\n\n이 작업은 취소할 수 없습니다.`
    )

    if (!confirmed) return

    try {
      const response = await fetch(`/api/test-results/${recordId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '삭제에 실패했습니다')
      }

      // 성공 시 목록 새로고침
      await fetchTestRecords()
      alert('검사 기록이 삭제되었습니다')
    } catch (err) {
      console.error('Delete error:', err)
      alert(err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다')
    }
  }

  const handleDeleteResult = async (resultId: string) => {
    const confirmed = window.confirm(
      '이 검사 결과를 삭제하시겠습니까?\n\n이 작업은 취소할 수 없습니다.'
    )

    if (!confirmed) return

    try {
      const response = await fetch(`/api/test-results/result/${resultId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '삭제에 실패했습니다')
      }

      // 성공 시 목록 새로고침
      await fetchTestRecords()
    } catch (err) {
      console.error('Delete error:', err)
      alert(err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다')
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

  return (
    <div className="container max-w-6xl mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">대시보드</h1>
        <p className="text-muted-foreground">
          미모의 건강 데이터를 한눈에 확인하세요
        </p>
      </div>

      {saved && (
        <Card className="mb-6 border-green-500 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <p className="font-medium text-green-900 dark:text-green-100">
                검사 결과가 성공적으로 저장되었습니다!
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {records.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>저장된 검사 결과가 없습니다</CardTitle>
            <CardDescription>
              첫 번째 검사지를 업로드하여 데이터를 추가해보세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Button asChild size="lg">
                <Link href="/upload">
                  <Upload className="w-4 h-4 mr-2" />
                  첫 검사지 업로드하기
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              총 {records.length}개의 검사 기록
            </p>
            <div className="flex gap-2">
              <Button
                variant={isEditMode ? "default" : "outline"}
                onClick={() => setIsEditMode(!isEditMode)}
              >
                {isEditMode ? (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    수정 완료
                  </>
                ) : (
                  <>
                    <Edit className="w-4 h-4 mr-2" />
                    수정
                  </>
                )}
              </Button>
              <Button asChild>
                <Link href="/upload">
                  <Upload className="w-4 h-4 mr-2" />
                  새 검사지 업로드
                </Link>
              </Button>
            </div>
          </div>

          <PivotTable
            records={records}
            onItemClick={handleItemClick}
            isEditMode={isEditMode}
            onDeleteRecord={handleDeleteRecord}
            onDeleteResult={handleDeleteResult}
          />

          <TrendChart
            records={records}
            itemName={selectedItem}
            open={isChartOpen}
            onOpenChange={handleChartClose}
          />
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="container max-w-6xl mx-auto py-10">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
