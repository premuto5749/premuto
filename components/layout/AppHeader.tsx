'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Menu, ArrowLeft, Heart, Copy, ChevronDown, PawPrint, Check, MessageCircle, ChevronRight } from 'lucide-react'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { usePet } from '@/contexts/PetContext'
import { useSiteSettings } from '@/contexts/SiteSettingsContext'

interface AppHeaderProps {
  title: string
  showBack?: boolean
  backHref?: string
}

export function AppHeader({ title, showBack = false, backHref = '/daily-log' }: AppHeaderProps) {
  const pathname = usePathname()
  const [isDonateOpen, setIsDonateOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { toast } = useToast()
  const { isAdmin } = useAuth()
  const { pets, currentPet, setCurrentPet, isLoading: isPetsLoading } = usePet()
  const { settings: siteSettings } = useSiteSettings()

  const navItems = [
    { href: '/daily-log', label: '일일 기록', icon: '📝' },
    { href: '/daily-log-calendar', label: '월간 통계', icon: '📅' },
    { href: '/dashboard', label: '검사 결과 대시보드', icon: '📊' },
    { href: '/hospital-contacts', label: '병원 연락처', icon: '🏥' },
    { href: '/lost-animals', label: '유실 동물 안내', icon: '🐕' },
    { href: '/calorie-calculator', label: '사료량 계산기', icon: '🧮' },
    { href: '/manage', label: '사료/간식/약 관리', icon: '🍪' },
    { href: '/records-management', label: '검사 기록 관리', icon: '🗑️' },
    { href: '/standard-items', label: '내 검사항목', icon: '📋' },
    { href: '/trash', label: '휴지통', icon: '♻️' },
    { href: '/settings', label: '설정', icon: '🔧' },
  ]

  // 관리자 전용 메뉴
  const adminNavItems = [
    { href: '/admin', label: '관리자', icon: '🔐' },
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
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="overflow-y-auto">
                <SheetHeader>
                  <SheetTitle className="flex items-center justify-start">
                    <Link href="/daily-log" onClick={() => setIsMenuOpen(false)} className="block">
                      {siteSettings.headerLogoUrl ? (
                        <Image
                          src={siteSettings.headerLogoUrl}
                          alt={siteSettings.siteName}
                          width={280}
                          height={68}
                          className="h-14 w-auto object-contain"
                          unoptimized
                        />
                      ) : (
                        siteSettings.siteName
                      )}
                    </Link>
                  </SheetTitle>
                </SheetHeader>
                <nav className="mt-6 space-y-2">
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMenuOpen(false)}
                      className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                        pathname === item.href
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'hover:bg-muted'
                      }`}
                    >
                      {item.icon} {item.label}
                    </Link>
                  ))}
                  {/* 관리자 전용 메뉴 */}
                  {isAdmin && (
                    <>
                      <hr className="my-4" />
                      <div className="px-4 py-1 text-xs text-muted-foreground font-medium">관리자</div>
                      {adminNavItems.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setIsMenuOpen(false)}
                          className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                            pathname.startsWith(item.href)
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'hover:bg-muted'
                          }`}
                        >
                          {item.icon} {item.label}
                        </Link>
                      ))}
                    </>
                  )}
                  <hr className="my-4" />
                  <button
                    onClick={() => setIsDonateOpen(true)}
                    className="w-full flex items-center px-4 py-3 rounded-lg hover:bg-muted transition-colors text-left"
                  >
                    <Heart className="w-4 h-4 mr-2 text-pink-500" />
                    후원하기
                  </button>
                  <a
                    href="http://pf.kakao.com/_gqxkRX"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-muted transition-colors text-left"
                  >
                    <span className="flex items-center">
                      <MessageCircle className="w-4 h-4 mr-2 text-yellow-500" />
                      의견 주기
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </a>
                  <form action="/auth/signout" method="post">
                    <button
                      type="submit"
                      className="w-full flex items-center px-4 py-3 rounded-lg hover:bg-muted transition-colors text-left text-red-600"
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

        {/* 반려동물 스위처 */}
        <div className="flex-shrink-0 min-w-[40px] flex justify-end">
          {isPetsLoading ? (
            <div className="w-6 h-6 rounded-full bg-muted animate-pulse" />
          ) : pets.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 px-2">
                  {currentPet?.photo_url ? (
                    <div className="w-6 h-6 flex-shrink-0 rounded-full overflow-hidden">
                      <Image
                        src={currentPet.photo_url}
                        alt={currentPet.name}
                        width={24}
                        height={24}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-6 h-6 flex-shrink-0 rounded-full bg-muted flex items-center justify-center">
                      <PawPrint className="w-3 h-3 text-muted-foreground" />
                    </div>
                  )}
                  <ChevronDown className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {pets.map((pet) => (
                  <DropdownMenuItem
                    key={pet.id}
                    onClick={() => setCurrentPet(pet)}
                    className="flex items-center gap-2"
                  >
                    {pet.photo_url ? (
                      <div className="w-6 h-6 flex-shrink-0 rounded-full overflow-hidden">
                        <Image
                          src={pet.photo_url}
                          alt={pet.name}
                          width={24}
                          height={24}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-6 h-6 flex-shrink-0 rounded-full bg-muted flex items-center justify-center">
                        <PawPrint className="w-3 h-3 text-muted-foreground" />
                      </div>
                    )}
                    <span className="flex-1">{pet.name}</span>
                    {currentPet?.id === pet.id && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings?tab=pet" className="flex items-center gap-2">
                    <PawPrint className="w-4 h-4" />
                    반려동물 관리
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="ghost" size="sm" className="px-2" asChild>
              <Link href="/settings?tab=pet">
                <div className="w-6 h-6 flex-shrink-0 rounded-full bg-muted flex items-center justify-center">
                  <PawPrint className="w-3 h-3 text-muted-foreground" />
                </div>
              </Link>
            </Button>
          )}
        </div>
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
