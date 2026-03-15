# Copy & Paste Daily Logs Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to select multiple daily log items and paste them to a different date.

**Architecture:** Client-only feature using React state + sessionStorage. No new API endpoints or DB changes. The Timeline component gets a selection mode with checkboxes. A floating badge shows clipboard state and provides paste action. Paste calls existing POST /api/daily-logs per item.

**Tech Stack:** React state, sessionStorage, existing Shadcn UI components (Checkbox, Dialog, Button), existing POST /api/daily-logs API.

**Spec:** `docs/02-design/features/copy-paste-logs.design.md`

---

## File Structure

| File | Responsibility | Action |
|------|---------------|--------|
| `types/index.ts` | `ClipboardLogItem` interface | Add type |
| `components/daily-log/Timeline.tsx` | Selection mode: checkboxes on selectable items | Modify props |
| `components/daily-log/SelectionActionBar.tsx` | Bottom bar in selection mode: "N개 선택됨" + "전체선택" + "복사" | Create |
| `components/daily-log/ClipboardFloatingBadge.tsx` | Floating badge: "📋 N개 복사됨" + "붙여넣기" + "X" | Create |
| `components/daily-log/PasteConfirmDialog.tsx` | Confirmation dialog with item preview list | Create |
| `app/daily-log/page.tsx` | Selection mode state, clipboard state, sessionStorage sync, paste logic | Modify |

---

## Chunk 1: Types and Timeline Selection Mode

### Task 1: Add ClipboardLogItem type

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Add ClipboardLogItem interface**

After the `DailyLog` interface (around line 230), add:

```typescript
/** 복사/붙여넣기용 클립보드 항목 (핵심 필드만) */
export interface ClipboardLogItem {
  category: LogCategory
  pet_id: string | null
  amount: number | null
  leftover_amount: number | null
  unit: string | null
  medicine_name: string | null
  snack_name: string | null
  calories: number | null
  input_source: 'preset' | 'manual'
  time: string  // "HH:mm" (logged_at에서 추출)
}
```

Also add the selectable categories constant:

```typescript
/** 복사 선택 가능 카테고리 (weight, walk, vomit, note 제외) */
export const COPYABLE_CATEGORIES: LogCategory[] = [
  'meal', 'water', 'snack', 'medicine', 'poop', 'pee', 'breathing'
]
```

- [ ] **Step 2: Commit**

```bash
git add types/index.ts
git commit -m "feat: add ClipboardLogItem type and COPYABLE_CATEGORIES"
```

---

### Task 2: Add selection mode props to Timeline

**Files:**
- Modify: `components/daily-log/Timeline.tsx`

The Timeline component (`Timeline.tsx:46-51`) currently has this interface:

```typescript
interface TimelineProps {
  logs: DailyLog[]
  onDelete?: (id: string) => void
  onUpdate?: (id: string, data: Partial<DailyLog>) => Promise<void>
  petId?: string
}
```

- [ ] **Step 1: Extend TimelineProps**

Add selection mode props:

```typescript
interface TimelineProps {
  logs: DailyLog[]
  onDelete?: (id: string) => void
  onUpdate?: (id: string, data: Partial<DailyLog>) => Promise<void>
  petId?: string
  // Selection mode props
  isSelectionMode?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
}
```

- [ ] **Step 2: Add checkbox rendering in selection mode**

In the `Timeline` component function (`Timeline.tsx:117`), destructure the new props:

```typescript
export function Timeline({ logs, onDelete, onUpdate, petId, isSelectionMode, selectedIds, onToggleSelect }: TimelineProps) {
```

In the timeline item rendering (`Timeline.tsx:540-544`), add a checkbox before each Card when in selection mode.

Import at top:
```typescript
import { Checkbox } from '@/components/ui/checkbox'
import { COPYABLE_CATEGORIES } from '@/types'
```

Wrap the Card in a flex container when `isSelectionMode`:

```tsx
return (
  <div key={itemKey} className={`${marginClass} ${isWalkChild ? 'ml-3' : ''}`}>
    <div className={isSelectionMode ? 'flex items-center gap-2' : ''}>
      {isSelectionMode && !item.walkPhase && COPYABLE_CATEGORIES.includes(log.category) && (
        <Checkbox
          checked={selectedIds?.has(log.id) || false}
          onCheckedChange={() => onToggleSelect?.(log.id)}
          className="ml-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        />
      )}
      {isSelectionMode && (item.walkPhase || !COPYABLE_CATEGORIES.includes(log.category)) && (
        <div className="w-4 ml-1 shrink-0" /> {/* spacer for non-selectable items */}
      )}
      <Card
        className={`overflow-hidden ${isSelectionMode ? 'flex-1' : 'cursor-pointer hover:bg-muted/50'} transition-colors ${groupBorderClass} ${
          isSelectionMode && selectedIds?.has(log.id) ? 'ring-2 ring-primary' : ''
        }`}
        onClick={() => {
          if (isSelectionMode && !item.walkPhase && COPYABLE_CATEGORIES.includes(log.category)) {
            onToggleSelect?.(log.id)
          } else if (!isSelectionMode) {
            handleOpenDetail(log)
          }
        }}
      >
```

Note: In selection mode, clicking the entire card toggles the checkbox (for selectable items). Detail modal is disabled during selection mode.

- [ ] **Step 3: Commit**

```bash
git add components/daily-log/Timeline.tsx
git commit -m "feat: add selection mode with checkboxes to Timeline"
```

---

## Chunk 2: SelectionActionBar and ClipboardFloatingBadge Components

### Task 3: Create SelectionActionBar component

**Files:**
- Create: `components/daily-log/SelectionActionBar.tsx`

This bar appears at the bottom of the screen when selection mode is active.

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Copy, X } from 'lucide-react'

interface SelectionActionBarProps {
  selectedCount: number
  totalSelectableCount: number
  isAllSelected: boolean
  onToggleAll: () => void
  onCopy: () => void
  onCancel: () => void
}

export function SelectionActionBar({
  selectedCount,
  totalSelectableCount,
  isAllSelected,
  onToggleAll,
  onCopy,
  onCancel,
}: SelectionActionBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg z-50 px-4 py-3">
      <div className="max-w-lg mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={isAllSelected}
              onCheckedChange={onToggleAll}
              id="select-all"
            />
            <label htmlFor="select-all" className="text-sm cursor-pointer">
              전체 선택
            </label>
          </div>
          <span className="text-sm text-muted-foreground">
            {selectedCount}개 선택됨
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onCancel}
          >
            <X className="w-4 h-4 mr-1" />
            취소
          </Button>
          <Button
            size="sm"
            onClick={onCopy}
            disabled={selectedCount === 0}
          >
            <Copy className="w-4 h-4 mr-1" />
            복사
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/daily-log/SelectionActionBar.tsx
git commit -m "feat: create SelectionActionBar component"
```

---

### Task 4: Create ClipboardFloatingBadge component

**Files:**
- Create: `components/daily-log/ClipboardFloatingBadge.tsx`

Floating badge that appears when clipboard has items. Shows count + paste button + clear button.

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { ClipboardPaste, X } from 'lucide-react'

interface ClipboardFloatingBadgeProps {
  count: number
  onPaste: () => void
  onClear: () => void
}

export function ClipboardFloatingBadge({ count, onPaste, onClear }: ClipboardFloatingBadgeProps) {
  if (count === 0) return null

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-4">
      <div className="bg-primary text-primary-foreground rounded-full shadow-lg flex items-center gap-1 pl-4 pr-1 py-1">
        <span className="text-sm font-medium whitespace-nowrap">
          📋 {count}개 복사됨
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-primary-foreground hover:bg-primary-foreground/20 rounded-full"
          onClick={onPaste}
        >
          <ClipboardPaste className="w-4 h-4 mr-1" />
          붙여넣기
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20 rounded-full"
          onClick={onClear}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/daily-log/ClipboardFloatingBadge.tsx
git commit -m "feat: create ClipboardFloatingBadge component"
```

---

### Task 5: Create PasteConfirmDialog component

**Files:**
- Create: `components/daily-log/PasteConfirmDialog.tsx`

Shows a preview of items to be pasted with the target date, and confirm/cancel buttons.

- [ ] **Step 1: Create the component**

```tsx
'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { LOG_CATEGORY_CONFIG } from '@/types'
import type { ClipboardLogItem } from '@/types'

interface PasteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: ClipboardLogItem[]
  targetDate: string  // YYYY-MM-DD
  onConfirm: () => void
  isPasting: boolean
}

function formatDateKorean(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${parseInt(m)}월 ${parseInt(d)}일`
}

export function PasteConfirmDialog({
  open,
  onOpenChange,
  items,
  targetDate,
  onConfirm,
  isPasting,
}: PasteConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>기록 붙여넣기</AlertDialogTitle>
          <AlertDialogDescription>
            {formatDateKorean(targetDate)}에 {items.length}개 기록을 붙여넣을까요?
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* 항목 미리보기 */}
        <div className="max-h-48 overflow-y-auto space-y-1 my-2">
          {items.map((item, idx) => {
            const config = LOG_CATEGORY_CONFIG[item.category]
            return (
              <div key={idx} className="flex items-center gap-2 text-sm py-1 px-2 rounded bg-muted/50">
                <span>{config.icon}</span>
                <span className="font-medium">{config.label}</span>
                <span className="text-muted-foreground">{item.time}</span>
                {item.amount != null && (
                  <span className="text-muted-foreground">
                    {item.amount}{item.unit}
                  </span>
                )}
                {item.medicine_name && (
                  <span className="text-purple-600 text-xs">{item.medicine_name}</span>
                )}
                {item.snack_name && (
                  <span className="text-pink-600 text-xs">{item.snack_name}</span>
                )}
              </div>
            )
          })}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPasting}>취소</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isPasting}>
            {isPasting ? '붙여넣는 중...' : '붙여넣기'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/daily-log/PasteConfirmDialog.tsx
git commit -m "feat: create PasteConfirmDialog component"
```

---

## Chunk 3: Integration in page.tsx

### Task 6: Wire up selection mode, clipboard, and paste in page.tsx

**Files:**
- Modify: `app/daily-log/page.tsx`

This is the main integration task. All state management lives in page.tsx.

- [ ] **Step 1: Add imports**

Add to the import section at the top of `app/daily-log/page.tsx`:

```typescript
import { CheckSquare } from 'lucide-react'
import { SelectionActionBar } from '@/components/daily-log/SelectionActionBar'
import { ClipboardFloatingBadge } from '@/components/daily-log/ClipboardFloatingBadge'
import { PasteConfirmDialog } from '@/components/daily-log/PasteConfirmDialog'
import type { ClipboardLogItem } from '@/types'
import { COPYABLE_CATEGORIES } from '@/types'
```

- [ ] **Step 2: Add state variables**

After the existing state declarations (around line 77), add:

```typescript
// 복사/붙여넣기 상태
const [isSelectionMode, setIsSelectionMode] = useState(false)
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
const [clipboardLogs, setClipboardLogs] = useState<ClipboardLogItem[]>(() => {
  // sessionStorage에서 복원
  if (typeof window !== 'undefined') {
    try {
      const saved = sessionStorage.getItem('premuto_copy_clipboard')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  }
  return []
})
const [isPasteDialogOpen, setIsPasteDialogOpen] = useState(false)
const [isPasting, setIsPasting] = useState(false)
```

- [ ] **Step 3: Add clipboard sync effect**

```typescript
// clipboardLogs → sessionStorage 동기화
useEffect(() => {
  if (typeof window !== 'undefined') {
    if (clipboardLogs.length > 0) {
      sessionStorage.setItem('premuto_copy_clipboard', JSON.stringify(clipboardLogs))
    } else {
      sessionStorage.removeItem('premuto_copy_clipboard')
    }
  }
}, [clipboardLogs])
```

- [ ] **Step 4: Add selection mode reset on date change**

In the existing `selectedDate` change logic, add selection mode reset. Find where `setSelectedDate` is called and add after it, or add an effect:

```typescript
// 날짜 변경 시 선택 모드 해제
useEffect(() => {
  setIsSelectionMode(false)
  setSelectedIds(new Set())
}, [selectedDate])
```

- [ ] **Step 5: Add handler functions**

Add these after the existing handler functions (handleDelete, handleUpdate, etc.):

```typescript
// === 복사/붙여넣기 핸들러 ===

const selectableLogs = useMemo(() =>
  logs.filter(l => COPYABLE_CATEGORIES.includes(l.category)),
  [logs]
)

const handleToggleSelect = useCallback((id: string) => {
  setSelectedIds(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
}, [])

const handleToggleSelectAll = useCallback(() => {
  if (selectedIds.size === selectableLogs.length) {
    setSelectedIds(new Set())
  } else {
    setSelectedIds(new Set(selectableLogs.map(l => l.id)))
  }
}, [selectedIds.size, selectableLogs])

const handleCopy = useCallback(() => {
  const selected = logs.filter(l => selectedIds.has(l.id))
  const items: ClipboardLogItem[] = selected.map(log => {
    // logged_at에서 HH:mm 추출 (로컬 시간대 기준)
    const d = new Date(log.logged_at)
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    return {
      category: log.category,
      pet_id: log.pet_id,
      amount: log.amount,
      leftover_amount: log.leftover_amount ?? null,
      unit: log.unit,
      medicine_name: log.medicine_name,
      snack_name: log.snack_name,
      calories: log.calories ?? null,
      input_source: (log.input_source as 'preset' | 'manual') || 'manual',
      time,
    }
  })
  setClipboardLogs(items)
  setIsSelectionMode(false)
  setSelectedIds(new Set())
  toast({
    title: `${items.length}개 기록이 복사되었습니다`,
  })
}, [logs, selectedIds, toast])

const handlePaste = useCallback(async () => {
  if (clipboardLogs.length === 0) return
  setIsPasting(true)
  let successCount = 0
  let failCount = 0

  for (const item of clipboardLogs) {
    try {
      // 대상 날짜 + 원본 시간 + KST 오프셋
      const logged_at = `${selectedDate}T${item.time}:00+09:00`

      // pet_id: 원본 보존. 유효하지 않으면 현재 pet 사용.
      const pet_id = (item.pet_id && pets.some(p => p.id === item.pet_id))
        ? item.pet_id
        : currentPet?.id || null

      const body: Record<string, unknown> = {
        category: item.category,
        pet_id,
        logged_at,
        amount: item.amount,
        unit: item.unit,
        input_source: item.input_source,
      }
      if (item.leftover_amount != null) body.leftover_amount = item.leftover_amount
      if (item.medicine_name) body.medicine_name = item.medicine_name
      if (item.snack_name) body.snack_name = item.snack_name
      if (item.calories != null) body.calories = item.calories

      const res = await fetch('/api/daily-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) successCount++
      else failCount++
    } catch {
      failCount++
    }
  }

  setIsPasting(false)
  setIsPasteDialogOpen(false)

  if (failCount === 0) {
    toast({ title: `${successCount}개 기록이 추가되었습니다` })
  } else if (successCount > 0) {
    toast({ title: `${successCount}개 성공, ${failCount}개 실패`, variant: 'destructive' })
  } else {
    toast({ title: '기록 추가에 실패했습니다. 다시 시도해주세요.', variant: 'destructive' })
  }

  fetchData() // 타임라인 새로고침
}, [clipboardLogs, selectedDate, pets, currentPet, toast, fetchData])
```

- [ ] **Step 6: Add "선택" button to the timeline header**

Find the timeline header section (around line 647-655):

```tsx
<h2 className="font-medium mb-3">
  기록 목록
```

Replace with:

```tsx
<div className="flex items-center justify-between mb-3">
  <h2 className="font-medium">
    기록 목록
    {selectedCategory && (
      <span className="text-sm text-muted-foreground ml-2">
        ({LOG_CATEGORY_CONFIG[selectedCategory].icon} {LOG_CATEGORY_CONFIG[selectedCategory].label} {filteredLogs.length}건)
      </span>
    )}
  </h2>
  {!isSelectionMode && selectableLogs.length > 0 && (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setIsSelectionMode(true)}
      className="text-xs"
    >
      <CheckSquare className="w-4 h-4 mr-1" />
      선택
    </Button>
  )}
</div>
```

Remove the old `{selectedCategory && (...)}` span that was inside the `<h2>` since it's moved into the new structure.

- [ ] **Step 7: Pass selection props to Timeline**

Update the Timeline usage (around line 656):

```tsx
<Timeline
  logs={filteredLogs}
  onDelete={handleDelete}
  onUpdate={handleUpdate}
  petId={currentPet?.id}
  isSelectionMode={isSelectionMode}
  selectedIds={selectedIds}
  onToggleSelect={handleToggleSelect}
/>
```

- [ ] **Step 8: Add SelectionActionBar, ClipboardFloatingBadge, PasteConfirmDialog**

Before the closing `</>` of the page component, add:

```tsx
{/* 선택 모드 액션바 */}
{isSelectionMode && (
  <SelectionActionBar
    selectedCount={selectedIds.size}
    totalSelectableCount={selectableLogs.length}
    isAllSelected={selectedIds.size === selectableLogs.length && selectableLogs.length > 0}
    onToggleAll={handleToggleSelectAll}
    onCopy={handleCopy}
    onCancel={() => {
      setIsSelectionMode(false)
      setSelectedIds(new Set())
    }}
  />
)}

{/* 클립보드 플로팅 배지 (선택 모드가 아닐 때만 표시) */}
{!isSelectionMode && (
  <ClipboardFloatingBadge
    count={clipboardLogs.length}
    onPaste={() => setIsPasteDialogOpen(true)}
    onClear={() => setClipboardLogs([])}
  />
)}

{/* 붙여넣기 확인 다이얼로그 */}
<PasteConfirmDialog
  open={isPasteDialogOpen}
  onOpenChange={setIsPasteDialogOpen}
  items={clipboardLogs}
  targetDate={selectedDate}
  onConfirm={handlePaste}
  isPasting={isPasting}
/>
```

- [ ] **Step 9: Hide floating FABs during selection mode**

Find the floating button group (around line 662-688):

```tsx
<div className="fixed bottom-6 right-6 flex flex-col items-end gap-3">
```

Wrap with selection mode check:

```tsx
{!isSelectionMode && (
  <div className="fixed bottom-6 right-6 flex flex-col items-end gap-3">
    {/* ... existing walk FAB + add FAB ... */}
  </div>
)}
```

- [ ] **Step 10: Commit**

```bash
git add app/daily-log/page.tsx
git commit -m "feat: integrate copy/paste selection mode, clipboard, and paste logic"
```

---

## Chunk 4: Final Polish and Testing

### Task 7: Manual testing checklist

- [ ] **Step 1: Run dev server and verify**

```bash
cd C:/Users/cid41/Dev/premuto-1-feat-copy-paste-logs && npm run dev
```

Test these scenarios manually:

1. Open daily log page with existing records
2. Click "선택" button → checkboxes appear on selectable items (meal, water, etc.)
3. Verify walk/weight/vomit/note items do NOT have checkboxes
4. Select 2-3 items → "N개 선택됨" bar appears at bottom
5. Click "전체 선택" → all selectable items checked
6. Click "복사" → toast "N개 기록이 복사되었습니다" + floating badge appears
7. Navigate to different date → badge persists
8. Click "붙여넣기" → confirm dialog with item preview
9. Confirm → items created with original times + toast
10. Refresh page → clipboard badge still shown (sessionStorage)
11. Click X on badge → clipboard cleared
12. Close and reopen tab → clipboard cleared (sessionStorage)

- [ ] **Step 2: Build check**

```bash
npm run build
```

Fix any TypeScript errors.

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address build errors and polish copy/paste feature"
```
