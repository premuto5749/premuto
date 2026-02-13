'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trash2, History, ChevronRight } from 'lucide-react'
import { calculateMixedCalorieDensity } from '@/lib/calorie'
import type { FeedingPlan } from '@/types'

interface FeedingPlanHistoryProps {
  plans: FeedingPlan[]
  onSelect: (plan: FeedingPlan) => void
  onDelete: (id: string) => void
  isLoading: boolean
}

export function FeedingPlanHistory({ plans, onSelect, onDelete, isLoading }: FeedingPlanHistoryProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="w-4 h-4" />
            급여 계획 기록
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-4">
            불러오는 중...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (plans.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="w-4 h-4" />
            급여 계획 기록
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-4">
            저장된 급여 계획이 없습니다
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="w-4 h-4" />
          급여 계획 기록
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {plans.map((plan) => {
          const mixedDensity = calculateMixedCalorieDensity(plan.foods)
          const dailyGrams = mixedDensity > 0 ? Math.round(plan.der / mixedDensity) : null

          return (
            <div
              key={plan.id}
              className="flex items-center gap-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => onSelect(plan)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {plan.plan_date}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {plan.weight_kg}kg
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                  {plan.foods.map((f, i) => (
                    <span key={i}>
                      {i > 0 && ' + '}
                      {f.name}
                      {plan.foods.length > 1 && ` ${f.ratio_percent}%`}
                    </span>
                  ))}
                </div>
                <div className="text-xs mt-0.5">
                  <span className="text-primary font-medium">{plan.der} kcal</span>
                  {dailyGrams != null && (
                    <span className="text-muted-foreground"> · {dailyGrams}g/일</span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(plan.id)
                }}
              >
                <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
