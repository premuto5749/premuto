'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useSiteSettings } from '@/contexts/SiteSettingsContext'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSignUp, setIsSignUp] = useState(false)
  const { settings: siteSettings } = useSiteSettings()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`
          }
        })

        if (signUpError) {
          throw signUpError
        }

        alert('회원가입이 완료되었습니다! 이메일을 확인하여 인증해주세요.')
        setIsSignUp(false)
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        })

        if (signInError) {
          throw signInError
        }

        router.push('/')
        router.refresh()
      }
    } catch (err) {
      console.error('Auth error:', err)
      setError(err instanceof Error ? err.message : '인증에 실패했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* 왼쪽: 로그인 폼 */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-16 xl:px-24 py-12">
        <div className="w-full max-w-md mx-auto">
          {/* 로고 */}
          {siteSettings.logoUrl && (
            <div className="mb-8">
              <Image
                src={siteSettings.logoUrl}
                alt="Logo"
                width={80}
                height={80}
                className="w-20 h-20 object-contain"
                unoptimized
              />
            </div>
          )}

          {/* 타이틀 */}
          <h1 className="text-3xl font-bold mb-2">
            {isSignUp ? '가입하기' : '들어가기'}
          </h1>
          <p className="text-muted-foreground mb-8">
            {isSignUp ? '새 계정을 만들어주세요.' : '계정 정보를 입력해주세요.'}
          </p>

          {/* 폼 */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="h-12 rounded-full px-5"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={6}
                className="h-12 rounded-full px-5"
              />
              {isSignUp && (
                <p className="text-xs text-muted-foreground">
                  최소 6자 이상
                </p>
              )}
            </div>

            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 rounded-full text-base font-medium"
              disabled={isLoading}
              style={{ backgroundColor: siteSettings.primaryColor }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  처리 중...
                </>
              ) : (
                isSignUp ? '가입하기' : '들어가기'
              )}
            </Button>

            <div className="text-center pt-2">
              <span className="text-sm text-muted-foreground">
                {isSignUp ? '이미 계정이 있으신가요? ' : '계정이 없으신가요? '}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setError(null)
                }}
                className="text-sm font-medium underline hover:no-underline"
                style={{ color: siteSettings.primaryColor }}
                disabled={isLoading}
              >
                {isSignUp ? '들어가기' : '가입하기'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 오른쪽: 배경 이미지 (데스크탑에서만 표시) */}
      {siteSettings.loginBgImageUrl && (
        <div className="hidden lg:block lg:w-1/2 xl:w-[55%] relative">
          <Image
            src={siteSettings.loginBgImageUrl}
            alt="Login background"
            fill
            className="object-cover"
            unoptimized
            priority
          />
        </div>
      )}
    </div>
  )
}
