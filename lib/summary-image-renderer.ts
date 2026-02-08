/**
 * NRC 스타일 건강 요약 이미지 렌더러
 * Canvas 2D API로 반려동물 사진 위에 건강 기록 오버레이 합성
 */

import type { DailyStats } from '@/types'
import { LOG_CATEGORY_CONFIG } from '@/types'
import { formatNumber } from '@/lib/utils'

export type SummaryTheme = 'white' | 'dark'

interface RenderOptions {
  photo: File | Blob
  petName: string
  date: string // YYYY-MM-DD
  stats: DailyStats
  theme: SummaryTheme
  logoImg: HTMLImageElement
  outputWidth?: number
}

interface StatItem {
  icon: string
  label: string
  value: string
  count: number
}

function buildStatItems(stats: DailyStats): StatItem[] {
  return [
    {
      icon: LOG_CATEGORY_CONFIG.meal.icon,
      label: '식사',
      value: stats.total_meal_amount > 0 ? `${formatNumber(stats.total_meal_amount)}g` : '-',
      count: stats.meal_count,
    },
    {
      icon: LOG_CATEGORY_CONFIG.water.icon,
      label: '음수',
      value: stats.total_water_amount > 0 ? `${formatNumber(stats.total_water_amount)}ml` : '-',
      count: stats.water_count,
    },
    {
      icon: LOG_CATEGORY_CONFIG.medicine.icon,
      label: '약',
      value: stats.medicine_count > 0 ? `${stats.medicine_count}회` : '-',
      count: stats.medicine_count,
    },
    {
      icon: LOG_CATEGORY_CONFIG.poop.icon,
      label: '배변',
      value: stats.poop_count > 0 ? `${stats.poop_count}회` : '-',
      count: stats.poop_count,
    },
    {
      icon: LOG_CATEGORY_CONFIG.pee.icon,
      label: '배뇨',
      value: stats.pee_count > 0 ? `${stats.pee_count}회` : '-',
      count: stats.pee_count,
    },
    {
      icon: LOG_CATEGORY_CONFIG.breathing.icon,
      label: '호흡수',
      value: stats.avg_breathing_rate ? `${Math.round(stats.avg_breathing_rate)}회/분` : '-',
      count: stats.breathing_count,
    },
  ]
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}

/**
 * 로고 이미지를 지정된 색상으로 변환
 * Canvas globalCompositeOperation = 'source-in' 사용
 */
function tintLogo(logo: HTMLImageElement, color: string, size: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!

  // 로고를 정사각형 영역에 비율 유지하며 그리기
  const scale = Math.min(size / logo.naturalWidth, size / logo.naturalHeight)
  const w = logo.naturalWidth * scale
  const h = logo.naturalHeight * scale
  const x = (size - w) / 2
  const y = (size - h) / 2

  ctx.drawImage(logo, x, y, w, h)

  // source-in: 기존 픽셀의 알파를 유지하면서 색상만 변경
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, size, size)

  return c
}

function formatDateKorean(dateStr: string): string {
  const d = new Date(dateStr)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}.${month}.${day}`
}

export async function renderSummaryImage(options: RenderOptions): Promise<Blob> {
  const { photo, petName, date, stats, theme, logoImg, outputWidth = 1080 } = options

  // 폰트 로드 대기
  try {
    await document.fonts.ready
  } catch {
    // 폰트 로드 실패 시 시스템 폰트로 대체
  }

  const fontFamily = 'Pretendard, -apple-system, BlinkMacSystemFont, sans-serif'

  // 사진 로드
  const photoUrl = URL.createObjectURL(photo)
  let photoImg: HTMLImageElement
  try {
    photoImg = await loadImage(photoUrl)
  } finally {
    URL.revokeObjectURL(photoUrl)
  }

  // 캔버스 크기 계산 (최대 4:5 비율)
  const photoAspect = photoImg.naturalHeight / photoImg.naturalWidth
  const maxAspect = 5 / 4 // 4:5 비율
  const canvasHeight = Math.round(outputWidth * Math.min(photoAspect, maxAspect))

  const canvas = document.createElement('canvas')
  canvas.width = outputWidth
  canvas.height = canvasHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Unable to get canvas 2D context')
  }

  // 사진 그리기 (중앙 크롭)
  const srcAspect = photoImg.naturalHeight / photoImg.naturalWidth
  const dstAspect = canvasHeight / outputWidth

  let sx = 0, sy = 0, sw = photoImg.naturalWidth, sh = photoImg.naturalHeight
  if (srcAspect > dstAspect) {
    // 사진이 더 세로로 긴 경우 — 위아래 크롭
    sh = photoImg.naturalWidth * dstAspect
    sy = (photoImg.naturalHeight - sh) / 2
  } else {
    // 사진이 더 가로로 긴 경우 — 좌우 크롭
    sw = photoImg.naturalHeight / dstAspect
    sx = (photoImg.naturalWidth - sw) / 2
  }

  ctx.drawImage(photoImg, sx, sy, sw, sh, 0, 0, outputWidth, canvasHeight)

  // 테마 색상 설정
  const textColor = theme === 'white' ? '#FFFFFF' : '#333333'
  const shadowColor = theme === 'white' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)'

  // 하단 그라디언트 오버레이 (가독성 확보)
  const gradientHeight = canvasHeight * 0.45
  const gradient = ctx.createLinearGradient(0, canvasHeight - gradientHeight, 0, canvasHeight)
  if (theme === 'white') {
    gradient.addColorStop(0, 'rgba(0,0,0,0)')
    gradient.addColorStop(0.5, 'rgba(0,0,0,0.3)')
    gradient.addColorStop(1, 'rgba(0,0,0,0.6)')
  } else {
    gradient.addColorStop(0, 'rgba(255,255,255,0)')
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.3)')
    gradient.addColorStop(1, 'rgba(255,255,255,0.6)')
  }
  ctx.fillStyle = gradient
  ctx.fillRect(0, canvasHeight - gradientHeight, outputWidth, gradientHeight)

  // 텍스트 그림자 설정 헬퍼
  const setShadow = (blur: number) => {
    ctx.shadowColor = shadowColor
    ctx.shadowBlur = blur
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 1
  }

  const clearShadow = () => {
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
  }

  const padding = outputWidth * 0.06 // 양쪽 패딩

  // 우상단 로고
  const logoSize = outputWidth * 0.12
  const tintedLogo = tintLogo(logoImg, textColor, logoSize)
  setShadow(8)
  ctx.drawImage(tintedLogo, outputWidth - padding - logoSize, padding)
  clearShadow()

  // 우상단 로고 아래 "미모의" + "하루" 텍스트
  const brandFontSize = outputWidth * 0.032
  ctx.fillStyle = textColor
  ctx.textAlign = 'right'

  setShadow(6)
  ctx.font = `600 ${brandFontSize}px ${fontFamily}`
  ctx.fillText('미모의', outputWidth - padding, padding + logoSize + brandFontSize + 4)
  ctx.fillText('하루', outputWidth - padding, padding + logoSize + brandFontSize * 2 + 8)
  clearShadow()

  // 하단 스탯 영역 (3x2 그리드)
  const statItems = buildStatItems(stats)
  const cols = 3
  const rows = 2
  const statAreaBottom = canvasHeight - padding * 2 // 최하단 이름+날짜 위
  const rowHeight = outputWidth * 0.1
  const statAreaTop = statAreaBottom - rows * rowHeight - padding * 0.5

  const colWidth = (outputWidth - padding * 2) / cols

  setShadow(6)
  ctx.fillStyle = textColor

  for (let i = 0; i < statItems.length; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = padding + col * colWidth
    const y = statAreaTop + row * rowHeight

    const item = statItems[i]

    // 아이콘 + 라벨
    const iconFontSize = outputWidth * 0.038
    ctx.font = `${iconFontSize}px ${fontFamily}`
    ctx.textAlign = 'left'
    clearShadow() // 이모지에는 그림자 제거
    ctx.fillText(item.icon, x, y + iconFontSize)

    setShadow(6)
    ctx.fillStyle = textColor
    ctx.font = `400 ${outputWidth * 0.028}px ${fontFamily}`
    ctx.fillText(` ${item.label}`, x + iconFontSize * 1.1, y + iconFontSize)

    // 값
    const valueFontSize = outputWidth * 0.042
    ctx.font = `700 ${valueFontSize}px ${fontFamily}`
    ctx.fillText(item.value, x, y + iconFontSize + valueFontSize + 4)

    // 횟수 (meal, water에만 표시)
    if (item.count > 0 && (i === 0 || i === 1)) {
      const countFontSize = outputWidth * 0.024
      ctx.font = `700 ${valueFontSize}px ${fontFamily}`
      const vw = ctx.measureText(item.value).width
      ctx.font = `400 ${countFontSize}px ${fontFamily}`
      ctx.fillText(` (${item.count}회)`, x + vw, y + iconFontSize + valueFontSize + 4)
    }
  }

  // 최하단: petName · 날짜
  const bottomY = canvasHeight - padding
  const bottomFontSize = outputWidth * 0.032
  ctx.font = `500 ${bottomFontSize}px ${fontFamily}`
  ctx.textAlign = 'center'
  ctx.fillStyle = textColor
  setShadow(6)
  ctx.fillText(`${petName} · ${formatDateKorean(date)}`, outputWidth / 2, bottomY)
  clearShadow()

  // JPEG Blob 생성
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create image blob'))
          return
        }
        resolve(blob)
      },
      'image/jpeg',
      0.92
    )
  })
}
