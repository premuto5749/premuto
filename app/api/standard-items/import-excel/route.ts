import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

interface ExcelRow {
  '항목명 (name)': string
  '한글명 (display_name_ko)'?: string
  '검사유형 (exam_type)'?: string
  '카테고리 (category)'?: string
  '기본단위 (default_unit)'?: string
  '장기태그 (organ_tags)'?: string
  '정렬순서 (sort_order)'?: number | string
  '일반설명 (description_common)'?: string
  '높을때 (description_high)'?: string
  '낮을때 (description_low)'?: string
  '별칭 (aliases)'?: string
  '별칭힌트 (source_hints)'?: string
}

interface ImportResult {
  success: boolean
  items: {
    total: number
    inserted: number
    updated: number
    failed: number
  }
  aliases: {
    total: number
    inserted: number
    skipped: number
    failed: number
  }
  errors: string[]
}

/**
 * POST /api/standard-items/import-excel
 * Excel 파일에서 표준 항목과 별칭 가져오기
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // FormData에서 파일 가져오기
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // 파일 확장자 확인
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'Invalid file type. Only .xlsx and .xls files are allowed.' },
        { status: 400 }
      )
    }

    // 파일 읽기
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })

    // 첫 번째 시트 (표준항목) 가져오기
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return NextResponse.json(
        { error: 'Excel file has no sheets' },
        { status: 400 }
      )
    }

    const worksheet = workbook.Sheets[sheetName]
    const rows: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet)

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Excel file has no data' },
        { status: 400 }
      )
    }

    // 결과 초기화
    const result: ImportResult = {
      success: true,
      items: { total: rows.length, inserted: 0, updated: 0, failed: 0 },
      aliases: { total: 0, inserted: 0, skipped: 0, failed: 0 },
      errors: []
    }

    // 기존 표준 항목 조회 (이름 기준 매핑)
    const { data: existingItems } = await supabase
      .from('standard_items_master')
      .select('id, name')

    const existingItemMap = new Map<string, string>()
    existingItems?.forEach(item => {
      existingItemMap.set(item.name.toLowerCase(), item.id)
    })

    // 기존 별칭 조회
    const { data: existingAliases } = await supabase
      .from('item_aliases_master')
      .select('alias, canonical_name')

    const existingAliasSet = new Set<string>()
    existingAliases?.forEach(alias => {
      existingAliasSet.add(`${alias.alias.toLowerCase()}:${alias.canonical_name.toLowerCase()}`)
    })

    // 각 행 처리
    for (const row of rows) {
      const name = row['항목명 (name)']?.toString().trim()

      if (!name) {
        result.items.failed++
        result.errors.push(`빈 항목명 발견 (행 건너뜀)`)
        continue
      }

      // 표준 항목 데이터 준비
      const itemData: Record<string, unknown> = {
        name,
      }

      // 값이 있는 경우에만 업데이트
      const displayNameKo = row['한글명 (display_name_ko)']?.toString().trim()
      if (displayNameKo !== undefined && displayNameKo !== '') {
        itemData.display_name_ko = displayNameKo
      }

      const examType = row['검사유형 (exam_type)']?.toString().trim()
      if (examType !== undefined && examType !== '') {
        itemData.exam_type = examType
        itemData.category = examType // 카테고리도 동기화
      }

      const category = row['카테고리 (category)']?.toString().trim()
      if (category !== undefined && category !== '' && !examType) {
        itemData.category = category
      }

      const defaultUnit = row['기본단위 (default_unit)']?.toString().trim()
      if (defaultUnit !== undefined && defaultUnit !== '') {
        itemData.default_unit = defaultUnit
      }

      const organTagsStr = row['장기태그 (organ_tags)']?.toString().trim()
      if (organTagsStr !== undefined && organTagsStr !== '') {
        itemData.organ_tags = organTagsStr.split(',').map(t => t.trim()).filter(Boolean)
      }

      const sortOrder = row['정렬순서 (sort_order)']
      if (sortOrder !== undefined && sortOrder !== null) {
        itemData.sort_order = typeof sortOrder === 'number' ? sortOrder : parseInt(sortOrder.toString()) || 0
      }

      const descCommon = row['일반설명 (description_common)']?.toString().trim()
      if (descCommon !== undefined) {
        itemData.description_common = descCommon || null
      }

      const descHigh = row['높을때 (description_high)']?.toString().trim()
      if (descHigh !== undefined) {
        itemData.description_high = descHigh || null
      }

      const descLow = row['낮을때 (description_low)']?.toString().trim()
      if (descLow !== undefined) {
        itemData.description_low = descLow || null
      }

      // 기존 항목 확인
      const existingId = existingItemMap.get(name.toLowerCase())

      if (existingId) {
        // 업데이트
        const { error } = await supabase
          .from('standard_items_master')
          .update(itemData)
          .eq('id', existingId)

        if (error) {
          result.items.failed++
          result.errors.push(`${name}: 업데이트 실패 - ${error.message}`)
        } else {
          result.items.updated++
        }
      } else {
        // 새로 생성
        const { data: newItem, error } = await supabase
          .from('standard_items_master')
          .insert(itemData)
          .select('id')
          .single()

        if (error) {
          result.items.failed++
          result.errors.push(`${name}: 생성 실패 - ${error.message}`)
        } else {
          result.items.inserted++
          if (newItem) {
            existingItemMap.set(name.toLowerCase(), newItem.id)
          }
        }
      }

      // 별칭 처리
      const aliasesStr = row['별칭 (aliases)']?.toString().trim()
      const sourceHintsStr = row['별칭힌트 (source_hints)']?.toString().trim()

      if (aliasesStr) {
        const aliases = aliasesStr.split(',').map(a => a.trim()).filter(Boolean)

        // 별칭힌트 파싱 (alias:sourceHint 형식)
        const sourceHints: Record<string, string> = {}
        if (sourceHintsStr) {
          sourceHintsStr.split(',').forEach(hint => {
            const [alias, source] = hint.split(':').map(s => s.trim())
            if (alias && source) {
              sourceHints[alias.toLowerCase()] = source
            }
          })
        }

        result.aliases.total += aliases.length

        for (const alias of aliases) {
          const aliasKey = `${alias.toLowerCase()}:${name.toLowerCase()}`

          if (existingAliasSet.has(aliasKey)) {
            result.aliases.skipped++
            continue
          }

          const aliasData: Record<string, string> = {
            alias,
            canonical_name: name,
          }

          const sourceHint = sourceHints[alias.toLowerCase()]
          if (sourceHint) {
            aliasData.source_hint = sourceHint
          }

          const { error } = await supabase
            .from('item_aliases_master')
            .insert(aliasData)

          if (error) {
            result.aliases.failed++
            result.errors.push(`별칭 ${alias} → ${name}: 생성 실패 - ${error.message}`)
          } else {
            result.aliases.inserted++
            existingAliasSet.add(aliasKey)
          }
        }
      }
    }

    // 에러가 너무 많으면 일부만 반환
    if (result.errors.length > 20) {
      result.errors = [
        ...result.errors.slice(0, 20),
        `... 외 ${result.errors.length - 20}개 에러`
      ]
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Import Excel error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
