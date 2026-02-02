import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { OcrResult } from '@/types'
import { extractRefMinMax } from '@/lib/ocr/ref-range-parser'
import { removeThousandsSeparator } from '@/lib/ocr/value-parser'

// 최대 실행 시간 설정 (120초 - OCR은 시간이 오래 걸림)
export const maxDuration = 120

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
    // 5. test_groups 형식 복구 시도 (다중 날짜 지원)
    try {
      const testGroupsMatch = cleaned.match(/"test_groups"\s*:\s*\[([\s\S]*)$/)
      if (testGroupsMatch) {
        const groupsContent = testGroupsMatch[1]
        // 각 그룹 객체 추출 (중첩된 객체 처리)
        const groups: Array<Record<string, unknown>> = []
        let depth = 0
        let currentGroup = ''
        let inGroup = false

        for (let i = 0; i < groupsContent.length; i++) {
          const char = groupsContent[i]

          if (char === '{') {
            if (depth === 0) {
              inGroup = true
              currentGroup = '{'
            } else {
              currentGroup += char
            }
            depth++
          } else if (char === '}') {
            depth--
            currentGroup += char
            if (depth === 0 && inGroup) {
              // 그룹 완료 - 파싱 시도
              try {
                const group = JSON.parse(currentGroup)
                groups.push(group)
              } catch {
                // 개별 그룹 파싱 실패 - 무시
              }
              currentGroup = ''
              inGroup = false
            }
          } else if (inGroup) {
            currentGroup += char
          }
        }

        if (groups.length > 0) {
          console.log(`✅ Recovered ${groups.length} test_groups from malformed JSON`)
          return { test_groups: groups }
        }
      }
    } catch {
      // test_groups 복구 실패, 기존 items 복구 시도
    }

    // 6. 기존 items 배열만 추출 (단일 날짜 형식 하위 호환성)
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

// OCR 프롬프트 - 데이터 추출 최우선
const OCR_PROMPT = `수의학 혈액검사 결과지에서 데이터를 추출하세요.

# 최우선 작업: 날짜 찾기
문서에서 검사 날짜를 반드시 찾으세요. 다음 위치를 확인:
- 상단 헤더 (검사일, Date, 날짜)
- 출력 일시, 접수일
- 타임스탬프 형식 (2024/12/02, 2024.12.02, 24-12-02 등)
날짜를 찾으면 YYYY-MM-DD 형식으로 변환하세요.

# 출력 형식
\`\`\`json
{
  "test_groups": [
    {
      "test_date": "2024-12-02",
      "hospital_name": "병원명 또는 null",
      "machine_type": "장비명 또는 null",
      "items": [
        {"raw_name": "ALT(GPT)", "value": 23, "unit": "U/L", "reference": "3-50", "is_abnormal": false, "abnormal_direction": null}
      ]
    }
  ]
}
\`\`\`

# 항목 추출 규칙
- raw_name: 검사지 원문 그대로 (대소문자, 특수문자 유지)
- value: 숫자는 number 타입으로 (23, 0, 1.5), 특수값은 문자열("<500", ">1000", "Low", "Negative"), 값 없음은 null
- unit: 단위 (없으면 빈 문자열)
- reference: 참고치 원문 (3-50, <14 등)
- is_abnormal: ▲▼HL 표시 있으면 true
- abnormal_direction: "high" 또는 "low" 또는 null

# 핵심 규칙
1. PDF면 모든 페이지 확인
2. 날짜가 다르면 별도 test_group으로 분리
3. ⚠️ 중요: 0과 null 구분 필수!
   - 실제 측정값 0 → value: 0 (숫자)
   - 측정 안 됨/값 없음/빈칸 → value: null
   - 절대로 0을 null로 바꾸지 마세요!
4. 천단위 콤마 제거 (1,390 → 1390)
5. JSON만 반환, 설명 없음
6. 이미지의 모든 검사 항목을 빠짐없이 추출하세요. 테이블 전체를 확인하세요.`

// 단일 파일 OCR 처리 함수 (Claude API 사용, 다중 날짜 지원)
async function processFile(file: File, fileIndex: number, retryCount = 0): Promise<FileResult[]> {
  const startTime = Date.now()
  const MAX_RETRIES = 2

  // 파일별 유니크 ID 생성 (디버깅용)
  const fileId = `file_${fileIndex}_${Date.now()}_${Math.random().toString(36).substring(7)}`

  // 파일을 Base64로 인코딩 - 파일 데이터를 즉시 복사하여 클로저 문제 방지
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const base64 = buffer.toString('base64')

  // 파일 크기 및 해시 로깅 (중복 파일 디버깅용)
  const fileHash = buffer.slice(0, 100).toString('hex') // 처음 100바이트로 간단한 해시

  // MIME type 정규화
  let mimeType = file.type
  if (mimeType === 'image/jpg') {
    mimeType = 'image/jpeg'
  }

  const isPdf = mimeType === 'application/pdf'

  console.log(`📁 [${fileId}] Processing file: ${file.name} (${file.size} bytes, ${isPdf ? 'PDF' : 'Image'}, hash: ${fileHash.substring(0, 16)}...)${retryCount > 0 ? ` [Retry ${retryCount}]` : ''}`)

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

    // 파일별 고유 프롬프트 생성 (파일명 포함)
    const fileSpecificPrompt = `[파일: ${file.name}]\n\n${OCR_PROMPT}\n\n⚠️ 중요: 이 이미지/문서에서만 데이터를 추출하세요. 다른 파일의 내용과 혼동하지 마세요.`

    // Claude API 호출
    const message = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,
      messages: [
        {
          role: 'user',
          content: [
            fileContent,
            {
              type: 'text',
              text: fileSpecificPrompt,
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
        return processFile(file, fileIndex, retryCount + 1)
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

        // value 처리: null은 null로 유지, 0은 0으로 유지
        let processedValue: number | string | null = null

        if (item.value === null || item.value === undefined) {
          // null 또는 undefined는 null로 처리
          processedValue = null
        } else if (typeof item.value === 'number') {
          // 숫자는 그대로 (0 포함)
          processedValue = item.value
        } else if (typeof item.value === 'string') {
          const cleaned = removeThousandsSeparator(item.value)
          if (cleaned === '' || cleaned.toLowerCase() === 'null') {
            // 빈 문자열 또는 "null" 문자열은 null로 처리
            processedValue = null
          } else {
            // 순수 숫자인 경우 number로 변환
            const numValue = parseFloat(cleaned)
            if (!isNaN(numValue) && /^-?\d+\.?\d*$/.test(cleaned)) {
              processedValue = numValue
            } else {
              // 특수값 (예: "<500", ">1000", "Low", "Negative")
              processedValue = cleaned
            }
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
      return processFile(file, fileIndex, retryCount + 1)
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
    // fileIndex를 전달하여 파일별 유니크한 처리 보장
    const nestedResults = await Promise.all(
      files.map((file, index) => processFile(file, index))
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

    // AI 사용량 제한 에러 처리
    if (error instanceof Anthropic.RateLimitError ||
        (error instanceof Error && (
          error.message.includes('rate_limit') ||
          error.message.includes('quota') ||
          error.message.includes('429')
        ))) {
      return NextResponse.json(
        {
          error: 'AI_RATE_LIMIT',
          message: 'AI 사용량 제한에 도달하였습니다. 잠시 후 다시 시도해주세요.'
        },
        { status: 429 }
      )
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
