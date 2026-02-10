'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { AppHeader } from '@/components/layout/AppHeader'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'

interface Flyer {
  id: string
  imageUrl: string
  title: string
  status: 'active' | 'closed'
  createdAt: string
}

export default function LostAnimalsPage() {
  const [flyers, setFlyers] = useState<Flyer[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFlyer, setSelectedFlyer] = useState<Flyer | null>(null)

  useEffect(() => {
    const fetchFlyers = async () => {
      try {
        const res = await fetch('/api/lost-animals')
        const data = await res.json()
        if (data.success) {
          // 정렬: active 먼저 → closed, 각 그룹 내 최신순
          const sorted = (data.data || []).sort((a: Flyer, b: Flyer) => {
            if (a.status !== b.status) {
              return a.status === 'active' ? -1 : 1
            }
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          })
          setFlyers(sorted)
        }
      } catch (err) {
        console.error('Failed to fetch flyers:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchFlyers()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-muted">
        <AppHeader title="유실 동물 안내" />
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted">
      <AppHeader title="유실 동물 안내" />

      <div className="container max-w-4xl mx-auto py-6 px-4">
        {flyers.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-4xl mb-4">🐕</p>
            <p>등록된 전단지가 없습니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {flyers.map(flyer => (
              <div
                key={flyer.id}
                className="relative aspect-[3/4] rounded-lg overflow-hidden border bg-white cursor-pointer group"
                onClick={() => setSelectedFlyer(flyer)}
              >
                <Image
                  src={flyer.imageUrl}
                  alt={flyer.title}
                  fill
                  className="object-cover transition-transform group-hover:scale-105"
                  unoptimized
                />
                {flyer.status === 'closed' && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-white text-sm font-medium px-3 py-1.5 bg-black/40 rounded-full">
                      종료된 전단지입니다
                    </span>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
                  <p className="text-white text-sm font-medium truncate">{flyer.title}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 라이트박스 */}
      <Dialog open={!!selectedFlyer} onOpenChange={(open) => { if (!open) setSelectedFlyer(null) }}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogTitle className="sr-only">{selectedFlyer?.title || '전단지'}</DialogTitle>
          <DialogDescription className="sr-only">유실 동물 전단지 상세 보기</DialogDescription>
          {selectedFlyer && (
            <div className="relative">
              <div className="relative w-full" style={{ maxHeight: '80vh' }}>
                <Image
                  src={selectedFlyer.imageUrl}
                  alt={selectedFlyer.title}
                  width={600}
                  height={800}
                  className="w-full h-auto object-contain"
                  unoptimized
                />
              </div>
              {selectedFlyer.status === 'closed' && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none">
                  <span className="text-white text-lg font-medium px-4 py-2 bg-black/40 rounded-full">
                    종료된 전단지입니다
                  </span>
                </div>
              )}
              <div className="p-4 bg-white">
                <p className="font-medium">{selectedFlyer.title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(selectedFlyer.createdAt).toLocaleDateString('ko-KR')}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
