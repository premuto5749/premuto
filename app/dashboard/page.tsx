'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, Loader2, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

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

export default function DashboardPage() {
  const searchParams = useSearchParams()
  const saved = searchParams.get('saved')
  
  const [records, setRecords] = useState<TestRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'High':
        return '🔴'
      case 'Low':
        return '🔵'
      case 'Normal':
        return '🟢'
      default:
        return '-'
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
            <Button asChild>
              <Link href="/upload">
                <Upload className="w-4 h-4 mr-2" />
                새 검사지 업로드
              </Link>
            </Button>
          </div>

          {records.map((record) => (
            <Card key={record.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>
                      {new Date(record.test_date).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </CardTitle>
                    <CardDescription>
                      {record.hospital_name && `${record.hospital_name} · `}
                      {record.machine_type && record.machine_type}
                      {!record.hospital_name && !record.machine_type && '검사 정보 없음'}
                    </CardDescription>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {record.test_results.length}개 항목
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {record.test_results.map((result) => (
                    <div key={result.id} className="p-3 border rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-sm">
                            {result.standard_items.name}
                          </p>
                          {result.standard_items.display_name_ko && (
                            <p className="text-xs text-muted-foreground">
                              {result.standard_items.display_name_ko}
                            </p>
                          )}
                        </div>
                        <span className="text-lg">
                          {getStatusIcon(result.status)}
                        </span>
                      </div>
                      <p className="text-lg font-semibold">
                        {result.value} {result.unit}
                      </p>
                      {result.ref_text && (
                        <p className="text-xs text-muted-foreground mt-1">
                          참고: {result.ref_text} {result.unit}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle>Phase 6 예정</CardTitle>
              <CardDescription>
                시계열 그래프와 피벗 테이블 기능이 추가될 예정입니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• 피벗 테이블: 날짜(가로) × 항목(세로) 레이아웃</li>
                <li>• 시계열 그래프: 주요 항목 클릭 시 트렌드 차트</li>
                <li>• 카테고리별 필터링: 췌장, 신장, 간, CBC</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
