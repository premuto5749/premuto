import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { DailyLog, DailyLogInput, DailyStats } from '@/types'

// GET: 기록 조회 (날짜 범위 또는 특정 날짜)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const date = searchParams.get('date')           // 특정 날짜 (YYYY-MM-DD)
    const startDate = searchParams.get('start')     // 시작일
    const endDate = searchParams.get('end')         // 종료일
    const category = searchParams.get('category')   // 카테고리 필터
    const stats = searchParams.get('stats')         // 통계 조회 여부

    // 통계 조회
    if (stats === 'true') {
      let query = supabase.from('daily_stats').select('*')

      if (date) {
        query = query.eq('log_date', date)
      } else if (startDate && endDate) {
        query = query.gte('log_date', startDate).lte('log_date', endDate)
      }

      const { data, error } = await query.order('log_date', { ascending: false })

      if (error) {
        console.error('Daily stats query error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: data as DailyStats[]
      })
    }

    // 일반 기록 조회
    let query = supabase.from('daily_logs').select('*')

    if (date) {
      // 특정 날짜의 기록
      query = query.gte('logged_at', `${date}T00:00:00`)
                   .lt('logged_at', `${date}T23:59:59.999`)
    } else if (startDate && endDate) {
      query = query.gte('logged_at', `${startDate}T00:00:00`)
                   .lte('logged_at', `${endDate}T23:59:59.999`)
    }

    if (category) {
      query = query.eq('category', category)
    }

    const { data, error } = await query.order('logged_at', { ascending: false })

    if (error) {
      console.error('Daily logs query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: data as DailyLog[]
    })

  } catch (error) {
    console.error('Daily logs API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST: 새 기록 추가
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body: DailyLogInput = await request.json()

    const { category, logged_at, amount, unit, memo, photo_urls, medicine_name } = body

    if (!category) {
      return NextResponse.json(
        { error: 'Category is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('daily_logs')
      .insert({
        category,
        logged_at: logged_at || new Date().toISOString(),
        amount,
        unit,
        memo,
        photo_urls: photo_urls || [],
        medicine_name: category === 'medicine' ? medicine_name : null
      })
      .select()
      .single()

    if (error) {
      console.error('Daily log insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: data as DailyLog
    })

  } catch (error) {
    console.error('Daily logs POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE: 기록 삭제
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('daily_logs')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Daily log delete error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Daily logs DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH: 기록 수정
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('daily_logs')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Daily log update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: data as DailyLog
    })

  } catch (error) {
    console.error('Daily logs PATCH error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
