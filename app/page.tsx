import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8 text-center">
          Mimo Health Log
        </h1>
        <p className="text-center text-muted-foreground mb-8">
          미모의 혈액검사 결과를 OCR로 분석하고 시계열 트렌드를 관리하는 웹 애플리케이션
        </p>
        <div className="flex gap-4 justify-center">
          <Button>시작하기</Button>
          <Button variant="outline">문서 보기</Button>
        </div>
      </div>
    </main>
  )
}
