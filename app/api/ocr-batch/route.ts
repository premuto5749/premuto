import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import type { OcrResult } from '@/types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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
        let itemsStr = itemsMatch[1]
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

// 단일 파일 OCR 처리 함수 (재시도 지원)
async function processFile(file: File, retryCount = 0): Promise<{
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
}> {
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

  console.log(`📁 Processing file: ${file.name} (${file.size} bytes)${retryCount > 0 ? ` [Retry ${retryCount}]` : ''}`)

  try {
    // GPT-4o Vision API 호출
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `이 이미지는 반려동물의 혈액검사 결과지입니다.
다음 정보를 정확하게 추출하여 JSON 형식으로 반환해주세요:

1. 검사 날짜 (test_date): YYYY-MM-DD 형식
2. 병원명 (hospital_name): 병원 이름
3. 장비명 (machine_type): 사용된 장비 이름 (있는 경우)
4. 검사 항목들 (items): 배열 형태로
   - name: 검사 항목명 (예: CREA, BUN, ALT 등)
   - value: 검사 결과 수치 (숫자만)
   - unit: 단위 (예: mg/dL, U/L, % 등)
   - ref_min: 참고치 최소값 (숫자, 없으면 null)
   - ref_max: 참고치 최대값 (숫자, 없으면 null)
   - ref_text: 참고치 원문 (예: "0.5-1.8", 없으면 null)

응답 형식 예시:
{
  "test_date": "2024-12-02",
  "hospital_name": "타임즈동물의료센터",
  "machine_type": "Fuji DRI-CHEM",
  "items": [
    {
      "name": "CREA",
      "value": 1.2,
      "unit": "mg/dL",
      "ref_min": 0.5,
      "ref_max": 1.8,
      "ref_text": "0.5-1.8"
    }
  ]
}

중요:
- 모든 수치는 숫자 타입으로 반환
- 검사 항목명은 대문자로 통일
- 참고치가 없는 경우 null로 표시
- JSON만 반환하고 다른 설명은 추가하지 마세요
- 반드시 유효한 JSON 형식으로 반환하세요`
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64}`
              }
            }
          ]
        }
      ],
      max_tokens: 4000,
      temperature: 0.1,
    })

    const content = completion.choices[0]?.message?.content

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
      return {
        filename: file.name,
        items: [],
        metadata: {
          pages: 1,
          processingTime: Date.now() - startTime
        },
        error: `JSON 파싱 실패: ${file.name}`
      }
    }

    const processingTime = Date.now() - startTime

    return {
      filename: file.name,
      items: (ocrResult.items as OcrResult[]) || [],
      metadata: {
        test_date: ocrResult.test_date as string | undefined,
        hospital_name: ocrResult.hospital_name as string | undefined,
        machine_type: ocrResult.machine_type as string | undefined,
        pages: 1,
        processingTime
      }
    }
  } catch (error) {
    console.error(`❌ OCR processing error for ${file.name}:`, error)

    // API 오류 시 재시도
    if (retryCount < MAX_RETRIES) {
      console.log(`⚠️ Retrying ${file.name}... (${retryCount + 1}/${MAX_RETRIES})`)
      await new Promise(resolve => setTimeout(resolve, 2000)) // 2초 대기
      return processFile(file, retryCount + 1)
    }

    // 최종 실패 시 빈 결과 반환
    return {
      filename: file.name,
      items: [],
      metadata: {
        pages: 1,
        processingTime: Date.now() - startTime
      },
      error: error instanceof Error ? error.message : 'OCR 처리 실패'
    }
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

    console.log(`🚀 Processing ${files.length} files in parallel...`)

    // 모든 파일을 병렬로 처리
    const results = await Promise.all(
      files.map(file => processFile(file))
    )

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
        message: `여러 검사 날짜가 발견되었습니다: ${uniqueDates.join(', ')}. 정말 같은 검사인가요?`,
        files: results
          .filter(r => r.metadata.test_date && uniqueDates.includes(r.metadata.test_date))
          .map(r => r.filename)
      })
    }

    // 중복 항목 검출 (성공한 결과만)
    const allItemNames: Record<string, string[]> = {}
    successfulResults.forEach(result => {
      result.items.forEach(item => {
        if (!allItemNames[item.name]) {
          allItemNames[item.name] = []
        }
        allItemNames[item.name].push(result.filename)
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
