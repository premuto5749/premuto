'use client'

import { useState } from 'react'
import type { TagOption } from '@/lib/tag-options'
import { TagReferenceSheet } from './TagReferenceSheet'

interface TagSelectorProps {
  title: string
  options: readonly TagOption[]
  selected: string | null
  onSelect: (value: string | null) => void
  referenceTitle?: string
}

export function TagSelector({ title, options, selected, onSelect, referenceTitle }: TagSelectorProps) {
  const [showReference, setShowReference] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium">{title} <span className="text-muted-foreground font-normal">(선택)</span></label>
        {referenceTitle && (
          <button
            type="button"
            onClick={() => setShowReference(true)}
            className="text-xs text-primary hover:underline"
          >
            기준 보기
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => {
          const isSelected = selected === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(isSelected ? null : option.value)}
              className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border-2 text-sm transition-all ${
                isSelected
                  ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                  : 'border-muted hover:border-primary/40'
              }`}
            >
              {option.color && (
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0 border border-black/10"
                  style={{ backgroundColor: option.color }}
                />
              )}
              {option.icon && !option.color && (
                <span className="flex-shrink-0">{option.icon}</span>
              )}
              <span className="truncate">{option.label}</span>
            </button>
          )
        })}
      </div>

      {referenceTitle && (
        <TagReferenceSheet
          open={showReference}
          onOpenChange={setShowReference}
          title={referenceTitle}
          items={options.map(o => ({
            label: o.label,
            description: o.description || '',
            color: o.color,
            icon: o.icon,
            score: o.score,
          }))}
        />
      )}
    </div>
  )
}
