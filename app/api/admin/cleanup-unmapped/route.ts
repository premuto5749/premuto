import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

interface CleanupAction {
  action: 'delete' | 'merge'
  itemId: string
  targetItemId?: string // merge 시 대상 항목 ID
}

interface CleanupResult {
  success: boolean
  deleted: number
  merged: number
  testResultsMigrated: number
  errors: string[]
}

/**
 * POST /api/admin/cleanup-unmapped
 * 미분류 항목 일괄 정리
 *
 * Body:
 * - actions: CleanupAction[]
 * - dryRun: boolean (true면 실제 삭제/병합하지 않고 미리보기만)
 */
export async function POST(request: NextRequest) {
  // 관리자 권한 체크
  const auth = await requireAdmin()
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error || 'Admin access required' },
      { status: auth.userId ? 403 : 401 }
    )
  }

  try {
    const body = await request.json()
    const { actions, dryRun = false } = body as {
      actions: CleanupAction[]
      dryRun?: boolean
    }

    if (!actions || !Array.isArray(actions)) {
      return NextResponse.json(
        { error: 'actions array is required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()
    const result: CleanupResult = {
      success: true,
      deleted: 0,
      merged: 0,
      testResultsMigrated: 0,
      errors: []
    }

    for (const action of actions) {
      try {
        if (action.action === 'delete') {
          // 삭제 전 test_results 확인
          const { count: testResultsCount } = await supabase
            .from('test_results')
            .select('*', { count: 'exact', head: true })
            .eq('standard_item_id', action.itemId)

          if (testResultsCount && testResultsCount > 0) {
            result.errors.push(
              `Cannot delete ${action.itemId}: has ${testResultsCount} test results. Merge instead.`
            )
            continue
          }

          if (!dryRun) {
            // item_mappings 삭제
            await supabase
              .from('item_mappings_master')
              .delete()
              .eq('standard_item_id', action.itemId)

            // item_aliases 삭제
            await supabase
              .from('item_aliases_master')
              .delete()
              .eq('standard_item_id', action.itemId)

            // standard_items 삭제
            const { error } = await supabase
              .from('standard_items_master')
              .delete()
              .eq('id', action.itemId)

            if (error) {
              result.errors.push(`Delete failed for ${action.itemId}: ${error.message}`)
              continue
            }
          }

          result.deleted++

        } else if (action.action === 'merge') {
          if (!action.targetItemId) {
            result.errors.push(`Merge action requires targetItemId for ${action.itemId}`)
            continue
          }

          if (!dryRun) {
            // 1. test_results 이전
            const { data: movedResults, error: migrateError } = await supabase
              .from('test_results')
              .update({ standard_item_id: action.targetItemId })
              .eq('standard_item_id', action.itemId)
              .select('id')

            if (migrateError) {
              result.errors.push(`Migration failed for ${action.itemId}: ${migrateError.message}`)
              continue
            }

            result.testResultsMigrated += movedResults?.length || 0

            // 2. item_mappings 이전
            await supabase
              .from('item_mappings_master')
              .update({ standard_item_id: action.targetItemId })
              .eq('standard_item_id', action.itemId)

            // 3. item_aliases 이전
            await supabase
              .from('item_aliases_master')
              .update({ standard_item_id: action.targetItemId })
              .eq('standard_item_id', action.itemId)

            // 4. 원래 이름을 별칭으로 추가 (선택적)
            const { data: sourceItem } = await supabase
              .from('standard_items_master')
              .select('name')
              .eq('id', action.itemId)
              .single()

            const { data: targetItem } = await supabase
              .from('standard_items_master')
              .select('name')
              .eq('id', action.targetItemId)
              .single()

            if (sourceItem && targetItem) {
              // 기존 별칭 확인
              const { data: existingAlias } = await supabase
                .from('item_aliases_master')
                .select('id')
                .eq('alias', sourceItem.name)
                .single()

              if (!existingAlias) {
                await supabase
                  .from('item_aliases_master')
                  .insert({
                    alias: sourceItem.name,
                    canonical_name: targetItem.name,
                    standard_item_id: action.targetItemId,
                    source_hint: 'merged'
                  })
              }
            }

            // 5. 원본 항목 삭제
            const { error: deleteError } = await supabase
              .from('standard_items_master')
              .delete()
              .eq('id', action.itemId)

            if (deleteError) {
              result.errors.push(`Delete after merge failed for ${action.itemId}: ${deleteError.message}`)
            }
          }

          result.merged++
        }
      } catch (err) {
        result.errors.push(`Error processing ${action.itemId}: ${err}`)
      }
    }

    if (result.errors.length > 0) {
      result.success = false
    }

    return NextResponse.json({
      ...result,
      dryRun,
      message: dryRun
        ? `Dry run complete: ${result.deleted} would be deleted, ${result.merged} would be merged`
        : `Cleanup complete: ${result.deleted} deleted, ${result.merged} merged, ${result.testResultsMigrated} test results migrated`
    })

  } catch (error) {
    console.error('Cleanup unmapped error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
