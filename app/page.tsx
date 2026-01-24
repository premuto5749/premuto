import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Upload, LineChart, FileText, Settings, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  // 로그인되지 않은 경우 로그인 페이지로
  if (!session) {
    redirect('/login')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <div className="flex justify-end mb-4">
            <form action="/auth/signout" method="post">
              <Button variant="ghost" size="sm" type="submit">
                <LogOut className="w-4 h-4 mr-2" />
                로그아웃
              </Button>
            </form>
          </div>
          <h1 className="text-5xl font-bold mb-4">
            Mimo Health Log
          </h1>
          <p className="text-xl text-muted-foreground mb-2">
            미모 맞춤형 혈액검사 아카이브
          </p>
          <p className="text-muted-foreground">
            OCR로 검사 결과를 자동 분석하고 시계열 트렌드를 관리합니다
          </p>
          {session.user.email && (
            <p className="text-sm text-muted-foreground mt-2">
              {session.user.email}님 환영합니다
            </p>
          )}
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
            <h3 className="font-semibold mb-2">2. 자동 저장</h3>
            <p className="text-sm text-muted-foreground">
              OCR 결과를 확인 후 AI가 자동으로 매칭하고 저장합니다
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

        <div className="flex flex-col gap-4 items-center">
          <div className="flex gap-4">
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
          <Button variant="secondary" size="sm" asChild>
            <Link href="/mapping-management">
              <Settings className="w-4 h-4 mr-2" />
              검사항목 매핑 관리
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
