/**
 * Excel 내보내기 유틸리티
 *
 * 검사 결과를 Excel 파일로 내보내는 기능
 * 피벗 테이블 형식으로 날짜×항목 매트릭스 생성
 */

import * as XLSX from 'xlsx'

export interface ExportTestResult {
  test_date: string
  hospital_name?: string
  item_name: string
  display_name_ko?: string
  value: number | string
  unit: string
  ref_min: number | null
  ref_max: number | null
  ref_text: string | null
  status?: 'high' | 'low' | 'normal' | null
  category?: string
}

export interface ExportOptions {
  format: 'pivot' | 'flat'  // 피벗 테이블 vs 플랫 테이블
  includeReference: boolean  // 참조범위 포함 여부
  includeStatus: boolean     // 상태(H/L/N) 포함 여부
  filename?: string          // 파일명 (확장자 제외)
}

const DEFAULT_OPTIONS: ExportOptions = {
  format: 'pivot',
  includeReference: true,
  includeStatus: true,
  filename: 'mimo-blood-test-results'
}

/**
 * 검사 결과를 Excel 워크북으로 변환
 */
export function createExcelWorkbook(
  results: ExportTestResult[],
  options: Partial<ExportOptions> = {}
): XLSX.WorkBook {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const workbook = XLSX.utils.book_new()

  if (opts.format === 'pivot') {
    // 피벗 테이블 시트 생성
    const pivotSheet = createPivotSheet(results, opts)
    XLSX.utils.book_append_sheet(workbook, pivotSheet, '트렌드')
  }

  // 원본 데이터 시트 추가 (항상)
  const flatSheet = createFlatSheet(results, opts)
  XLSX.utils.book_append_sheet(workbook, flatSheet, '전체 데이터')

  // 카테고리별 시트 추가
  const categories = [...new Set(results.map(r => r.category).filter(Boolean))]
  for (const category of categories) {
    const categoryResults = results.filter(r => r.category === category)
    const categorySheet = createFlatSheet(categoryResults, opts)
    XLSX.utils.book_append_sheet(workbook, categorySheet, category as string)
  }

  return workbook
}

/**
 * 피벗 테이블 시트 생성 (날짜 × 항목)
 */
function createPivotSheet(
  results: ExportTestResult[],
  options: ExportOptions
): XLSX.WorkSheet {
  // 고유한 날짜와 항목 추출
  const dates = [...new Set(results.map(r => r.test_date))].sort()
  const items = [...new Set(results.map(r => r.item_name))]

  // 결과를 맵으로 변환 (빠른 조회용)
  const resultMap = new Map<string, ExportTestResult>()
  for (const result of results) {
    const key = `${result.test_date}|${result.item_name}`
    resultMap.set(key, result)
  }

  // 헤더 행 생성
  const headers = ['항목', '한글명', '단위']
  if (options.includeReference) {
    headers.push('참조범위')
  }
  headers.push(...dates)

  // 데이터 행 생성
  const rows: (string | number | null)[][] = [headers]

  for (const itemName of items) {
    // 해당 항목의 첫 번째 결과에서 메타데이터 가져오기
    const firstResult = results.find(r => r.item_name === itemName)
    if (!firstResult) continue

    const row: (string | number | null)[] = [
      itemName,
      firstResult.display_name_ko || '',
      firstResult.unit
    ]

    if (options.includeReference) {
      row.push(formatReference(firstResult))
    }

    // 각 날짜별 값 추가
    for (const date of dates) {
      const key = `${date}|${itemName}`
      const result = resultMap.get(key)

      if (result) {
        let cellValue: string | number = result.value as string | number

        // 상태 표시 추가
        if (options.includeStatus && result.status) {
          if (result.status === 'high') {
            cellValue = `${result.value} ↑`
          } else if (result.status === 'low') {
            cellValue = `${result.value} ↓`
          }
        }

        row.push(cellValue)
      } else {
        row.push(null)  // 해당 날짜에 결과 없음
      }
    }

    rows.push(row)
  }

  const sheet = XLSX.utils.aoa_to_sheet(rows)

  // 열 너비 설정
  const colWidths = [
    { wch: 15 },  // 항목명
    { wch: 15 },  // 한글명
    { wch: 10 },  // 단위
  ]
  if (options.includeReference) {
    colWidths.push({ wch: 15 })  // 참조범위
  }
  for (let i = 0; i < dates.length; i++) {
    colWidths.push({ wch: 12 })  // 날짜별 값
  }
  sheet['!cols'] = colWidths

  return sheet
}

/**
 * 플랫 테이블 시트 생성 (원본 데이터)
 */
function createFlatSheet(
  results: ExportTestResult[],
  options: ExportOptions
): XLSX.WorkSheet {
  const headers = [
    '검사일',
    '병원',
    '항목',
    '한글명',
    '결과값',
    '단위',
  ]

  if (options.includeReference) {
    headers.push('참조 최소', '참조 최대', '참조 텍스트')
  }

  if (options.includeStatus) {
    headers.push('상태')
  }

  headers.push('카테고리')

  const rows: (string | number | null)[][] = [headers]

  for (const result of results) {
    const row: (string | number | null)[] = [
      result.test_date,
      result.hospital_name || '',
      result.item_name,
      result.display_name_ko || '',
      result.value as string | number,
      result.unit,
    ]

    if (options.includeReference) {
      row.push(
        result.ref_min,
        result.ref_max,
        result.ref_text
      )
    }

    if (options.includeStatus) {
      row.push(formatStatus(result.status))
    }

    row.push(result.category || '')

    rows.push(row)
  }

  const sheet = XLSX.utils.aoa_to_sheet(rows)

  // 열 너비 설정
  sheet['!cols'] = [
    { wch: 12 },  // 검사일
    { wch: 15 },  // 병원
    { wch: 15 },  // 항목
    { wch: 15 },  // 한글명
    { wch: 10 },  // 결과값
    { wch: 10 },  // 단위
    { wch: 10 },  // 참조 최소
    { wch: 10 },  // 참조 최대
    { wch: 15 },  // 참조 텍스트
    { wch: 8 },   // 상태
    { wch: 12 },  // 카테고리
  ]

  return sheet
}

/**
 * 참조범위 포맷팅
 */
function formatReference(result: ExportTestResult): string {
  if (result.ref_text) {
    return result.ref_text
  }

  if (result.ref_min !== null && result.ref_max !== null) {
    return `${result.ref_min}-${result.ref_max}`
  }

  if (result.ref_min !== null) {
    return `≥${result.ref_min}`
  }

  if (result.ref_max !== null) {
    return `≤${result.ref_max}`
  }

  return ''
}

/**
 * 상태 포맷팅
 */
function formatStatus(status?: 'high' | 'low' | 'normal' | null): string {
  switch (status) {
    case 'high': return 'High ↑'
    case 'low': return 'Low ↓'
    case 'normal': return 'Normal'
    default: return ''
  }
}

/**
 * 워크북을 버퍼로 변환 (API 응답용)
 */
export function workbookToBuffer(workbook: XLSX.WorkBook): Buffer {
  const excelBuffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'buffer'
  })
  return Buffer.from(excelBuffer)
}

/**
 * 워크북을 Base64로 변환 (클라이언트 다운로드용)
 */
export function workbookToBase64(workbook: XLSX.WorkBook): string {
  const excelBuffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'base64'
  })
  return excelBuffer
}

/**
 * 파일명 생성 (날짜 범위 포함)
 */
export function generateFilename(results: ExportTestResult[]): string {
  const dates = results.map(r => r.test_date).sort()

  if (dates.length === 0) {
    return 'mimo-blood-test-results'
  }

  const firstDate = dates[0]
  const lastDate = dates[dates.length - 1]

  if (firstDate === lastDate) {
    return `mimo-blood-test-${firstDate}`
  }

  return `mimo-blood-test-${firstDate}_to_${lastDate}`
}
