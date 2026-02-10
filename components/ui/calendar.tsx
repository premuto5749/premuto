"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "./button"

interface CalendarProps {
  selected?: Date
  onSelect?: (date: Date) => void
  maxDate?: Date
  className?: string
}

const DAYS = ['일', '월', '화', '수', '목', '금', '토']

export function Calendar({ selected, onSelect, maxDate, className }: CalendarProps) {
  const [viewDate, setViewDate] = React.useState(() => selected || new Date())

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  // 해당 월의 첫째 날
  const firstDay = new Date(year, month, 1)
  // 해당 월의 마지막 날
  const lastDay = new Date(year, month + 1, 0)
  // 첫째 날의 요일 (0 = 일요일)
  const startDayOfWeek = firstDay.getDay()
  // 해당 월의 총 일수
  const daysInMonth = lastDay.getDate()

  const prevMonth = () => {
    setViewDate(new Date(year, month - 1, 1))
  }

  const nextMonth = () => {
    const next = new Date(year, month + 1, 1)
    if (!maxDate || next <= new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0)) {
      setViewDate(next)
    }
  }

  const selectDate = (day: number) => {
    const newDate = new Date(year, month, day)
    if (maxDate && newDate > maxDate) return
    onSelect?.(newDate)
  }

  const isSelected = (day: number) => {
    if (!selected) return false
    return (
      selected.getFullYear() === year &&
      selected.getMonth() === month &&
      selected.getDate() === day
    )
  }

  const isToday = (day: number) => {
    const today = new Date()
    return (
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === day
    )
  }

  const isDisabled = (day: number) => {
    if (!maxDate) return false
    const date = new Date(year, month, day)
    return date > maxDate
  }

  // 다음 달로 이동 가능한지 확인
  const canGoNext = () => {
    if (!maxDate) return true
    const nextMonthFirstDay = new Date(year, month + 1, 1)
    return nextMonthFirstDay <= maxDate
  }

  // 달력 날짜 배열 생성
  const days: (number | null)[] = []
  // 첫째 주 빈칸
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(null)
  }
  // 날짜들
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i)
  }

  return (
    <div className={cn("p-4", className)}>
      {/* 헤더: 월 네비게이션 */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={prevMonth} className="h-9 w-9">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-medium text-sm">
          {year}년 {month + 1}월
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={nextMonth}
          disabled={!canGoNext()}
          className="h-9 w-9"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAYS.map((day, i) => (
          <div
            key={day}
            className={cn(
              "text-center text-xs font-medium h-9 flex items-center justify-center",
              i === 0 && "text-red-500",
              i === 6 && "text-blue-500"
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => (
          <div key={index} className="flex items-center justify-center">
            {day !== null ? (
              <button
                onClick={() => selectDate(day)}
                disabled={isDisabled(day)}
                className={cn(
                  "h-9 w-9 flex items-center justify-center text-sm rounded-full transition-colors",
                  isSelected(day) && "bg-primary text-primary-foreground",
                  !isSelected(day) && isToday(day) && "bg-muted font-semibold",
                  !isSelected(day) && !isToday(day) && "hover:bg-muted",
                  isDisabled(day) && "text-muted-foreground/50 cursor-not-allowed hover:bg-transparent",
                  // 일요일
                  index % 7 === 0 && !isSelected(day) && !isDisabled(day) && "text-red-500",
                  // 토요일
                  index % 7 === 6 && !isSelected(day) && !isDisabled(day) && "text-blue-500"
                )}
              >
                {day}
              </button>
            ) : (
              <div className="h-9 w-9" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
