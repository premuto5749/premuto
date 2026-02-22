'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronUp, ChevronDown, RotateCcw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { useCardLayout, ALL_CATEGORIES, invalidateCardLayoutCache } from '@/hooks/use-card-layout'
import { LOG_CATEGORY_CONFIG } from '@/types'
import type { CardLayoutItem } from '@/types'

export function CardLayoutSection() {
  const { layout, saveLayout, isLoading } = useCardLayout()
  const { toast } = useToast()

  // 로컬 편집 상태 — layout이 null이면 ALL_CATEGORIES 기본값 사용
  const [items, setItems] = useState<CardLayoutItem[]>(() => buildItems(layout))

  // layout 로드 후 동기화
  useEffect(() => {
    setItems(buildItems(layout))
  }, [layout])

  function buildItems(saved: CardLayoutItem[] | null): CardLayoutItem[] {
    if (saved && saved.length > 0) {
      // 기존 저장값 기준 + 새 카테고리 보충
      const existing = new Set(saved.map(i => i.category))
      const result = [...saved]
      for (const cat of ALL_CATEGORIES) {
        if (!existing.has(cat)) {
          result.push({ category: cat, visible: true })
        }
      }
      return result
    }
    return ALL_CATEGORIES.map(cat => ({ category: cat, visible: true }))
  }

  const persist = useCallback(async (newItems: CardLayoutItem[]) => {
    setItems(newItems)
    invalidateCardLayoutCache()
    await saveLayout(newItems)
  }, [saveLayout])

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const next = [...items]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    persist(next)
  }

  const handleMoveDown = (index: number) => {
    if (index === items.length - 1) return
    const next = [...items]
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    persist(next)
  }

  const handleToggleVisible = (index: number) => {
    const item = items[index]
    // 최소 1개 visible 유지
    if (item.visible) {
      const visibleCount = items.filter(i => i.visible).length
      if (visibleCount <= 1) {
        toast({
          title: '최소 1개 필요',
          description: '최소 1개의 카테고리는 표시해야 합니다.',
          variant: 'destructive',
        })
        return
      }
    }
    const next = [...items]
    next[index] = { ...item, visible: !item.visible }
    persist(next)
  }

  const handleReset = () => {
    invalidateCardLayoutCache()
    saveLayout(null)
    setItems(ALL_CATEGORIES.map(cat => ({ category: cat, visible: true })))
    toast({ title: '초기화 완료', description: '기본 순서로 되돌렸습니다.' })
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          로딩 중...
        </CardContent>
      </Card>
    )
  }

  const visibleItems = items.filter(i => i.visible)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">카드 배치</CardTitle>
            <CardDescription>요약 카드에 표시할 항목과 순서를 설정하세요</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-1" />
            초기화
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 순서/표시 편집 리스트 */}
        <div className="space-y-1">
          {items.map((item, index) => {
            const config = LOG_CATEGORY_CONFIG[item.category]
            return (
              <div
                key={item.category}
                className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                  item.visible ? 'bg-muted/50' : 'bg-muted/20 opacity-60'
                }`}
              >
                <Checkbox
                  checked={item.visible}
                  onCheckedChange={() => handleToggleVisible(index)}
                />
                <span className="text-xl w-8 text-center">{config.icon}</span>
                <span className="flex-1 text-sm font-medium">{config.label}</span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === items.length - 1}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        {/* 미리보기 */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">미리보기</p>
          <div className="grid grid-cols-3 gap-2">
            {visibleItems.map((item) => {
              const config = LOG_CATEGORY_CONFIG[item.category]
              return (
                <div
                  key={item.category}
                  className="p-2 rounded-lg bg-muted/50 text-center"
                >
                  <div className="text-lg">{config.icon}</div>
                  <div className="text-xs text-muted-foreground">{config.label}</div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
