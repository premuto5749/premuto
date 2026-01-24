/**
 * Hospitals 테이블 마이그레이션 스크립트
 *
 * 사용법: node scripts/migrate-hospitals.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// .env.local에서 환경 변수 로드
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase 환경 변수가 설정되지 않았습니다.');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl);
  console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? '설정됨' : '없음');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('🚀 Hospitals 테이블 마이그레이션 시작...');
  console.log('📍 Supabase URL:', supabaseUrl);

  try {
    // SQL 파일 읽기
    const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '003_hospitals_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 SQL 파일 로드 완료');
    console.log('📝 SQL 길이:', sql.length, 'bytes');

    // SQL을 개별 명령으로 분할 (주석 제거)
    const commands = sql
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

    console.log('💾 실행할 SQL 명령:', commands.length, '개');

    // 각 명령 순차 실행
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      console.log(`\n[${i + 1}/${commands.length}] 실행 중...`);
      console.log('SQL:', command.substring(0, 100) + '...');

      try {
        const { data, error } = await supabase.rpc('exec_sql', { query: command });

        if (error) {
          throw error;
        }

        console.log('✅ 성공');
      } catch (err) {
        console.error('⚠️  명령 실행 실패:', err.message);
        console.error('SQL:', command);
        // 일부 명령은 실패해도 계속 진행 (예: 이미 존재하는 테이블)
      }
    }

    console.log('\n🎉 마이그레이션 완료!');
    console.log('\n다음 단계:');
    console.log('1. Supabase Dashboard에서 hospitals 테이블 확인');
    console.log('2. test_records 테이블에 hospital_id 컬럼 확인');

  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error);
    process.exit(1);
  }
}

runMigration();
