import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

/**
 * GET /api/standard-items/export-excel
 * 표준 항목과 별칭을 Excel 파일로 내보내기
 */
export async function GET() {
  try {
    const supabase = await createClient()

    // 표준 항목 조회
    const { data: standardItems, error: itemsError } = await supabase
      .from('standard_items_master')
      .select('*')
      .order('exam_type', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (itemsError) {
      console.error('Failed to fetch standard items:', itemsError)
      return NextResponse.json(
        { error: 'Failed to fetch standard items' },
        { status: 500 }
      )
    }

    // 별칭 조회
    const { data: aliases, error: aliasesError } = await supabase
      .from('item_aliases_master')
      .select('*')
      .order('canonical_name', { ascending: true })

    if (aliasesError) {
      console.error('Failed to fetch aliases:', aliasesError)
      return NextResponse.json(
        { error: 'Failed to fetch aliases' },
        { status: 500 }
      )
    }

    // 별칭을 표준항목 이름별로 그룹화
    const aliasesByName: Record<string, string[]> = {}
    const sourceHintsByName: Record<string, string[]> = {}

    aliases?.forEach(alias => {
      if (!aliasesByName[alias.canonical_name]) {
        aliasesByName[alias.canonical_name] = []
        sourceHintsByName[alias.canonical_name] = []
      }
      aliasesByName[alias.canonical_name].push(alias.alias)
      if (alias.source_hint) {
        sourceHintsByName[alias.canonical_name].push(`${alias.alias}:${alias.source_hint}`)
      }
    })

    // Excel 데이터 생성
    const excelData = standardItems?.map(item => ({
      '항목명 (name)': item.name,
      '한글명 (display_name_ko)': item.display_name_ko || '',
      '검사유형 (exam_type)': item.exam_type || '',
      '카테고리 (category)': item.category || '',
      '기본단위 (default_unit)': item.default_unit || '',
      '장기태그 (organ_tags)': item.organ_tags ? item.organ_tags.join(', ') : '',
      '정렬순서 (sort_order)': item.sort_order || 0,
      '일반설명 (description_common)': item.description_common || '',
      '높을때 (description_high)': item.description_high || '',
      '낮을때 (description_low)': item.description_low || '',
      '별칭 (aliases)': aliasesByName[item.name]?.join(', ') || '',
      '별칭힌트 (source_hints)': sourceHintsByName[item.name]?.join(', ') || '',
    })) || []

    // 워크북 생성
    const wb = XLSX.utils.book_new()

    // 표준항목 시트
    const ws = XLSX.utils.json_to_sheet(excelData)

    // 컬럼 너비 설정
    ws['!cols'] = [
      { wch: 25 },  // 항목명
      { wch: 20 },  // 한글명
      { wch: 15 },  // 검사유형
      { wch: 15 },  // 카테고리
      { wch: 12 },  // 기본단위
      { wch: 25 },  // 장기태그
      { wch: 10 },  // 정렬순서
      { wch: 50 },  // 일반설명
      { wch: 50 },  // 높을때
      { wch: 50 },  // 낮을때
      { wch: 40 },  // 별칭
      { wch: 40 },  // 별칭힌트
    ]

    XLSX.utils.book_append_sheet(wb, ws, '표준항목')

    // 안내 시트 추가
    const guideData = [
      ['=== 표준항목 Excel 가이드 ==='],
      [''],
      ['1. 항목명 (name): 영문 표준 항목명 (필수, 고유해야 함)'],
      ['2. 한글명 (display_name_ko): 화면에 표시되는 한글 이름'],
      ['3. 검사유형 (exam_type): CBC, Chemistry, Urinalysis 등'],
      ['4. 카테고리 (category): 검사유형과 동일하게 유지'],
      ['5. 기본단위 (default_unit): mg/dL, g/dL, % 등'],
      ['6. 장기태그 (organ_tags): 쉼표로 구분 (예: Kidney, Liver)'],
      ['7. 정렬순서 (sort_order): 표시 순서 (숫자)'],
      ['8. 일반설명 (description_common): 항목에 대한 일반적인 설명'],
      ['9. 높을때 (description_high): 수치가 높을 때의 의미'],
      ['10. 낮을때 (description_low): 수치가 낮을 때의 의미'],
      ['11. 별칭 (aliases): 쉼표로 구분된 별칭 목록'],
      ['12. 별칭힌트 (source_hints): "별칭:장비명" 형식으로 쉼표 구분'],
      [''],
      ['=== 가져오기 시 주의사항 ==='],
      ['- 항목명이 이미 존재하면 해당 항목을 업데이트합니다'],
      ['- 항목명이 없으면 새로 생성합니다'],
      ['- 빈 셀은 기존 값을 유지합니다 (삭제하려면 공백 입력)'],
      ['- 별칭은 기존 별칭에 추가됩니다 (중복 제외)'],
    ]
    const guideWs = XLSX.utils.aoa_to_sheet(guideData)
    guideWs['!cols'] = [{ wch: 60 }]
    XLSX.utils.book_append_sheet(wb, guideWs, '가이드')

    // Excel 파일 생성
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    // 응답 반환
    const filename = `standard-items-${new Date().toISOString().split('T')[0]}.xlsx`

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })

  } catch (error) {
    console.error('Export Excel error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
