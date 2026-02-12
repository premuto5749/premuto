'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AppHeader } from '@/components/layout/AppHeader'
import { Loader2, Database, Users, FileText, Tag, Settings, ShieldCheck, BarChart3, AlertTriangle, Sliders, Globe, Megaphone, PawPrint, Utensils } from 'lucide-react'
import Link from 'next/link'

interface AdminStats {
  masterData: {
    standardItems: number
    aliases: number
    examTypes: number
    examTypeCounts: Record<string, number>
  }
  users: {
    total: number
    withCustomData: number
  }
  records: {
    testRecords: number
    testResults: number
    dailyLogs: number
  }
}

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/admin/stats')
        if (res.status === 403) {
          setError('관리자 권한이 필요합니다')
          setAuthorized(false)
          return
        }

        const data = await res.json()
        if (data.success) {
          setAuthorized(true)
          setStats(data.data)
        } else {
          setError(data.error || '권한 확인 실패')
        }
      } catch (err) {
        setError('서버 오류가 발생했습니다')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-muted">
        <AppHeader title="관리자" />
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-muted">
        <AppHeader title="관리자" />
        <div className="container max-w-4xl mx-auto py-10 px-4">
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <ShieldCheck className="w-5 h-5" />
                접근 권한 없음
              </CardTitle>
              <CardDescription>
                {error || '이 페이지에 접근할 권한이 없습니다.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/')}>
                메인으로 돌아가기
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader title="관리자 대시보드" />

      <div className="container max-w-7xl mx-auto py-6 px-4">
        {/* 관리자 배지 */}
        <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-lg flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-primary" />
          <div>
            <p className="font-medium text-primary">관리자 모드</p>
            <p className="text-sm text-muted-foreground">전체 서비스의 마스터 데이터를 관리합니다</p>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Database className="w-4 h-4" />
                표준항목
              </div>
              <div className="text-2xl font-bold">{stats?.masterData.standardItems || 0}개</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Tag className="w-4 h-4" />
                별칭
              </div>
              <div className="text-2xl font-bold text-blue-600">{stats?.masterData.aliases || 0}개</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Users className="w-4 h-4" />
                사용자
              </div>
              <div className="text-2xl font-bold text-green-600">{stats?.users.total || 0}명</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <FileText className="w-4 h-4" />
                검사기록
              </div>
              <div className="text-2xl font-bold text-amber-600">{stats?.records.testRecords || 0}건</div>
            </CardContent>
          </Card>
        </div>

        {/* 관리 메뉴 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link href="/admin/master-data">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Database className="w-5 h-5" />
                  마스터 데이터 관리
                </CardTitle>
                <CardDescription>
                  표준 검사항목과 별칭을 관리합니다. 모든 사용자에게 적용됩니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <span className="text-xs bg-muted px-2 py-1 rounded">표준항목 {stats?.masterData.standardItems || 0}개</span>
                  <span className="text-xs bg-muted px-2 py-1 rounded">별칭 {stats?.masterData.aliases || 0}개</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/mapping-management">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="w-5 h-5" />
                  미분류 항목 정리
                </CardTitle>
                <CardDescription>
                  OCR에서 생성된 미분류(Unmapped) 항목을 표준 항목과 병합하거나 삭제합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">마스터 정리</span>
                  <span className="text-xs bg-muted px-2 py-1 rounded">AI 자동 매핑</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/ocr-settings">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sliders className="w-5 h-5" />
                  OCR 설정
                </CardTitle>
                <CardDescription>
                  이미지 압축, AI 토큰 등 OCR 처리 설정을 조정합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">실시간 반영</span>
                  <span className="text-xs bg-muted px-2 py-1 rounded">간편/일괄 개별 설정</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/site-settings">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Globe className="w-5 h-5" />
                  사이트 설정
                </CardTitle>
                <CardDescription>
                  파비콘, 메타태그, 검색 키워드 등 사이트 기본 정보를 설정합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">SEO 설정</span>
                  <span className="text-xs bg-muted px-2 py-1 rounded">OG 이미지</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/tier-config">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="w-5 h-5" />
                  Tier / 사용 제한 설정
                </CardTitle>
                <CardDescription>
                  사용자 등급별 일일 AI 분석 횟수, 파일 업로드 제한을 설정합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">Tier 관리</span>
                  <span className="text-xs bg-muted px-2 py-1 rounded">사용량 제한</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/users">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="w-5 h-5" />
                  사용자 관리
                </CardTitle>
                <CardDescription>
                  등록된 사용자 목록과 Tier 설정을 관리합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <span className="text-xs bg-muted px-2 py-1 rounded">전체 {stats?.users.total || 0}명</span>
                  <span className="text-xs bg-muted px-2 py-1 rounded">커스텀 데이터 {stats?.users.withCustomData || 0}명</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/popup">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Megaphone className="w-5 h-5" />
                  팝업 공지 관리
                </CardTitle>
                <CardDescription>
                  사이트 접속 시 표시할 팝업 공지를 작성하고 관리합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">다중 공지</span>
                  <span className="text-xs bg-muted px-2 py-1 rounded">기간 설정</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/lost-animals">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <PawPrint className="w-5 h-5" />
                  유실 동물 전단지
                </CardTitle>
                <CardDescription>
                  유실 동물 전단지를 업로드하고 활성/종료 상태를 관리합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">전단지 관리</span>
                  <span className="text-xs bg-muted px-2 py-1 rounded">팝업 노출</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/pet-foods">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Utensils className="w-5 h-5" />
                  사료 데이터베이스
                </CardTitle>
                <CardDescription>
                  사료 정보(브랜드, 칼로리 밀도)를 등록하여 사료량 계산기에서 검색할 수 있게 합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded">사료 등록</span>
                  <span className="text-xs bg-muted px-2 py-1 rounded">칼로리 밀도</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Card className="opacity-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="w-5 h-5" />
                서비스 통계
                <span className="text-xs bg-muted px-2 py-0.5 rounded ml-auto">예정</span>
              </CardTitle>
              <CardDescription>
                전체 서비스 사용 현황과 통계를 확인합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <span className="text-xs bg-muted px-2 py-1 rounded">검사기록 {stats?.records.testRecords || 0}건</span>
                <span className="text-xs bg-muted px-2 py-1 rounded">일일기록 {stats?.records.dailyLogs || 0}건</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 검사 유형별 통계 */}
        {stats?.masterData.examTypeCounts && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">검사 유형별 항목 수</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.masterData.examTypeCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => (
                    <div
                      key={type}
                      className="px-3 py-2 bg-muted rounded-lg text-sm"
                    >
                      <span className="font-medium">{type}</span>
                      <span className="text-muted-foreground ml-2">{count}개</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 설정 바로가기 */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="w-5 h-5" />
              기존 설정 페이지
            </CardTitle>
            <CardDescription>
              마스터 데이터 동기화, Excel 관리 등은 기존 설정 페이지에서도 가능합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href="/settings?tab=data">설정 페이지로 이동</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
