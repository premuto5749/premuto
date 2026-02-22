'use client'

import { useState, useEffect, useCallback } from 'react'
import type { CardLayoutItem, LogCategory } from '@/types'

// 각 소비자별 기본 카테고리 순서
const DAILY_DEFAULT: LogCategory[] = ['meal', 'water', 'snack', 'poop', 'pee', 'breathing', 'medicine', 'walk']
const MONTHLY_DEFAULT: LogCategory[] = ['meal', 'water', 'snack', 'poop', 'pee', 'medicine', 'breathing', 'weight']
const IMAGE_DEFAULT: LogCategory[] = ['meal', 'water', 'snack', 'poop', 'pee', 'medicine', 'breathing']

// 전체 9개 카테고리 (설정 UI용)
export const ALL_CATEGORIES: LogCategory[] = ['meal', 'water', 'snack', 'poop', 'pee', 'breathing', 'medicine', 'walk', 'weight']

/**
 * savedLayout 기준으로 applicableCategories를 필터/정렬하여 visible 카테고리만 반환
 * 이미지 렌더러 등 hook 밖에서도 사용 가능하도록 순수 함수로 export
 */
export function resolveLayout(
  savedLayout: CardLayoutItem[] | null | undefined,
  applicableCategories: LogCategory[]
): LogCategory[] {
  if (!savedLayout || savedLayout.length === 0) {
    return applicableCategories
  }

  const result: LogCategory[] = []
  const applicable = new Set(applicableCategories)

  // savedLayout 순서대로, applicable에 포함되고 visible인 것만
  for (const item of savedLayout) {
    if (applicable.has(item.category) && item.visible) {
      result.push(item.category)
      applicable.delete(item.category)
    }
  }

  // savedLayout에 없는 새 카테고리는 끝에 추가
  for (const cat of applicableCategories) {
    if (applicable.has(cat)) {
      result.push(cat)
    }
  }

  return result
}

// 모듈 레벨 캐시
let cachedLayout: CardLayoutItem[] | null = null
let cachePromise: Promise<CardLayoutItem[] | null> | null = null
let cacheTimestamp = 0
const CACHE_TTL = 30_000 // 30초

async function fetchLayout(): Promise<CardLayoutItem[] | null> {
  const now = Date.now()
  if (cachedLayout !== null && now - cacheTimestamp < CACHE_TTL) {
    return cachedLayout
  }
  if (cachePromise && now - cacheTimestamp < CACHE_TTL) {
    return cachePromise
  }

  cacheTimestamp = now
  cachePromise = fetch('/api/settings')
    .then(res => res.json())
    .then(data => {
      const layout = data?.data?.card_layout ?? null
      cachedLayout = layout
      return layout
    })
    .catch(() => {
      cachedLayout = null
      return null
    })

  return cachePromise
}

export function invalidateCardLayoutCache() {
  cachedLayout = null
  cachePromise = null
  cacheTimestamp = 0
}

export function useCardLayout() {
  const [layout, setLayout] = useState<CardLayoutItem[] | null>(cachedLayout)
  const [isLoading, setIsLoading] = useState(cachedLayout === null)

  useEffect(() => {
    let cancelled = false
    fetchLayout().then(l => {
      if (!cancelled) {
        setLayout(l)
        setIsLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  const saveLayout = useCallback(async (newLayout: CardLayoutItem[] | null) => {
    setLayout(newLayout)
    cachedLayout = newLayout
    cacheTimestamp = Date.now()

    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card_layout: newLayout }),
    })
  }, [])

  const dailyCategories = resolveLayout(layout, DAILY_DEFAULT)
  const monthlyCategories = resolveLayout(layout, MONTHLY_DEFAULT)
  const imageCategories = resolveLayout(layout, IMAGE_DEFAULT)

  return {
    layout,
    isLoading,
    saveLayout,
    dailyCategories,
    monthlyCategories,
    imageCategories,
  }
}
