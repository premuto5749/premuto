/**
 * Excel 내보내기 API 엔드포인트
 *
 * POST /api/export-excel
 * 검사 결과를 Excel 파일로 다운로드
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveStandardItems } from '@/lib/api/item-resolver'
import {
  createExcelWorkbook,
  workbookToBuffer,
  generateFilename,
  ExportTestResult,
  ExportOptions
} from '@/lib/export/excel-exporter'
import { checkMonthlyUsageLimit, logUsage } from '@/lib/tier'

export const dynamic = 'force-dynamic'

interface ExportRequest {
  record_ids?: string[]      // 특정 검사 기록만 내보내기 (선택)
  date_from?: string         // 시작 날짜 (선택)
  date_to?: string           // 종료 날짜 (선택)
  categories?: string[]      // 특정 카테고리만 (선택)
  options?: Partial<ExportOptions>
}

export async function POST(request: NextRequest) {
  try {
    const body: ExportRequest = await request.json()
    const { record_ids, date_from, date_to, categories, options } = body

    const supabase = await createClient()

    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다' }, { status: 401 })
    }

    // 월간 내보내기 제한 체크
    const usageCheck = await checkMonthlyUsageLimit(user.id, 'detailed_export')
    if (!usageCheck.allowed) {
      return NextResponse.json({
        success: false,
        error: 'TIER_LIMIT_EXCEEDED',
        message: '이번 달 내보내기 횟수를 모두 사용했습니다.',
        tier: usageCheck.tier,
        used: usageCheck.used,
        limit: usageCheck.limit,
      }, { status: 403 })
    }

    // 쿼리 빌더 시작 (FK 해제로 !inner 대신 별도 resolve)
    let query = supabase
      .from('test_results')
      .select(`
        id,
        standard_item_id,
        value,
        unit,
        ref_min,
        ref_max,
        ref_text,
        test_records!inner (
          id,
          test_date,
          hospital_name
        )
      `)
      .not('standard_item_id', 'is', null)
      .order('test_date', { referencedTable: 'test_records', ascending: true })

    // 필터 적용
    if (record_ids && record_ids.length > 0) {
      query = query.in('record_id', record_ids)
    }

    if (date_from) {
      query = query.gte('test_records.test_date', date_from)
    }

    if (date_to) {
      query = query.lte('test_records.test_date', date_to)
    }

    const { data, error } = await query

    if (error) {
      console.error('Database query error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch test results' },
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No data to export' },
        { status: 404 }
      )
    }

    // 항목 정보 resolve (마스터 + 유저 커스텀 양쪽)
    const itemIds = data
      .map(r => r.standard_item_id)
      .filter((id): id is string => id !== null)
    const resolvedMap = await resolveStandardItems(itemIds, user.id, supabase)

    // 데이터 변환 (항목 정보가 없는 결과 제외, 카테고리 필터 적용)
    const results: ExportTestResult[] = []
    for (const row of data) {
      const resolved = row.standard_item_id ? resolvedMap.get(row.standard_item_id) : null
      if (!resolved) continue // 항목 정보 없으면 제외 (기존 !inner 동작 유지)

      // 카테고리 필터 적용 (코드 레벨)
      if (categories && categories.length > 0) {
        if (!resolved.category || !categories.includes(resolved.category)) continue
      }

      // Type assertions for nested objects
      const testRecord = row.test_records as unknown as {
        id: string
        test_date: string
        hospital_name: string | null
      }

      // 상태 계산
      let status: 'high' | 'low' | 'normal' | null = null
      const numericValue = typeof row.value === 'number'
        ? row.value
        : parseFloat(String(row.value).replace(/[<>*,]/g, ''))

      if (!isNaN(numericValue)) {
        if (row.ref_max !== null && numericValue > row.ref_max) {
          status = 'high'
        } else if (row.ref_min !== null && numericValue < row.ref_min) {
          status = 'low'
        } else if (row.ref_min !== null || row.ref_max !== null) {
          status = 'normal'
        }
      }

      results.push({
        test_date: testRecord.test_date,
        hospital_name: testRecord.hospital_name || undefined,
        item_name: resolved.name,
        display_name_ko: resolved.display_name_ko || undefined,
        value: row.value,
        unit: row.unit,
        ref_min: row.ref_min,
        ref_max: row.ref_max,
        ref_text: row.ref_text,
        status,
        category: resolved.category || undefined
      })
    }

    if (results.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No data to export' },
        { status: 404 }
      )
    }

    // Excel 워크북 생성
    const workbook = createExcelWorkbook(results, options)
    const buffer = workbookToBuffer(workbook)
    const filename = generateFilename(results)

    // 사용량 기록
    await logUsage(user.id, 'detailed_export', 1, {
      type: 'test-results-excel',
      record_count: results.length,
    })

    // 응답 헤더 설정
    const headers = new Headers()
    headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    headers.set('Content-Disposition', `attachment; filename="${filename}.xlsx"`)
    headers.set('Content-Length', buffer.length.toString())

    // Buffer를 Uint8Array로 변환
    const uint8Array = new Uint8Array(buffer)

    return new NextResponse(uint8Array, {
      status: 200,
      headers
    })

  } catch (error) {
    console.error('Excel export error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate Excel file' },
      { status: 500 }
    )
  }
}

// GET 엔드포인트 - 내보내기 사용량 체크
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const usageCheck = await checkMonthlyUsageLimit(user.id, 'detailed_export')

    return NextResponse.json({
      tier: usageCheck.tier,
      used: usageCheck.used,
      limit: usageCheck.limit,
      remaining: usageCheck.remaining,
    })
  } catch (error) {
    console.error('Export usage check error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
