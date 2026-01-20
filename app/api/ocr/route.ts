import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      )
    }

    // 파일 크기 체크 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      )
    }

    // 파일 타입 체크
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPG, PNG, and PDF are allowed.' },
        { status: 400 }
      )
    }

    // 파일을 Base64로 인코딩
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')
    const mimeType = file.type

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
      temperature: 0.1, // 정확도를 위해 낮은 temperature
    })

    const content = completion.choices[0]?.message?.content
    
    if (!content) {
      return NextResponse.json(
        { error: 'No response from OCR service' },
        { status: 500 }
      )
    }

    // JSON 파싱
    let ocrResult
    try {
      // GPT가 ```json ... ``` 형태로 응답할 수 있으므로 정제
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        ocrResult = JSON.parse(jsonMatch[0])
      } else {
        ocrResult = JSON.parse(content)
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      return NextResponse.json(
        { 
          error: 'Failed to parse OCR result',
          raw_content: content 
        },
        { status: 500 }
      )
    }

    // 응답 검증
    if (!ocrResult.items || !Array.isArray(ocrResult.items)) {
      return NextResponse.json(
        { error: 'Invalid OCR result format' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: ocrResult
    })

  } catch (error) {
    console.error('OCR API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
