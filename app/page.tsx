import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Upload, LineChart, FileText } from 'lucide-react'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4">
            Mimo Health Log
          </h1>
          <p className="text-xl text-muted-foreground mb-2">
            미모 맞춤형 혈액검사 아카이브
          </p>
          <p className="text-muted-foreground">
            OCR로 검사 결과를 자동 분석하고 시계열 트렌드를 관리합니다
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="p-6 border rounded-lg">
            <Upload className="w-10 h-10 mb-4 text-primary" />
            <h3 className="font-semibold mb-2">1. 업로드</h3>
            <p className="text-sm text-muted-foreground">
              검사지 이미지나 PDF를 업로드합니다
            </p>
          </div>
          <div className="p-6 border rounded-lg">
            <FileText className="w-10 h-10 mb-4 text-primary" />
            <h3 className="font-semibold mb-2">2. 검수</h3>
            <p className="text-sm text-muted-foreground">
              AI가 추출한 결과를 확인하고 수정합니다
            </p>
          </div>
          <div className="p-6 border rounded-lg">
            <LineChart className="w-10 h-10 mb-4 text-primary" />
            <h3 className="font-semibold mb-2">3. 분석</h3>
            <p className="text-sm text-muted-foreground">
              시계열 그래프로 건강 트렌드를 확인합니다
            </p>
          </div>
        </div>

        <div className="flex gap-4 justify-center">
          <Button asChild size="lg">
            <Link href="/upload">
              <Upload className="w-4 h-4 mr-2" />
              검사지 업로드
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/dashboard">
              <LineChart className="w-4 h-4 mr-2" />
              대시보드
            </Link>
          </Button>
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground mb-2">
            주요 관리 항목
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <span className="px-3 py-1 bg-muted rounded-full text-xs">췌장: Lipase, cPL</span>
            <span className="px-3 py-1 bg-muted rounded-full text-xs">신장: BUN, Creatinine, SDMA</span>
            <span className="px-3 py-1 bg-muted rounded-full text-xs">간: ALT, ALKP, GGT</span>
            <span className="px-3 py-1 bg-muted rounded-full text-xs">CBC: HCT, PLT</span>
          </div>
        </div>
      </div>
    </main>
  )
}
