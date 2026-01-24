import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import type { OcrResult } from '@/types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// 단일 파일 OCR 처리 함수
async function processFile(file: File): Promise<{
  filename: string
  items: OcrResult[]
  metadata: {
    test_date?: string
    hospital_name?: string
    machine_type?: string
    pages: number
    processingTime: number
  }
}> {
  const startTime = Date.now()

  // 파일을 Base64로 인코딩
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const base64 = buffer.toString('base64')

  // MIME type 정규화
  let mimeType = file.type
  if (mimeType === 'image/jpg') {
    mimeType = 'image/jpeg'
  }

  console.log(`📁 Processing file: ${file.name} (${file.size} bytes)`)

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
- JSON만 반환하고 다른 설명은 추가하지 마세요`
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
    max_tokens: 2000,
    temperature: 0.1,
  })

  const content = completion.choices[0]?.message?.content

  if (!content) {
    throw new Error(`No response from OCR service for file: ${file.name}`)
  }

  // JSON 파싱
  let ocrResult
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      ocrResult = JSON.parse(jsonMatch[0])
    } else {
      ocrResult = JSON.parse(content)
    }
  } catch (parseError) {
    console.error(`❌ JSON parse error for ${file.name}:`, parseError)
    throw new Error(`Failed to parse OCR result for file: ${file.name}`)
  }

  const processingTime = Date.now() - startTime

  return {
    filename: file.name,
    items: ocrResult.items || [],
    metadata: {
      test_date: ocrResult.test_date,
      hospital_name: ocrResult.hospital_name,
      machine_type: ocrResult.machine_type,
      pages: 1, // 단일 이미지는 1페이지로 간주
      processingTime
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

    console.log(`✅ Successfully processed ${results.length} files`)

    // 메타데이터 일치성 검증
    const warnings: Array<{
      type: 'date_mismatch' | 'duplicate_item'
      message: string
      files: string[]
    }> = []

    // 검사 날짜 일치 확인
    const testDates = results
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

    // 중복 항목 검출
    const allItemNames: Record<string, string[]> = {}
    results.forEach(result => {
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

    // 대표 메타데이터 선택 (첫 번째 파일의 데이터 우선)
    const primaryMetadata = results[0].metadata

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
            processingTime: r.metadata.processingTime
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
