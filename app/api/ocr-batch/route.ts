import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { OcrResult } from '@/types'
import { extractRefMinMax } from '@/lib/ocr/ref-range-parser'
import { removeThousandsSeparator } from '@/lib/ocr/value-parser'

// Anthropic 클라이언트는 런타임에 생성 (빌드 타임에 환경변수 없음)
function getAnthropicClient() {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })
}

// JSON 문자열을 정리하고 복구하는 함수
function cleanAndParseJson(content: string): Record<string, unknown> | null {
  // 1. 기본 정리: 코드 블록 마커 제거
  let cleaned = content
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim()

  // 2. JSON 객체 부분만 추출
  const jsonStart = cleaned.indexOf('{')
  const jsonEnd = cleaned.lastIndexOf('}')

  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
    return null
  }

  cleaned = cleaned.substring(jsonStart, jsonEnd + 1)

  // 3. 일반적인 JSON 오류 수정
  // - 트레일링 콤마 제거
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1')
  // - 잘린 배열 닫기
  if (cleaned.includes('"items"') && !cleaned.includes(']}')) {
    // items 배열이 잘린 경우 복구 시도
    const itemsMatch = cleaned.match(/"items"\s*:\s*\[/)
    if (itemsMatch) {
      // 마지막 완전한 객체 찾기
      const lastCompleteObj = cleaned.lastIndexOf('}')
      if (lastCompleteObj > 0) {
        const afterItems = cleaned.substring(itemsMatch.index! + itemsMatch[0].length)
        // 배열 내 마지막 완전한 객체까지만 사용
        const objectCount = (afterItems.match(/\{[^{}]*\}/g) || []).length
        if (objectCount > 0) {
          // 배열과 객체 닫기 추가
          cleaned = cleaned.substring(0, lastCompleteObj + 1) + ']}'
        }
      }
    }
  }

  // 4. 파싱 시도
  try {
    return JSON.parse(cleaned)
  } catch {
    // 5. 더 공격적인 복구: items 배열만 추출
    try {
      const itemsMatch = cleaned.match(/"items"\s*:\s*\[([\s\S]*?)(?:\]|$)/)
      if (itemsMatch) {
        const itemsStr = itemsMatch[1]
        // 마지막 완전한 객체까지만 사용
        const objects = itemsStr.match(/\{[^{}]*\}/g) || []
        if (objects.length > 0) {
          const recoveredItems = objects.map(obj => {
            try {
              return JSON.parse(obj)
            } catch {
              return null
            }
          }).filter(Boolean)

          // 메타데이터 추출 시도
          const dateMatch = cleaned.match(/"test_date"\s*:\s*"([^"]*)"/)
          const hospitalMatch = cleaned.match(/"hospital_name"\s*:\s*"([^"]*)"/)
          const machineMatch = cleaned.match(/"machine_type"\s*:\s*"([^"]*)"/)

          return {
            test_date: dateMatch?.[1] || null,
            hospital_name: hospitalMatch?.[1] || null,
            machine_type: machineMatch?.[1] || null,
            items: recoveredItems
          }
        }
      }
    } catch {
      // 복구 실패
    }

    return null
  }
}

// 파일 결과 타입
interface FileResult {
  filename: string
  items: OcrResult[]
  metadata: {
    test_date?: string
    hospital_name?: string
    machine_type?: string
    pages: number
    processingTime: number
  }
  error?: string
}

// OCR 프롬프트
const OCR_PROMPT = `당신은 수의학 검사 결과지에서 데이터를 정확하게 추출하는 전문가입니다.

첨부된 검사 결과지(이미지 또는 PDF)에서 **모든 페이지와 모든 검사 날짜**의 정보를 순서대로 추출해주세요.

## 핵심 규칙
1. **반드시 모든 페이지를 확인하세요** - PDF의 경우 첫 페이지뿐 아니라 모든 페이지의 검사 결과를 추출해야 합니다.
2. **날짜가 다르면 반드시 별도의 test_group으로 분리하세요** - 같은 PDF 내에서도 검사 날짜가 다르면 각각 독립된 그룹입니다.
3. **날짜가 하나뿐이어도 test_groups 배열 형식을 사용하세요** - 항상 test_groups 배열 안에 넣어야 합니다.

## 출력 형식 (다중 날짜 지원)
{
  "test_groups": [
    {
      "test_date": "2024-12-02",
      "hospital_name": "타임즈동물의료센터",
      "patient_name": "미모",
      "machine_type": "Fuji DRI-CHEM",
      "items": [
        {
          "raw_name": "ALT(GPT)*",
          "value": "23",
          "unit": "U/L",
          "reference": "3-50",
          "is_abnormal": false,
          "abnormal_direction": null
        }
      ]
    },
    {
      "test_date": "2024-12-08",
      "hospital_name": "타임즈동물의료센터",
      "patient_name": "미모",
      "machine_type": null,
      "items": [
        {
          "raw_name": "cPL_V100",
          "value": "386.5",
          "unit": "ng/ml",
          "reference": "50-200",
          "is_abnormal": true,
          "abnormal_direction": "high"
        }
      ]
    }
  ]
}

## 각 test_group의 정보
- test_date: 검사일 (YYYY-MM-DD 형식)
- hospital_name: 병원명
- patient_name: 환자명 (동물 이름, 있는 경우)
- machine_type: 장비명 (있는 경우, 없으면 null)

## items 배열의 각 항목
- raw_name: 항목명 (검사지에 표기된 그대로, 대소문자 유지)
- value: 결과값 (숫자, <500, >1000, Low, Negative 등 특수표기 포함)
- unit: 단위
- reference: 참조범위 (원문 그대로, 예: "3-50", "<14")
- is_abnormal: 이상 여부 (▲, ▼, H, L 표시가 있으면 true)
- abnormal_direction: "high" (▲, H) / "low" (▼, L) / null

## 중요 주의사항
- **반드시 test_groups 배열 형식으로 반환하세요** (단일 날짜여도 배열 안에 넣기)
- **PDF의 모든 페이지를 확인하세요** - 2페이지, 3페이지 등에 다른 날짜의 검사가 있을 수 있습니다
- **문서에 나타나는 순서대로 추출하세요** (페이지 순서, 항목 순서 유지)
- **날짜가 다른 검사는 반드시 별도의 test_group으로 분리하세요**
- 같은 날짜의 검사는 하나의 test_group에 모든 items를 포함
- 값이 비어있거나 측정되지 않은 항목은 value를 null로
- 참조범위가 없는 항목은 reference를 빈 문자열로
- 특수 표기(*14, <500, >1000, Low 등)는 그대로 value에 기록
- 숫자에 천단위 구분자(,)가 있으면 제거 (1,390 → 1390)
- JSON만 반환하고 다른 설명은 추가하지 마세요
- 반드시 유효한 JSON 형식으로 반환하세요`

// 단일 파일 OCR 처리 함수 (Claude API 사용, 다중 날짜 지원)
async function processFile(file: File, retryCount = 0): Promise<FileResult[]> {
  const startTime = Date.now()
  const MAX_RETRIES = 2

  // 파일을 Base64로 인코딩
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const base64 = buffer.toString('base64')

  // MIME type 정규화
  let mimeType = file.type
  if (mimeType === 'image/jpg') {
    mimeType = 'image/jpeg'
  }

  const isPdf = mimeType === 'application/pdf'

  console.log(`📁 Processing file: ${file.name} (${file.size} bytes, ${isPdf ? 'PDF' : 'Image'})${retryCount > 0 ? ` [Retry ${retryCount}]` : ''}`)

  try {
    // Claude API용 content 구성
    const fileContent: Anthropic.Messages.ContentBlockParam = isPdf
      ? {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: base64,
          },
        }
      : {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: base64,
          },
        }

    // Claude API 호출
    const message = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: [
            fileContent,
            {
              type: 'text',
              text: OCR_PROMPT,
            },
          ],
        },
      ],
    })

    // 응답에서 텍스트 추출
    const textContent = message.content.find(block => block.type === 'text')
    const content = textContent?.type === 'text' ? textContent.text : null

    if (!content) {
      throw new Error(`No response from OCR service for file: ${file.name}`)
    }

    // JSON 파싱 (복구 로직 포함)
    const ocrResult = cleanAndParseJson(content)

    if (!ocrResult) {
      // 파싱 실패 시 재시도
      if (retryCount < MAX_RETRIES) {
        console.log(`⚠️ JSON parse failed for ${file.name}, retrying... (${retryCount + 1}/${MAX_RETRIES})`)
        await new Promise(resolve => setTimeout(resolve, 1000)) // 1초 대기
        return processFile(file, retryCount + 1)
      }

      console.error(`❌ JSON parse error for ${file.name} after ${MAX_RETRIES} retries`)
      console.error(`Raw content (first 500 chars): ${content.substring(0, 500)}`)

      // 실패해도 빈 결과 반환 (전체 배치가 실패하지 않도록)
      return [{
        filename: file.name,
        items: [],
        metadata: {
          pages: 1,
          processingTime: Date.now() - startTime
        },
        error: `JSON 파싱 실패: ${file.name}`
      }]
    }

    const processingTime = Date.now() - startTime

    // 아이템 변환 헬퍼 함수
    const convertItems = (rawItems: Array<{
      raw_name?: string
      name?: string
      value?: string | number | null
      unit?: string
      reference?: string
      ref_min?: number | null
      ref_max?: number | null
      ref_text?: string | null
      is_abnormal?: boolean
      abnormal_direction?: 'high' | 'low' | null
    }>): OcrResult[] => {
      return rawItems.map(item => {
        // reference에서 ref_min, ref_max 추출
        const refRange = extractRefMinMax(item.reference)

        // value 처리: 천단위 구분자 제거
        let processedValue: number | string = item.value ?? ''
        if (typeof processedValue === 'string') {
          const cleaned = removeThousandsSeparator(processedValue)
          // 순수 숫자인 경우 number로 변환
          const numValue = parseFloat(cleaned)
          if (!isNaN(numValue) && /^-?\d+\.?\d*$/.test(cleaned)) {
            processedValue = numValue
          } else {
            processedValue = cleaned
          }
        }

        return {
          name: item.raw_name?.toUpperCase() || item.name?.toUpperCase() || '',
          raw_name: item.raw_name || item.name || '',
          value: processedValue,
          unit: item.unit || '',
          ref_min: item.ref_min ?? refRange.ref_min,
          ref_max: item.ref_max ?? refRange.ref_max,
          ref_text: item.ref_text ?? refRange.ref_text,
          reference: item.reference,
          is_abnormal: item.is_abnormal,
          abnormal_direction: item.abnormal_direction
        }
      })
    }

    // 다중 날짜 그룹 형식 (test_groups) 처리
    type RawItem = {
      raw_name?: string
      name?: string
      value?: string | number | null
      unit?: string
      reference?: string
      ref_min?: number | null
      ref_max?: number | null
      ref_text?: string | null
      is_abnormal?: boolean
      abnormal_direction?: 'high' | 'low' | null
    }

    type TestGroup = {
      test_date?: string
      hospital_name?: string
      machine_type?: string
      items?: RawItem[]
    }

    const testGroups = ocrResult.test_groups as TestGroup[] | undefined

    if (testGroups && Array.isArray(testGroups)) {
      const results: FileResult[] = []

      testGroups.forEach((group, index) => {
        const groupItems = convertItems(group.items || [])
        const suffix = testGroups.length > 1 ? `_group${index + 1}` : ''

        results.push({
          filename: `${file.name}${suffix}`,
          items: groupItems,
          metadata: {
            test_date: group.test_date,
            hospital_name: group.hospital_name,
            machine_type: group.machine_type,
            pages: testGroups.length,
            processingTime
          }
        })
      })

      console.log(`✅ Extracted ${results.length} date group(s) from ${file.name}`)
      return results
    }

    // 기존 단일 날짜 형식 (items) 처리 - 하위 호환성
    const rawItems = (ocrResult.items || []) as Array<{
      raw_name?: string
      name?: string
      value?: string | number | null
      unit?: string
      reference?: string
      ref_min?: number | null
      ref_max?: number | null
      ref_text?: string | null
      is_abnormal?: boolean
      abnormal_direction?: 'high' | 'low' | null
    }>
    const items = convertItems(rawItems)

    return [{
      filename: file.name,
      items,
      metadata: {
        test_date: ocrResult.test_date as string | undefined,
        hospital_name: ocrResult.hospital_name as string | undefined,
        machine_type: ocrResult.machine_type as string | undefined,
        pages: 1,
        processingTime
      }
    }]
  } catch (error) {
    console.error(`❌ OCR processing error for ${file.name}:`, error)

    // API 오류 시 재시도
    if (retryCount < MAX_RETRIES) {
      console.log(`⚠️ Retrying ${file.name}... (${retryCount + 1}/${MAX_RETRIES})`)
      await new Promise(resolve => setTimeout(resolve, 2000)) // 2초 대기
      return processFile(file, retryCount + 1)
    }

    // 최종 실패 시 빈 결과 반환
    return [{
      filename: file.name,
      items: [],
      metadata: {
        pages: 1,
        processingTime: Date.now() - startTime
      },
      error: error instanceof Error ? error.message : 'OCR 처리 실패'
    }]
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files: File[] = []

    // FormData에서 모든 파일 추출
    for (const [key, value] of Array.from(formData.entries())) {
      if (key.startsWith('file') && value instanceof File) {
        files.push(value)
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files uploaded' },
        { status: 400 }
      )
    }

    // 파일 개수 제한 (최대 10개)
    if (files.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 files allowed' },
        { status: 400 }
      )
    }

    // 각 파일 검증
    for (const file of files) {
      // 파일 크기 체크 (10MB)
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: `File ${file.name} exceeds 10MB limit` },
          { status: 400 }
        )
      }

      // 파일 타입 체크
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { error: `Invalid file type for ${file.name}. Only JPG, PNG, and PDF are supported.` },
          { status: 400 }
        )
      }
    }

    console.log(`🚀 Processing ${files.length} files with Claude API...`)

    // 모든 파일을 병렬로 처리 (각 파일이 여러 결과를 반환할 수 있음)
    const nestedResults = await Promise.all(
      files.map(file => processFile(file))
    )

    // 중첩 배열을 평탄화 (한 파일에서 여러 날짜 그룹이 나올 수 있음)
    const results = nestedResults.flat()

    // 실패한 파일 확인
    const successfulResults = results.filter(r => !r.error)
    const failedResults = results.filter(r => r.error)

    console.log(`✅ Successfully processed ${successfulResults.length}/${results.length} files`)
    if (failedResults.length > 0) {
      console.log(`⚠️ Failed files: ${failedResults.map(r => r.filename).join(', ')}`)
    }

    // 메타데이터 일치성 검증
    const warnings: Array<{
      type: 'date_mismatch' | 'duplicate_item' | 'parse_error'
      message: string
      files: string[]
    }> = []

    // 실패한 파일들에 대한 경고 추가
    if (failedResults.length > 0) {
      warnings.push({
        type: 'parse_error',
        message: `일부 파일 처리에 실패했습니다: ${failedResults.map(r => r.error).join(', ')}`,
        files: failedResults.map(r => r.filename)
      })
    }

    // 검사 날짜 일치 확인 (성공한 결과만)
    const testDates = successfulResults
      .map(r => r.metadata.test_date)
      .filter(Boolean) as string[]

    const uniqueDates = [...new Set(testDates)]
    if (uniqueDates.length > 1) {
      warnings.push({
        type: 'date_mismatch',
        message: `여러 검사 날짜가 발견되었습니다: ${uniqueDates.join(', ')}. 각 날짜별로 별도 탭에서 확인하세요.`,
        files: results
          .filter(r => r.metadata.test_date && uniqueDates.includes(r.metadata.test_date))
          .map(r => r.filename)
      })
    }

    // 중복 항목 검출 (성공한 결과만)
    const allItemNames: Record<string, string[]> = {}
    successfulResults.forEach(result => {
      result.items.forEach(item => {
        const itemKey = item.name || item.raw_name || ''
        if (!itemKey) return
        if (!allItemNames[itemKey]) {
          allItemNames[itemKey] = []
        }
        allItemNames[itemKey].push(result.filename)
      })
    })

    Object.entries(allItemNames).forEach(([itemName, fileList]) => {
      if (fileList.length > 1) {
        warnings.push({
          type: 'duplicate_item',
          message: `"${itemName}" 항목이 여러 파일에서 발견되었습니다.`,
          files: fileList
        })
      }
    })

    // 배치 ID 생성 (타임스탬프 기반)
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(7)}`

    // 대표 메타데이터 선택 (첫 번째 성공 파일의 데이터 우선)
    const primaryResult = successfulResults[0] || results[0]
    const primaryMetadata = primaryResult.metadata

    return NextResponse.json({
      success: true,
      data: {
        test_date: primaryMetadata.test_date || '',
        hospital_name: primaryMetadata.hospital_name || '',
        batch_id: batchId,
        results: results.map(r => ({
          filename: r.filename,
          items: r.items,
          metadata: {
            pages: r.metadata.pages,
            processingTime: r.metadata.processingTime,
            test_date: r.metadata.test_date,
            hospital_name: r.metadata.hospital_name
          }
        })),
        warnings
      }
    })

  } catch (error) {
    console.error('OCR Batch API error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
