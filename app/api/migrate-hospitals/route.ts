import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Hospitals 테이블 마이그레이션 엔드포인트
 *
 * 사용법: 브라우저에서 /api/migrate-hospitals 방문
 *
 * ⚠️  보안: 프로덕션에서는 이 파일을 삭제하거나 인증을 추가하세요!
 */

export async function GET() {
  try {
    const supabase = await createClient()

    console.log('🚀 Hospitals 테이블 마이그레이션 시작...')

    const results = []

    // 1. hospitals 테이블 생성
    try {
      const { error: createTableError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS hospitals (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(255) NOT NULL UNIQUE,
            address TEXT,
            phone VARCHAR(50),
            website VARCHAR(255),
            notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
          );
        `
      })

      if (createTableError) {
        // RPC 함수가 없을 수 있음 - 대체 방법 시도
        console.log('⚠️  RPC 방식 실패, 직접 테이블 조회로 확인...')

        // 테이블 존재 여부 확인
        const { data, error: selectError } = await supabase
          .from('hospitals')
          .select('id')
          .limit(1)

        if (selectError && selectError.code === '42P01') {
          // 테이블이 없음
          results.push({
            step: 'CREATE TABLE hospitals',
            status: 'error',
            message: 'RPC 함수를 사용할 수 없습니다. Supabase Dashboard에서 수동으로 실행해야 합니다.'
          })
        } else if (selectError) {
          results.push({
            step: 'CREATE TABLE hospitals',
            status: 'error',
            message: selectError.message
          })
        } else {
          results.push({
            step: 'CREATE TABLE hospitals',
            status: 'success',
            message: '테이블이 이미 존재하거나 생성되었습니다'
          })
        }
      } else {
        results.push({
          step: 'CREATE TABLE hospitals',
          status: 'success',
          message: 'hospitals 테이블 생성 완료'
        })
      }
    } catch (err) {
      results.push({
        step: 'CREATE TABLE hospitals',
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error'
      })
    }

    // 2. 테스트 데이터 확인
    const { data: hospitals, error: selectError } = await supabase
      .from('hospitals')
      .select('*')
      .limit(5)

    if (selectError) {
      results.push({
        step: 'SELECT from hospitals',
        status: 'error',
        message: selectError.message
      })
    } else {
      results.push({
        step: 'SELECT from hospitals',
        status: 'success',
        message: `hospitals 테이블 확인 완료 (${hospitals?.length || 0}개 레코드)`
      })
    }

    // 결과 요약
    const hasErrors = results.some(r => r.status === 'error')

    if (hasErrors) {
      return NextResponse.json({
        success: false,
        message: '일부 마이그레이션 단계가 실패했습니다.',
        manualInstructions: `
Supabase는 보안상 이유로 브라우저에서 DDL 명령을 실행할 수 없습니다.
다음 단계를 따라 수동으로 마이그레이션하세요:

1. Supabase Dashboard 열기: https://supabase.com/dashboard
2. 프로젝트 선택
3. SQL Editor 클릭
4. "New query" 클릭
5. 다음 파일의 내용을 복사해서 붙여넣기:
   supabase/migrations/003_hospitals_table.sql

6. "Run" 버튼 클릭
7. 완료!
        `,
        results
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '마이그레이션이 완료되었습니다! (또는 이미 완료되어 있습니다)',
      results,
      nextSteps: [
        '1. 대시보드로 돌아가기',
        '2. 파일 업로드 시도',
        '3. 병원 선택이 정상 작동하는지 확인'
      ]
    })

  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({
      success: false,
      error: 'Migration failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      manualInstructions: `
⚠️  자동 마이그레이션 실패

Supabase Dashboard에서 수동으로 실행하세요:
1. https://supabase.com/dashboard 열기
2. SQL Editor에서 supabase/migrations/003_hospitals_table.sql 실행
      `
    }, { status: 500 })
  }
}
