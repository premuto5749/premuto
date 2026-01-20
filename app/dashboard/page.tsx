import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  return (
    <div className="container max-w-6xl mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">대시보드</h1>
        <p className="text-muted-foreground">
          미모의 건강 데이터를 한눈에 확인하세요
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>시각화 페이지</CardTitle>
          <CardDescription>
            Phase 6에서 피벗 테이블과 시계열 그래프가 구현됩니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              아직 저장된 검사 결과가 없습니다
            </p>
            <Button asChild>
              <Link href="/upload">
                <Upload className="w-4 h-4 mr-2" />
                첫 검사지 업로드하기
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
