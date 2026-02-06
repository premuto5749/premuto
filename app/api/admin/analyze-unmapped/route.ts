import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/admin'
import masterData from '@/config/master_data_v3.json'

export const dynamic = 'force-dynamic'

interface UnmappedItem {
  id: string
  name: string
  display_name_ko: string | null
  category: string | null
  exam_type: string | null
  default_unit: string | null
  organ_tags: string[] | null
  created_at: string
  test_results_count: number
  suggested_action: 'delete' | 'merge' | 'keep' | 'review'
  merge_candidate: {
    id: string
    name: string
    similarity: number
  } | null
  reason: string
}

// 레벤슈타인 거리 계산
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length
  const n = str2.length
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + 1
        )
      }
    }
  }

  return dp[m][n]
}

// 유사도 계산 (0-100%)
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()

  if (s1 === s2) return 100

  const distance = levenshteinDistance(s1, s2)
  const maxLen = Math.max(s1.length, s2.length)

  return Math.round((1 - distance / maxLen) * 100)
}

// 정리된 이름으로 비교 (특수문자, 공백 제거)
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, '')
    .trim()
}

export async function GET() {
  // 관리자 권한 체크
  const auth = await requireAdmin()
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error || 'Admin access required' },
      { status: auth.userId ? 403 : 401 }
    )
  }

  try {
    const supabase = await createClient()

    // 1. DB에서 모든 standard_items 가져오기
    const { data: dbItems, error: itemsError } = await supabase
      .from('standard_items_master')
      .select('*')
      .order('name')

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    // 2. test_results에서 각 항목별 사용 횟수 집계
    const { data: testResults } = await supabase
      .from('test_results')
      .select('standard_item_id')

    const resultCounts: Record<string, number> = {}
    testResults?.forEach(r => {
      if (r.standard_item_id) {
        resultCounts[r.standard_item_id] = (resultCounts[r.standard_item_id] || 0) + 1
      }
    })

    // 3. 마스터 데이터 이름 목록 (소문자)
    const masterNames = new Set(masterData.test_items.map(i => i.name.toLowerCase()))

    // 4. extraInDb 항목 분석
    const unmappedItems: UnmappedItem[] = []

    for (const item of dbItems || []) {
      const nameLower = item.name.toLowerCase()
      const nameNormalized = normalizeName(item.name)

      // 마스터 데이터에 있는 항목은 건너뜀
      if (masterNames.has(nameLower)) {
        continue
      }

      const testResultsCount = resultCounts[item.id] || 0

      // 가장 유사한 마스터 항목 찾기
      let bestMatch: { name: string; similarity: number } | null = null

      for (const masterItem of masterData.test_items) {
        const similarity = calculateSimilarity(item.name, masterItem.name)
        if (similarity > 60 && (!bestMatch || similarity > bestMatch.similarity)) {
          bestMatch = { name: masterItem.name, similarity }
        }
      }

      // 별칭에서도 찾기
      for (const alias of masterData.aliases) {
        const similarity = calculateSimilarity(item.name, alias.alias)
        if (similarity > 70 && (!bestMatch || similarity > bestMatch.similarity)) {
          bestMatch = { name: `${alias.canonical} (via alias: ${alias.alias})`, similarity }
        }
      }

      // 정규화된 이름이 마스터에 있는지 확인 (정확히 일치하지만 대소문자/공백 차이)
      const normalizedMatch = masterData.test_items.find(
        m => normalizeName(m.name) === nameNormalized
      )
      if (normalizedMatch && !bestMatch) {
        bestMatch = { name: normalizedMatch.name, similarity: 95 }
      }

      // 액션 결정
      let suggestedAction: UnmappedItem['suggested_action'] = 'review'
      let reason = ''

      if (item.category === 'Unmapped') {
        if (testResultsCount === 0) {
          suggestedAction = 'delete'
          reason = 'Unmapped 항목이며 사용된 검사 결과 없음'
        } else if (bestMatch && bestMatch.similarity >= 80) {
          suggestedAction = 'merge'
          reason = `${bestMatch.similarity}% 유사한 마스터 항목 발견, 검사결과 ${testResultsCount}건 이전 필요`
        } else {
          suggestedAction = 'review'
          reason = `검사결과 ${testResultsCount}건 있음, 수동 검토 필요`
        }
      } else {
        // Unmapped가 아닌데 마스터에 없는 항목
        if (testResultsCount === 0) {
          suggestedAction = 'delete'
          reason = '마스터에 없는 항목이며 사용된 검사 결과 없음'
        } else if (bestMatch && bestMatch.similarity >= 85) {
          suggestedAction = 'merge'
          reason = `마스터에 유사 항목(${bestMatch.similarity}%) 발견, 병합 권장`
        } else {
          suggestedAction = 'keep'
          reason = `검사결과 ${testResultsCount}건 있음, 마스터 추가 고려`
        }
      }

      // 마스터 항목의 ID 찾기 (merge candidate)
      let mergeCandidate: UnmappedItem['merge_candidate'] = null
      if (bestMatch) {
        const targetName = bestMatch.name.includes('(via alias:')
          ? masterData.aliases.find(a => bestMatch!.name.includes(a.alias))?.canonical
          : bestMatch.name

        const targetItem = (dbItems || []).find(
          i => i.name.toLowerCase() === targetName?.toLowerCase()
        )
        if (targetItem) {
          mergeCandidate = {
            id: targetItem.id,
            name: targetItem.name,
            similarity: bestMatch.similarity
          }
        }
      }

      unmappedItems.push({
        id: item.id,
        name: item.name,
        display_name_ko: item.display_name_ko,
        category: item.category,
        exam_type: item.exam_type,
        default_unit: item.default_unit,
        organ_tags: item.organ_tags,
        created_at: item.created_at,
        test_results_count: testResultsCount,
        suggested_action: suggestedAction,
        merge_candidate: mergeCandidate,
        reason
      })
    }

    // 5. 통계 요약
    const summary = {
      total: unmappedItems.length,
      byAction: {
        delete: unmappedItems.filter(i => i.suggested_action === 'delete').length,
        merge: unmappedItems.filter(i => i.suggested_action === 'merge').length,
        keep: unmappedItems.filter(i => i.suggested_action === 'keep').length,
        review: unmappedItems.filter(i => i.suggested_action === 'review').length,
      },
      byCategory: {} as Record<string, number>,
      totalTestResults: unmappedItems.reduce((sum, i) => sum + i.test_results_count, 0)
    }

    unmappedItems.forEach(item => {
      const cat = item.category || 'null'
      summary.byCategory[cat] = (summary.byCategory[cat] || 0) + 1
    })

    // 액션별로 정렬 (delete > merge > review > keep)
    const actionOrder = { delete: 0, merge: 1, review: 2, keep: 3 }
    unmappedItems.sort((a, b) => {
      const orderDiff = actionOrder[a.suggested_action] - actionOrder[b.suggested_action]
      if (orderDiff !== 0) return orderDiff
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json({
      success: true,
      summary,
      items: unmappedItems
    })

  } catch (error) {
    console.error('Analyze unmapped error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
