import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/with-auth'
import { checkMonthlyUsageLimit, logUsage } from '@/lib/tier'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

const ALLOWED_TYPES = [
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a', 'audio/x-m4a',
  'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg', 'audio/flac',
]
const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB (Whisper API limit)

const STRUCTURING_PROMPT = `You are analyzing a Korean veterinary visit recording transcript. Extract structured information from the conversation.

Return a JSON object with these fields (use null for fields you cannot determine):
{
  "visit_date": "YYYY-MM-DD or null",
  "hospital_name": "string or null",
  "vet_name": "string or null",
  "diagnosis": ["array of diagnosis strings"],
  "prescriptions": [{"drug_name": "string", "dosage": "string", "frequency": "string", "duration": "string"}],
  "procedures": "string or null",
  "next_visit_date": "YYYY-MM-DD or null",
  "vet_instructions": "string or null",
  "cost": number_or_null
}

Rules:
- Extract only what is explicitly mentioned in the transcript
- For prescriptions, include as many details as available
- Cost should be in Korean Won (원), numbers only
- Dates should be in YYYY-MM-DD format
- Return ONLY valid JSON, no markdown or explanation`

export const POST = withAuth(async (request, { supabase, user }) => {
  try {
    // 1. Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const petId = formData.get('pet_id') as string | null
    const consentAgreed = formData.get('consent_agreed') as string | null

    // 2. Validate consent
    if (consentAgreed !== 'true') {
      return NextResponse.json(
        { error: '면책 동의가 필요합니다' },
        { status: 400 }
      )
    }

    // 3. Validate pet_id
    if (!petId) {
      return NextResponse.json(
        { error: 'pet_id가 필요합니다' },
        { status: 400 }
      )
    }

    // 4. Validate file
    if (!file) {
      return NextResponse.json(
        { error: '오디오 파일이 필요합니다' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: '파일이 너무 큽니다 (최대 25MB)' },
        { status: 400 }
      )
    }

    const fileType = file.type || guessType(file.name)
    if (!ALLOWED_TYPES.includes(fileType)) {
      return NextResponse.json(
        { error: '지원하지 않는 파일 형식입니다 (mp3, m4a, wav, webm, ogg, flac)' },
        { status: 400 }
      )
    }

    // 5. Check tier limit
    const usageCheck = await checkMonthlyUsageLimit(user.id, 'vet_visit_transcribe')
    if (!usageCheck.allowed) {
      return NextResponse.json(
        {
          error: '이번 달 녹음 분석 횟수를 모두 사용했습니다',
          used: usageCheck.used,
          limit: usageCheck.limit,
          tier: usageCheck.tier,
        },
        { status: 403 }
      )
    }

    // 6. Log consent
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || ''
    const ua = request.headers.get('user-agent') || ''
    await supabase.from('consent_logs').insert({
      user_id: user.id,
      consent_type: 'vet_visit_recording',
      ip_address: ip,
      user_agent: ua,
    })

    // 7. Upload to Storage
    const ext = file.name.split('.').pop() || 'mp3'
    const fileName = `${crypto.randomUUID()}.${ext}`
    const filePath = `${user.id}/${fileName}`

    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await supabase.storage
      .from('vet-recordings')
      .upload(filePath, fileBuffer, {
        contentType: fileType,
        upsert: false,
      })

    if (uploadError) {
      console.error('[VetVisit] Storage upload error:', uploadError)
      return NextResponse.json(
        { error: '파일 업로드에 실패했습니다' },
        { status: 500 }
      )
    }

    // 8. Whisper STT
    let transcript: string
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      const transcription = await openai.audio.transcriptions.create({
        model: 'whisper-1',
        file: new File([fileBuffer], file.name, { type: fileType }),
        language: 'ko',
      })
      transcript = transcription.text
    } catch (sttError) {
      console.error('[VetVisit] Whisper STT error:', sttError)
      // Clean up uploaded file
      await supabase.storage.from('vet-recordings').remove([filePath])
      return NextResponse.json(
        { error: '음성 인식에 실패했습니다. 다시 시도해주세요' },
        { status: 502 }
      )
    }

    // 9. Claude structuring
    let structured = {
      visit_date: null,
      hospital_name: null,
      vet_name: null,
      diagnosis: [] as string[],
      prescriptions: [] as Array<{ drug_name: string; dosage: string; frequency: string; duration: string }>,
      procedures: null,
      next_visit_date: null,
      vet_instructions: null,
      cost: null,
    }

    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: `${STRUCTURING_PROMPT}\n\n전사 텍스트:\n${transcript}`,
          },
        ],
      })
      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      // Extract JSON from possible markdown code block
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        structured = { ...structured, ...JSON.parse(jsonMatch[0]) }
      }
    } catch (aiError) {
      console.error('[VetVisit] Claude structuring error:', aiError)
      // Degraded response — return transcript only, no structured data
    }

    // 10. Log usage
    await logUsage(user.id, 'vet_visit_transcribe', 1, {
      pet_id: petId,
      file_name: file.name,
      file_size: file.size,
    })

    return NextResponse.json({
      transcript,
      structured,
      audio_file_path: filePath,
    })
  } catch (err) {
    console.error('[VetVisit] Transcribe unexpected error:', err)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    )
  }
})

function guessType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    wav: 'audio/wav',
    webm: 'audio/webm',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
  }
  return map[ext || ''] || 'application/octet-stream'
}
