'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AppHeader } from '@/components/layout/AppHeader'
import { Loader2, ShieldCheck, Plus, Trash2, ArrowLeft, Upload, ToggleLeft, ToggleRight } from 'lucide-react'

interface Flyer {
  id: string
  imagePath: string
  imageUrl: string
  title: string
  status: 'active' | 'closed'
  createdAt: string
  updatedAt: string
}

export default function LostAnimalsAdminPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [flyers, setFlyers] = useState<Flyer[]>([])
  const [title, setTitle] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const adminRes = await fetch('/api/admin/stats')
        if (adminRes.status === 403) {
          setError('관리자 권한이 필요합니다')
          setAuthorized(false)
          setLoading(false)
          return
        }
        setAuthorized(true)

        const res = await fetch('/api/lost-animals')
        const data = await res.json()
        if (data.success) {
          setFlyers(data.data || [])
        }
      } catch (err) {
        console.error('Failed to fetch flyers:', err)
        setError('전단지 목록을 불러오는데 실패했습니다')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const handleUpload = async () => {
    if (!selectedFile || !title.trim()) {
      setError('제목과 이미지를 모두 입력해주세요')
      return
    }

    setUploading(true)
    setError(null)
    setSuccess(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('title', title.trim())

      const res = await fetch('/api/admin/lost-animals', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '업로드 실패')
        return
      }

      setFlyers(prev => [...prev, data.data])
      setSuccess('전단지가 등록되었습니다')
      setTitle('')
      setSelectedFile(null)
      setPreviewUrl(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      console.error('Upload error:', err)
      setError('업로드 중 오류가 발생했습니다')
    } finally {
      setUploading(false)
    }
  }

  const handleToggleStatus = async (flyer: Flyer) => {
    const newStatus = flyer.status === 'active' ? 'closed' : 'active'

    try {
      setError(null)
      const res = await fetch('/api/admin/lost-animals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: flyer.id, status: newStatus }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '상태 변경 실패')
        return
      }

      setFlyers(prev => prev.map(f => f.id === flyer.id ? data.data : f))
      setSuccess(`전단지가 ${newStatus === 'active' ? '활성화' : '종료'}되었습니다`)
    } catch (err) {
      console.error('Toggle error:', err)
      setError('상태 변경 중 오류가 발생했습니다')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 전단지를 삭제하시겠습니까? 이미지도 함께 삭제됩니다.')) return

    try {
      setError(null)
      const res = await fetch(`/api/admin/lost-animals?id=${id}`, { method: 'DELETE' })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '삭제 실패')
        return
      }

      setFlyers(prev => prev.filter(f => f.id !== id))
      setSuccess('전단지가 삭제되었습니다')
    } catch (err) {
      console.error('Delete error:', err)
      setError('삭제 중 오류가 발생했습니다')
    }
  }

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
      <AppHeader title="유실 동물 전단지 관리" />

      <div className="container max-w-4xl mx-auto py-6 px-4">
        {/* 뒤로가기 */}
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => router.push('/admin')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          관리자 대시보드
        </Button>

        {/* 알림 메시지 */}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* 업로드 폼 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="w-5 h-5" />
              새 전단지 등록
            </CardTitle>
            <CardDescription>유실 동물 전단지 이미지를 업로드합니다 (최대 5MB, PNG/JPEG/WebP/GIF)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">제목</Label>
              <Input
                id="title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="예: 골든리트리버 찾습니다 - 강남구"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">전단지 이미지</Label>
              <Input
                id="file"
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleFileSelect}
              />
            </div>

            {previewUrl && (
              <div className="relative w-48 aspect-[3/4] rounded-lg overflow-hidden border">
                <Image
                  src={previewUrl}
                  alt="미리보기"
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            )}

            <Button onClick={handleUpload} disabled={uploading || !selectedFile || !title.trim()}>
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              업로드
            </Button>
          </CardContent>
        </Card>

        {/* 전단지 목록 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">등록된 전단지 ({flyers.length}개)</CardTitle>
            <CardDescription>등록된 전단지를 관리합니다. 종료된 전단지는 갤러리에서 어둡게 표시됩니다.</CardDescription>
          </CardHeader>
          <CardContent>
            {flyers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                등록된 전단지가 없습니다
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {flyers
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map(flyer => (
                    <div key={flyer.id} className="border rounded-lg overflow-hidden">
                      <div className={`relative aspect-[3/4] ${flyer.status === 'closed' ? 'opacity-50' : ''}`}>
                        <Image
                          src={flyer.imageUrl}
                          alt={flyer.title}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <div className="p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className={`inline-block w-2 h-2 rounded-full ${
                            flyer.status === 'active' ? 'bg-green-500' : 'bg-gray-300'
                          }`} />
                          <span className="text-sm font-medium truncate flex-1">{flyer.title}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(flyer.createdAt).toLocaleDateString('ko-KR')}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs"
                            onClick={() => handleToggleStatus(flyer)}
                          >
                            {flyer.status === 'active' ? (
                              <><ToggleRight className="w-3 h-3 mr-1" />종료</>
                            ) : (
                              <><ToggleLeft className="w-3 h-3 mr-1" />활성화</>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive text-xs"
                            onClick={() => handleDelete(flyer.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
