'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { FileText, LineChart, Upload, Trash2, Settings, Menu, X, Cog, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

const navigation = [
  { name: '일일 기록', href: '/daily-log', icon: FileText },
  { name: '검사지 업로드', href: '/upload-quick', icon: Upload },
  { name: '검사지 일괄 업로드', href: '/upload', icon: FileText },
  { name: '검사 결과 대시보드', href: '/dashboard', icon: LineChart },
  { name: '병원 연락처', href: '/hospital-contacts', icon: Building2 },
  { name: '검사 기록 관리', href: '/records-management', icon: Trash2 },
  { name: '검사항목 매핑 관리', href: '/mapping-management', icon: Settings },
  { name: '설정', href: '/settings', icon: Cog },
]

export function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Mobile menu button */}
      <div className="fixed top-4 left-4 z-50 lg:hidden">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-40 h-screen transition-transform lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="h-full px-3 py-4 overflow-y-auto bg-background border-r w-64">
          <div className="mb-8 px-3">
            <h1 className="text-xl font-bold">Mimo Health Log</h1>
            <p className="text-xs text-muted-foreground mt-1">미모 혈액검사 아카이브</p>
          </div>

          <nav className="space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-accent',
                    isActive
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-muted-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>
      </aside>

      {/* Spacer for desktop */}
      <div className="hidden lg:block w-64 flex-shrink-0" />
    </>
  )
}
