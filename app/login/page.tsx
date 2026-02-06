'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Mail, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useSiteSettings } from '@/contexts/SiteSettingsContext'

type AuthMode = 'login' | 'signup' | 'forgot-password'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<AuthMode>('login')
  const [resetEmailSent, setResetEmailSent] = useState(false)
  const { settings: siteSettings } = useSiteSettings()

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode)
    setError(null)
    setResetEmailSent(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      if (mode === 'forgot-password') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`
        })

        if (resetError) {
          throw resetError
        }

        setResetEmailSent(true)
      } else if (mode === 'signup') {
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
        switchMode('login')
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

  const handleSocialLogin = async (provider: 'google' | 'kakao') => {
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: socialError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (socialError) {
        throw socialError
      }
    } catch (err) {
      console.error('Social login error:', err)
      setError(err instanceof Error ? err.message : '소셜 로그인에 실패했습니다')
      setIsLoading(false)
    }
  }

  const getTitle = () => {
    switch (mode) {
      case 'signup': return '가입하기'
      case 'forgot-password': return '비밀번호 찾기'
      default: return '들어가기'
    }
  }

  const getDescription = () => {
    switch (mode) {
      case 'signup': return '새 계정을 만들어주세요.'
      case 'forgot-password': return '가입한 이메일을 입력하시면 비밀번호 재설정 링크를 보내드립니다.'
      default: return '계정 정보를 입력해주세요.'
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
                width={200}
                height={200}
                className="w-[200px] h-[200px] object-contain"
                unoptimized
              />
            </div>
          )}

          {/* 뒤로가기 (비밀번호 찾기 모드) */}
          {mode === 'forgot-password' && (
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              로그인으로 돌아가기
            </button>
          )}

          {/* 타이틀 */}
          <h1 className="text-3xl font-bold mb-2">
            {getTitle()}
          </h1>
          <p className="text-muted-foreground mb-8">
            {getDescription()}
          </p>

          {/* 비밀번호 재설정 이메일 전송 완료 */}
          {mode === 'forgot-password' && resetEmailSent ? (
            <div className="space-y-5">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-800">
                      이메일을 확인해주세요
                    </p>
                    <p className="text-sm text-green-700 mt-1">
                      <strong>{email}</strong>으로 비밀번호 재설정 링크를 보냈습니다.
                      이메일이 보이지 않으면 스팸 폴더도 확인해주세요.
                    </p>
                  </div>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 rounded-full text-base"
                onClick={() => switchMode('login')}
              >
                로그인으로 돌아가기
              </Button>
            </div>
          ) : (
            <>
              {/* 소셜 로그인 (로그인/가입 모드에서만) */}
              {mode !== 'forgot-password' && (
                <div className="space-y-3 mb-6">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12 rounded-full text-base font-medium gap-3"
                    onClick={() => handleSocialLogin('google')}
                    disabled={isLoading}
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Google로 계속하기
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12 rounded-full text-base font-medium gap-3"
                    onClick={() => handleSocialLogin('kakao')}
                    disabled={isLoading}
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                      <path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.76 1.84 5.18 4.6 6.56-.2.72-.74 2.6-.84 3-.14.48.17.47.36.34.15-.1 2.4-1.63 3.36-2.3.5.07 1.01.1 1.52.1 5.52 0 10-3.48 10-7.8S17.52 3 12 3z" fill="#FEE500"/>
                      <path d="M8.01 8.86H6.56v4.27h1.09v-1.56l1.34 1.56h1.42l-1.65-1.8 1.51-2.47h-1.3l-.96 1.7v-1.7zm3.53 0l-1.47 4.27h1.14l.3-.96h1.56l.3.96h1.14l-1.47-4.27h-1.5zm.75 1.08l.48 1.53h-.96l.48-1.53zm3.24-1.08h-1.09v4.27h2.63v-.93h-1.54V8.86z" fill="#3C1E1E"/>
                    </svg>
                    카카오로 계속하기
                  </Button>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-background px-3 text-muted-foreground">또는 이메일로</span>
                    </div>
                  </div>
                </div>
              )}

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
                {mode !== 'forgot-password' && (
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
                    {mode === 'signup' && (
                      <p className="text-xs text-muted-foreground">
                        최소 6자 이상
                      </p>
                    )}
                    {mode === 'login' && (
                      <div className="text-right">
                        <button
                          type="button"
                          onClick={() => switchMode('forgot-password')}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          비밀번호를 잊으셨나요?
                        </button>
                      </div>
                    )}
                  </div>
                )}

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
                  ) : mode === 'forgot-password' ? (
                    '재설정 링크 보내기'
                  ) : mode === 'signup' ? (
                    '가입하기'
                  ) : (
                    '들어가기'
                  )}
                </Button>

                {mode !== 'forgot-password' && (
                  <div className="text-center pt-2">
                    <span className="text-sm text-muted-foreground">
                      {mode === 'signup' ? '이미 계정이 있으신가요? ' : '계정이 없으신가요? '}
                    </span>
                    <button
                      type="button"
                      onClick={() => switchMode(mode === 'signup' ? 'login' : 'signup')}
                      className="text-sm font-medium underline hover:no-underline"
                      style={{ color: siteSettings.primaryColor }}
                      disabled={isLoading}
                    >
                      {mode === 'signup' ? '들어가기' : '가입하기'}
                    </button>
                  </div>
                )}
              </form>
            </>
          )}

          {/* 면책 고지문 */}
          <p className="mt-8 text-[11px] text-muted-foreground/70 leading-relaxed">
            본 서비스는 반려동물 건강 데이터를 기록·보관하는 도구이며, 어떠한 의료적 의견이나 진단을 제공하지 않습니다.
            데이터의 정확성 확인은 사용자 본인의 책임이며, 의학적 치료 관련 판단은 반드시 수의사와 상의하세요.
            본 서비스는 기록된 데이터에 대한 법적 책임을 지지 않습니다.
          </p>
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
