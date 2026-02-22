'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const { settings: siteSettings } = useSiteSettings()

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode)
    setError(null)
    setResetEmailSent(false)
    setAgreedToTerms(false)
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
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              terms_accepted_at: new Date().toISOString(),
            }
          }
        })

        if (signUpError) {
          throw signUpError
        }

        // 이미 가입된 이메일: identities가 빈 배열로 반환됨
        if (signUpData.user && signUpData.user.identities?.length === 0) {
          setError('이미 가입된 이메일입니다. 로그인해주세요.')
          setIsLoading(false)
          return
        }

        alert('인증 메일을 발송했습니다. 이메일에서 인증 링크를 클릭하면 가입이 완료됩니다.')
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
      // 사용자 입력 오류(잘못된 자격증명 등)는 warn으로 기록 — Sentry에 불필요한 에러 유입 방지
      const message = err instanceof Error ? err.message : ''
      const isUserError = [
        'Invalid login credentials',
        'Email not confirmed',
        'Email rate limit exceeded',
      ].some(expected => message.includes(expected))
      if (isUserError) {
        console.warn('Auth warning:', message)
      } else {
        console.error('Auth error:', err)
      }
      if (message === 'Invalid login credentials') {
        setError('이메일 또는 비밀번호가 올바르지 않습니다')
      } else if (message === 'Email not confirmed') {
        setError('이메일 인증이 완료되지 않았습니다. 메일함을 확인해주세요')
      } else if (message.includes('Email rate limit exceeded')) {
        setError('너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요')
      } else if (message.includes('Error sending recovery email')) {
        setError('비밀번호 재설정 이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요')
      } else {
        setError(message || '인증에 실패했습니다')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSocialLogin = async (provider: 'kakao') => {
    setIsLoading(true)
    setError(null)

    try {
      // signup 모드에서 약관 동의 시점을 쿠키에 저장 (OAuth 리다이렉트 후 callback에서 읽음)
      if (mode === 'signup' && agreedToTerms) {
        document.cookie = `terms_accepted_at=${new Date().toISOString()}; path=/; max-age=600; SameSite=Lax`
      }

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
            <div className="mb-8 flex justify-center">
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
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors mx-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              로그인으로 돌아가기
            </button>
          )}

          {/* 타이틀 */}
          <h1 className="text-3xl font-bold mb-2 text-center">
            {getTitle()}
          </h1>
          <p className="text-muted-foreground mb-8 text-center">
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
              {/* 약관 동의 (가입 모드 - 카카오/이메일 공통) */}
              {mode === 'signup' && (
                <div className="flex items-start gap-2 mb-1">
                  <Checkbox
                    id="terms"
                    checked={agreedToTerms}
                    onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                    disabled={isLoading}
                    className="mt-0.5"
                  />
                  <label htmlFor="terms" className="text-sm leading-snug text-muted-foreground cursor-pointer">
                    <Link href="/terms" target="_blank" className="underline hover:text-foreground">서비스 이용약관</Link>
                    {' 및 '}
                    <Link href="/privacy" target="_blank" className="underline hover:text-foreground">개인정보 처리방침</Link>
                    에 동의합니다.
                  </label>
                </div>
              )}

              {/* 카카오 로그인 (로그인/가입 모드에서만) */}
              {mode !== 'forgot-password' && (
                <div className="space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12 rounded-full text-base font-medium gap-3 bg-[#FEE500] hover:bg-[#FDD835] border-[#FEE500] hover:border-[#FDD835] text-[#3C1E1E]"
                    onClick={() => handleSocialLogin('kakao')}
                    disabled={isLoading || (mode === 'signup' && !agreedToTerms)}
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                      <path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.76 1.84 5.18 4.6 6.56-.2.72-.74 2.6-.84 3-.14.48.17.47.36.34.15-.1 2.4-1.63 3.36-2.3.5.07 1.01.1 1.52.1 5.52 0 10-3.48 10-7.8S17.52 3 12 3z" fill="#3C1E1E"/>
                    </svg>
                    카카오로 계속하기
                  </Button>

                  {!showEmailForm ? (
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => setShowEmailForm(true)}
                        className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-3"
                      >
                        또는 이메일로 {mode === 'signup' ? '가입하기' : '로그인'}
                      </button>
                      {mode === 'login' && (
                        <button
                          type="button"
                          onClick={() => {
                            switchMode('signup')
                            setShowEmailForm(true)
                          }}
                          className="w-full text-center text-sm py-2"
                        >
                          <span className="text-muted-foreground">계정이 없으신가요? </span>
                          <span
                            className="font-medium underline hover:no-underline"
                            style={{ color: siteSettings.primaryColor }}
                          >
                            회원 가입하기
                          </span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-border" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-background px-3 text-muted-foreground">또는 이메일로</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 이메일 폼 (클릭 시 또는 비밀번호 찾기 모드에서 표시) */}
              {(showEmailForm || mode === 'forgot-password') && (
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
                    disabled={isLoading || (mode === 'signup' && !agreedToTerms)}
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
              )}

              {/* 에러 (이메일 폼 숨겨진 상태에서도 표시) */}
              {!showEmailForm && mode !== 'forgot-password' && error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
                  {error}
                </div>
              )}
            </>
          )}

          {/* 면책 고지문 */}
          <p className="mt-8 text-[11px] text-muted-foreground/70 leading-relaxed">
            본 서비스는 반려동물 건강 데이터를 기록·보관하는 도구이며, 어떠한 의료적 의견이나 진단을 제공하지 않습니다.
            데이터의 정확성 확인은 사용자 본인의 책임이며, 의학적 치료 관련 판단은 반드시 수의사와 상의하세요.
            본 서비스는 기록된 데이터에 대한 법적 책임을 지지 않습니다.
          </p>

          {/* 푸터 */}
          <footer className="mt-10 pt-6 border-t border-border/50 text-[11px] text-muted-foreground/60 leading-relaxed space-y-1">
            <p>프리무토 | 대표자 : 김민수</p>
            <p>사업자 등록번호 : 480-57-00855</p>
            <p>소재지 : 경기도 수원시 장안구 송죽로 9-1, 2층</p>
            <p>이메일 : minsook1@withpremuto.com</p>
            <p className="pt-2 space-x-2">
              <Link href="/terms" target="_blank" className="underline hover:text-muted-foreground">이용약관</Link>
              <span>|</span>
              <Link href="/privacy" target="_blank" className="underline hover:text-muted-foreground">개인정보처리방침</Link>
            </p>
            <p className="pt-2 text-[10px] text-muted-foreground/50">
              COPYRIGHT &copy;Premuto. ALL RIGHTS RESERVED. DESIGNED BY PREMUTO.
            </p>
          </footer>
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
