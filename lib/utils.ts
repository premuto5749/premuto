import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 숫자를 1000단위 컴마 포맷으로 변환 (소수점 유지) */
export function formatNumber(value: number): string {
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 10 })
}
