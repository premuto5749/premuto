'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { usePet } from '@/contexts/PetContext'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, PawPrint } from 'lucide-react'

// 반려동물 등록 없이 접근 가능한 경로들
const ALLOWED_PATHS = [
  '/login',
  '/auth',
  '/settings', // 설정 페이지는 반려동물 등록을 위해 허용
  '/admin',    // 관리자 페이지는 반려동물 등록 불필요
]

// 경로가 허용된 경로인지 확인
function isAllowedPath(pathname: string): boolean {
  return ALLOWED_PATHS.some(path => pathname.startsWith(path))
}

interface RequirePetGuardProps {
  children: React.ReactNode
}

export function RequirePetGuard({ children }: RequirePetGuardProps) {
  const { pets, isLoading } = usePet()
  const pathname = usePathname()
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [initialLoadDone, setInitialLoadDone] = useState(false)

  // 인증 상태 확인
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setIsAuthenticated(!!user)
    }
    checkAuth()
  }, [])

  // 초기 로드 완료 추적
  useEffect(() => {
    if (!isLoading && isAuthenticated !== null && !initialLoadDone) {
      setInitialLoadDone(true)
    }
  }, [isLoading, isAuthenticated, initialLoadDone])

  // 반려동물 등록 필요 여부 확인
  useEffect(() => {
    // 로딩 중이거나 인증 상태 확인 중이면 대기
    if (isLoading || isAuthenticated === null) return

    // 비로그인 상태면 무시 (로그인 페이지로 리다이렉트는 다른 곳에서 처리)
    if (!isAuthenticated) return

    // 허용된 경로면 무시
    if (isAllowedPath(pathname)) return

    // 반려동물이 없으면 모달 표시
    if (pets.length === 0) {
      setShowModal(true)
    } else {
      setShowModal(false)
    }
  }, [pets, isLoading, pathname, isAuthenticated])

  const handleGoToSettings = () => {
    setShowModal(false)
    router.push('/settings?tab=pet&onboarding=true')
  }

  // 초기 로딩 중에만 로딩 스피너 표시 (이후 리로드 시에는 children 유지)
  if (!initialLoadDone && (isLoading || isAuthenticated === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      {children}

      {/* 반려동물 등록 필요 모달 */}
      <Dialog open={showModal} onOpenChange={() => {}}>
        <DialogContent
          className="max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <PawPrint className="w-5 h-5 text-primary" />
              </div>
              반려동물 등록이 필요합니다
            </DialogTitle>
            <DialogDescription className="pt-2">
              서비스를 이용하려면 먼저 반려동물을 등록해주세요.
              등록 후 일일 건강 기록과 검사 결과 관리를 시작할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button onClick={handleGoToSettings} className="w-full">
              <PawPrint className="w-4 h-4 mr-2" />
              반려동물 등록하러 가기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
