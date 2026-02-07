'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useSiteSettings } from '@/contexts/SiteSettingsContext'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isVerifying, setIsVerifying] = useState(true)
  const { settings: siteSettings } = useSiteSettings()

  // URL hash에서 토큰을 추출하고 세션 설정
  useEffect(() => {
    const handleHashChange = async () => {
      const hash = window.location.hash

      if (hash && hash.includes('access_token')) {
        try {
          const supabase = createClient()

          // Hash fragment를 파싱하여 파라미터 추출
          const hashParams = new URLSearchParams(hash.substring(1))
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')

          if (accessToken && refreshToken) {
            // 세션 설정
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            })

            if (sessionError) {
              throw sessionError
            }
          }
        } catch (err) {
          console.error('Session setup error:', err)
          setError('인증에 실패했습니다. 비밀번호 재설정 링크를 다시 요청해주세요.')
        } finally {
          setIsVerifying(false)
        }
      } else {
        // hash가 없으면 로그인 페이지로
        router.push('/login')
      }
    }

    handleHashChange()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    if (newPassword.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.')
      return
    }

    setIsLoading(true)

    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (updateError) {
        throw updateError
      }

      setSuccess(true)
    } catch (err) {
      console.error('Password reset error:', err)
      setError(err instanceof Error ? err.message : '비밀번호 변경에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
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

          <h1 className="text-3xl font-bold mb-2">비밀번호 재설정</h1>

          {isVerifying ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mb-4" />
              <p className="text-muted-foreground">인증 확인 중...</p>
            </div>
          ) : success ? (
            <div className="space-y-5 mt-6">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-800">
                      비밀번호가 변경되었습니다
                    </p>
                    <p className="text-sm text-green-700 mt-1">
                      새 비밀번호로 로그인할 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>
              <Button
                type="button"
                className="w-full h-12 rounded-full text-base font-medium"
                style={{ backgroundColor: siteSettings.primaryColor }}
                onClick={() => {
                  router.push('/daily-log')
                  router.refresh()
                }}
              >
                시작하기
              </Button>
            </div>
          ) : (
            <>
              <p className="text-muted-foreground mb-8">
                새로운 비밀번호를 입력해주세요.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">새 비밀번호</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    minLength={6}
                    className="h-12 rounded-full px-5"
                  />
                  <p className="text-xs text-muted-foreground">
                    최소 6자 이상
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">새 비밀번호 확인</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    minLength={6}
                    className="h-12 rounded-full px-5"
                  />
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
                    '비밀번호 변경'
                  )}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* 오른쪽: 배경 이미지 (데스크탑에서만 표시) */}
      {siteSettings.loginBgImageUrl && (
        <div className="hidden lg:block lg:w-1/2 xl:w-[55%] relative">
          <Image
            src={siteSettings.loginBgImageUrl}
            alt="Background"
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
