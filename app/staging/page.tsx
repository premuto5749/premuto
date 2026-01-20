'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import type { OcrResponse } from '@/types'

export default function StagingPage() {
  const router = useRouter()
  const [ocrData, setOcrData] = useState<OcrResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 세션 스토리지에서 OCR 결과 가져오기
    const stored = sessionStorage.getItem('ocrResult')
    if (stored) {
      try {
        const data = JSON.parse(stored)
        setOcrData(data)
      } catch (error) {
        console.error('Failed to parse OCR data:', error)
      }
    }
    setLoading(false)
  }, [])

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

  return (
    <div className="container max-w-6xl mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">검수 및 매핑</h1>
        <p className="text-muted-foreground">
          AI가 추출한 결과를 확인하고 수정하세요
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>검사 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">검사 날짜</dt>
              <dd className="text-lg">{ocrData.test_date || '정보 없음'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">병원명</dt>
              <dd className="text-lg">{ocrData.hospital_name || '정보 없음'}</dd>
            </div>
            {ocrData.machine_type && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">장비명</dt>
                <dd className="text-lg">{ocrData.machine_type}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm font-medium text-muted-foreground">검사 항목 수</dt>
              <dd className="text-lg">{ocrData.items.length}개</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>검사 결과 ({ocrData.items.length}개 항목)</CardTitle>
          <CardDescription>
            Phase 4에서 완전한 검수 테이블이 구현됩니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {ocrData.items.map((item, index) => (
              <div key={index} className="p-4 border rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">항목명</p>
                    <p className="font-medium">{item.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">결과값</p>
                    <p className="font-medium">{item.value} {item.unit}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">참고치</p>
                    <p className="font-medium">{item.ref_text || '없음'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">상태</p>
                    <p className="font-medium">검수 대기</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-4">
            <Button variant="outline" asChild>
              <Link href="/upload">
                <ArrowLeft className="w-4 h-4 mr-2" />
                다시 업로드
              </Link>
            </Button>
            <Button disabled>
              Phase 4에서 구현 예정
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
