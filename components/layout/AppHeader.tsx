'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, ArrowLeft, Heart, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from '@/hooks/use-toast'

interface AppHeaderProps {
  title: string
  showBack?: boolean
  backHref?: string
}

export function AppHeader({ title, showBack = false, backHref = '/daily-log' }: AppHeaderProps) {
  const pathname = usePathname()
  const [isDonateOpen, setIsDonateOpen] = useState(false)
  const { toast } = useToast()

  const navItems = [
    { href: '/daily-log', label: '일일 기록', icon: '📝' },
    { href: '/upload', label: '검사지 업로드', icon: '📄' },
    { href: '/dashboard', label: '검사 결과 대시보드', icon: '📊' },
    { href: '/records-management', label: '검사 기록 관리', icon: '🗑️' },
    { href: '/mapping-management', label: '검사항목 매핑 관리', icon: '⚙️' },
    { href: '/settings', label: '설정', icon: '🔧' },
  ]

  return (
    <header className="sticky top-0 z-10 bg-background border-b">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {showBack ? (
            <Button variant="ghost" size="icon" asChild>
              <Link href={backHref}>
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
          ) : (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>Mimo Health Log</SheetTitle>
                </SheetHeader>
                <nav className="mt-6 space-y-2">
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                        pathname === item.href
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'hover:bg-muted'
                      }`}
                    >
                      {item.icon} {item.label}
                    </Link>
                  ))}
                  <hr className="my-4" />
                  <button
                    onClick={() => setIsDonateOpen(true)}
                    className="w-full flex items-center px-4 py-3 rounded-lg hover:bg-muted transition-colors text-left"
                  >
                    <Heart className="w-4 h-4 mr-2 text-pink-500" />
                    후원하기
                  </button>
                  <form action="/auth/signout" method="post">
                    <button
                      type="submit"
                      className="w-full flex items-center px-4 py-3 rounded-lg hover:bg-muted transition-colors text-left"
                    >
                      🚪 로그아웃
                    </button>
                  </form>
                </nav>
              </SheetContent>
            </Sheet>
          )}
        </div>

        <h1 className="font-semibold text-lg">{title}</h1>

        <div className="w-10" /> {/* 균형 맞추기 */}
      </div>

      {/* 후원하기 다이얼로그 */}
      <Dialog open={isDonateOpen} onOpenChange={setIsDonateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-pink-500" />
              후원하기
            </DialogTitle>
            <DialogDescription>
              우리 아가들에게 더 건강한 하루를 선물하는데 쓰입니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">은행</span>
                <span className="font-medium">우리은행</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">계좌번호</span>
                <span className="font-medium">1002-533-391083</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">예금주</span>
                <span className="font-medium">김민수</span>
              </div>
            </div>
            <Button className="w-full" onClick={() => {
              navigator.clipboard.writeText('1002533391083')
              toast({ title: '복사 완료', description: '계좌번호가 클립보드에 복사되었습니다.' })
            }}>
              <Copy className="w-4 h-4 mr-2" />
              계좌번호 복사
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  )
}
