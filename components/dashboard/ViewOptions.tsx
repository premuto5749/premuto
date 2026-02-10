'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'

export type SortType = 'by_exam_type' | 'by_organ' | 'by_clinical_priority' | 'by_panel'

interface SortConfig {
  order?: string[]
  order_groups?: Array<{ label: string; items: string[] }>
  panels?: Array<{ panel: string; label: string; items: string[] }>
}

interface ViewOptionsProps {
  sortType: SortType
  onSortTypeChange: (type: SortType) => void
  organFilter: string | null
  onOrganFilterChange: (organ: string | null) => void
  panelFilter: string | null
  onPanelFilterChange: (panel: string | null) => void
}

const SORT_TYPE_LABELS: Record<SortType, string> = {
  by_exam_type: '검사유형별',
  by_organ: '장기별',
  by_clinical_priority: '임상 우선순위별',
  by_panel: '검사 패널별',
}

const ORGAN_OPTIONS = [
  '기본신체', '혈액', '간', '신장', '췌장', '심장', '전해질', '산염기',
  '호흡', '지혈', '면역', '염증', '대사', '내분비', '근육', '뼈',
  '담도', '영양', '알레르기', '감염', '안과'
]

const PANEL_OPTIONS = [
  { value: 'Basic', label: '기본 혈액검사' },
  { value: 'Pre-anesthetic', label: '마취 전 검사' },
  { value: 'Senior', label: '노령견 종합' },
  { value: 'Pancreatitis', label: '췌장염 집중' },
  { value: 'Coagulation', label: '응고 검사' },
  { value: 'Emergency', label: '응급/중환자' },
  { value: 'Cardiac', label: '심장 검사' },
  { value: 'Kidney', label: '신장 집중' },
]

export function ViewOptions({
  sortType,
  onSortTypeChange,
  organFilter,
  onOrganFilterChange,
  panelFilter,
  onPanelFilterChange,
}: ViewOptionsProps) {
  const handleSortTypeChange = (value: string) => {
    const newSortType = value as SortType
    onSortTypeChange(newSortType)

    // 정렬 유형 변경 시 필터 초기화
    if (newSortType !== 'by_organ') {
      onOrganFilterChange(null)
    }
    if (newSortType !== 'by_panel') {
      onPanelFilterChange(null)
    }
  }

  const handleClearFilters = () => {
    onOrganFilterChange(null)
    onPanelFilterChange(null)
  }

  const hasActiveFilter = organFilter || panelFilter

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* 정렬 방식 선택 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground whitespace-nowrap">정렬:</span>
        <Select value={sortType} onValueChange={handleSortTypeChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SORT_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 장기 필터 (장기별 정렬 선택 시) */}
      {sortType === 'by_organ' && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">장기:</span>
          <Select
            value={organFilter || 'all'}
            onValueChange={(v) => onOrganFilterChange(v === 'all' ? null : v)}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              {ORGAN_OPTIONS.map((organ) => (
                <SelectItem key={organ} value={organ}>
                  {organ}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* 패널 필터 (패널별 정렬 선택 시) */}
      {sortType === 'by_panel' && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">패널:</span>
          <Select
            value={panelFilter || 'all'}
            onValueChange={(v) => onPanelFilterChange(v === 'all' ? null : v)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              {PANEL_OPTIONS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* 활성 필터 표시 및 초기화 */}
      {hasActiveFilter && (
        <div className="flex items-center gap-2">
          {organFilter && (
            <Badge variant="secondary" className="gap-1">
              {organFilter}
              <X
                className="w-3 h-3 cursor-pointer hover:text-destructive"
                onClick={() => onOrganFilterChange(null)}
              />
            </Badge>
          )}
          {panelFilter && (
            <Badge variant="secondary" className="gap-1">
              {PANEL_OPTIONS.find(p => p.value === panelFilter)?.label || panelFilter}
              <X
                className="w-3 h-3 cursor-pointer hover:text-destructive"
                onClick={() => onPanelFilterChange(null)}
              />
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="text-xs h-7"
          >
            필터 초기화
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * 정렬 설정을 가져오는 유틸리티
 */
export async function fetchSortConfig(sortType: SortType): Promise<SortConfig | null> {
  try {
    const response = await fetch(`/api/sort-orders/${sortType}`)
    if (!response.ok) return null
    const data = await response.json()
    return data.config
  } catch {
    return null
  }
}

/**
 * 정렬 유형에 따라 항목을 그룹화하고 정렬
 */
export function groupItemsBySortType(
  items: Array<{ name: string; category?: string | null; exam_type?: string | null; organ_tags?: string[] | null }>,
  sortType: SortType,
  organFilter?: string | null,
  panelFilter?: string | null
): Map<string, typeof items> {
  const groups = new Map<string, typeof items>()

  // 패널별 아이템 매핑 (검사 패널별 정렬용)
  const panelItems: Record<string, string[]> = {
    'Basic': ['WBC', 'RBC', 'HGB', 'HCT', 'PLT', 'ALT', 'BUN', 'Creatinine', 'Glucose', 'Protein-Total'],
    'Pre-anesthetic': ['WBC', 'RBC', 'HGB', 'HCT', 'PLT', 'ALT', 'AST', 'BUN', 'Creatinine', 'Glucose', 'Protein-Total', 'Albumin', 'PT', 'APTT'],
    'Senior': ['WBC', 'RBC', 'HGB', 'HCT', 'PLT', 'ALT', 'AST', 'ALKP', 'GGT', 'BUN', 'Creatinine', 'SDMA', 'Glucose', 'Protein-Total', 'Albumin', 'T.Cholesterol', 'Triglycerides', 'T.Bilirubin', 'Phosphorus', 'Calcium', 'Na', 'K', 'Cl', 'CRP', 'UPC', '요비중'],
    'Pancreatitis': ['cPL', 'Lipase', 'Amylase', 'Glucose', 'Triglycerides', 'Calcium', 'CRP', 'WBC'],
    'Coagulation': ['PLT', 'PT', 'APTT', 'Fibrinogen', 'D-dimer', 'TEG_R', 'TEG_K', 'TEG_Angle', 'TEG_MA'],
    'Emergency': ['pH', 'pCO2', 'pO2', 'cHCO3', 'BE', 'Lactate', 'Lactate(BG)', 'Na', 'Na(BG)', 'K', 'K(BG)', 'Cl', 'Cl(BG)', 'Calcium', 'Ca(BG)', 'HCT', 'HCT(BG)', 'HGB', 'tHb(BG)', 'Glucose', 'Glucose(BG)'],
    'Cardiac': ['proBNP', '심장사상충', 'E', 'LVIDd', 'Systolic BP', 'CK'],
    'Kidney': ['BUN', 'Creatinine', 'BUN:Cr Ratio', 'SDMA', 'Phosphorus', 'Calcium', 'UPC', 'PH(뇨)', '요비중', 'mOsm', 'K', 'Na', 'Albumin'],
  }

  switch (sortType) {
    case 'by_exam_type': {
      const typeOrder = ['Vital', 'CBC', 'Chemistry', 'Special', 'Blood Gas', 'Coagulation', '뇨검사', '안과검사', 'Echo']

      items.forEach(item => {
        const type = item.exam_type || item.category || 'Other'
        if (!groups.has(type)) {
          groups.set(type, [])
        }
        groups.get(type)!.push(item)
      })

      // 순서대로 정렬된 새 Map 반환
      const sortedGroups = new Map<string, typeof items>()
      typeOrder.forEach(type => {
        if (groups.has(type)) {
          sortedGroups.set(type, groups.get(type)!)
        }
      })
      // 나머지 그룹 추가
      groups.forEach((value, key) => {
        if (!sortedGroups.has(key)) {
          sortedGroups.set(key, value)
        }
      })
      return sortedGroups
    }

    case 'by_organ': {
      const organOrder = ['기본신체', '혈액', '간', '신장', '췌장', '심장', '전해질', '산염기', '호흡', '지혈', '면역', '염증', '대사', '내분비', '근육', '뼈', '담도', '영양', '알레르기', '감염', '안과']

      items.forEach(item => {
        const tags = item.organ_tags || []
        if (tags.length === 0) {
          if (!groups.has('기타')) {
            groups.set('기타', [])
          }
          groups.get('기타')!.push(item)
        } else {
          tags.forEach(tag => {
            // 필터가 있으면 해당 장기만
            if (organFilter && tag !== organFilter) return

            if (!groups.has(tag)) {
              groups.set(tag, [])
            }
            // 중복 방지
            if (!groups.get(tag)!.some(i => i.name === item.name)) {
              groups.get(tag)!.push(item)
            }
          })
        }
      })

      // 필터가 있으면 해당 그룹만 반환
      if (organFilter) {
        const filtered = new Map<string, typeof items>()
        if (groups.has(organFilter)) {
          filtered.set(organFilter, groups.get(organFilter)!)
        }
        return filtered
      }

      // 순서대로 정렬
      const sortedGroups = new Map<string, typeof items>()
      organOrder.forEach(organ => {
        if (groups.has(organ)) {
          sortedGroups.set(organ, groups.get(organ)!)
        }
      })
      if (groups.has('기타')) {
        sortedGroups.set('기타', groups.get('기타')!)
      }
      return sortedGroups
    }

    case 'by_panel': {
      // 패널 필터가 있으면 해당 패널만
      if (panelFilter) {
        const panelItemNames = panelItems[panelFilter] || []
        const panelLabel = PANEL_OPTIONS.find(p => p.value === panelFilter)?.label || panelFilter
        const filtered = items.filter(item => panelItemNames.includes(item.name))
        groups.set(panelLabel, filtered)
        return groups
      }

      // 전체 패널
      Object.entries(panelItems).forEach(([panel, itemNames]) => {
        const panelLabel = PANEL_OPTIONS.find(p => p.value === panel)?.label || panel
        const panelItemsList = items.filter(item => itemNames.includes(item.name))
        if (panelItemsList.length > 0) {
          groups.set(panelLabel, panelItemsList)
        }
      })
      return groups
    }

    case 'by_clinical_priority':
    default: {
      // 기본은 exam_type과 동일
      return groupItemsBySortType(items, 'by_exam_type')
    }
  }
}
