'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

interface AppHeaderProps {
  title: string
  showBack?: boolean
  backHref?: string
}

export function AppHeader({ title, showBack = false, backHref = '/daily-log' }: AppHeaderProps) {
  const pathname = usePathname()

  const navItems = [
    { href: '/daily-log', label: '일일 기록', icon: '📝' },
    { href: '/upload', label: '검사지 업로드', icon: '📄' },
    { href: '/dashboard', label: '검사 결과 대시보드', icon: '📊' },
    { href: '/mapping-management', label: '검사항목 매핑 관리', icon: '⚙️' },
  ]

  return (
    <header className="sticky top-0 z-10 bg-white border-b">
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
    </header>
  )
}
