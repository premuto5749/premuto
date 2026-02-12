import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

export const dynamic = 'force-dynamic'

const CONFIG_PATH = join(process.cwd(), 'config', 'unit_mappings.json')

/**
 * GET /api/admin/unit-config
 * 단위 설정 조회 (별칭 + OCR 보정 규칙)
 */
export async function GET() {
  try {
    const { authorized, error } = await requireAdmin()
    if (!authorized) {
      return NextResponse.json({ error }, { status: 403 })
    }

    const content = await readFile(CONFIG_PATH, 'utf-8')
    const config = JSON.parse(content)

    return NextResponse.json({
      success: true,
      data: {
        unit_aliases: config.unit_aliases,
        ocr_corrections: config.ocr_corrections,
      }
    })
  } catch (error) {
    console.error('Unit config GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/unit-config
 * 단위 설정 업데이트 (별칭 + OCR 보정 규칙)
 */
export async function PUT(request: NextRequest) {
  try {
    const { authorized, error } = await requireAdmin()
    if (!authorized) {
      return NextResponse.json({ error }, { status: 403 })
    }

    const body = await request.json()
    const { unit_aliases, ocr_corrections } = body

    if (!unit_aliases && !ocr_corrections) {
      return NextResponse.json(
        { error: 'unit_aliases or ocr_corrections is required' },
        { status: 400 }
      )
    }

    // 기존 config 읽기
    const content = await readFile(CONFIG_PATH, 'utf-8')
    const config = JSON.parse(content)

    // 요청된 섹션만 업데이트
    if (unit_aliases) {
      config.unit_aliases = unit_aliases
    }
    if (ocr_corrections) {
      config.ocr_corrections = ocr_corrections
    }
    config.last_updated = new Date().toISOString().split('T')[0]

    // 저장
    await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')

    return NextResponse.json({
      success: true,
      message: 'Unit config updated successfully'
    })
  } catch (error) {
    console.error('Unit config PUT error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
