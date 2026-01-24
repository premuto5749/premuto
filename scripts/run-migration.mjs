/**
 * Hospitals 테이블 마이그레이션 직접 실행
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// .env.local 수동 파싱
const envPath = join(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials not found in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('🚀 Hospitals 테이블 마이그레이션 시작...\n');

  // SQL 파일 읽기
  const sqlPath = join(__dirname, '..', 'supabase', 'migrations', '003_hospitals_table.sql');
  const fullSql = readFileSync(sqlPath, 'utf8');

  console.log('📄 마이그레이션 SQL:');
  console.log('━'.repeat(60));
  console.log(fullSql);
  console.log('━'.repeat(60));
  console.log('\n⚠️  위 SQL을 Supabase Dashboard → SQL Editor에 복사해서 실행하세요!\n');
  console.log('📍 Dashboard URL:', `${supabaseUrl.replace('//', '//app.')}/project/_/sql`);
  console.log('\n단계:');
  console.log('1. 위 URL 열기');
  console.log('2. "New query" 클릭');
  console.log('3. 위에 표시된 SQL 전체 복사');
  console.log('4. SQL Editor에 붙여넣기');
  console.log('5. "Run" 버튼 클릭');
  console.log('\n✨ 완료되면 병원 선택 기능이 정상 작동합니다!');
}

runMigration();
