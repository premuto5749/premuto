import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Date 객체를 로컬 타임존 기준 YYYY-MM-DD 문자열로 변환
 * toISOString()은 UTC로 변환하므로 KST(UTC+9) 등에서 날짜가 하루 밀리는 버그 방지
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** 숫자를 1000단위 컴마 포맷으로 변환 (소수점 유지) */
export function formatNumber(value: number): string {
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 10 })
}
