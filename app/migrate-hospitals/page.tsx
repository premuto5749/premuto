'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Copy, Check, ExternalLink } from 'lucide-react'

const MIGRATION_SQL = `-- hospitals 테이블 생성
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

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_hospitals_name ON hospitals(name);

-- 업데이트 타임스탬프 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_hospitals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hospitals_updated_at
  BEFORE UPDATE ON hospitals
  FOR EACH ROW
  EXECUTE FUNCTION update_hospitals_updated_at();

-- test_records 테이블에 hospital_id 외래키 추가
ALTER TABLE test_records
  ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES hospitals(id);

-- 기존 hospital_name에서 hospitals 테이블로 데이터 마이그레이션
INSERT INTO hospitals (name)
SELECT DISTINCT hospital_name
FROM test_records
WHERE hospital_name IS NOT NULL
  AND hospital_name != ''
ON CONFLICT (name) DO NOTHING;

-- 기존 test_records의 hospital_name을 hospital_id로 매핑
UPDATE test_records
SET hospital_id = hospitals.id
FROM hospitals
WHERE test_records.hospital_name = hospitals.name;`

export default function MigrateHospitalsPage() {
  const [copied, setCopied] = useState(false)
  const [migrationRun, setMigrationRun] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(MIGRATION_SQL)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
      alert('복사 실패. SQL을 수동으로 선택해서 복사하세요.')
    }
  }

  const openSupabaseDashboard = () => {
    window.open('https://supabase.com/dashboard', '_blank')
  }

  return (
    <div className="container max-w-4xl mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>🏥 Hospitals 테이블 마이그레이션</CardTitle>
          <CardDescription>
            병원 관리 기능을 사용하려면 데이터베이스 마이그레이션이 필요합니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 단계별 안내 */}
          <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
            <h3 className="font-semibold mb-3">📋 설치 단계 (3분 소요)</h3>
            <ol className="space-y-2 list-decimal list-inside text-sm">
              <li>
                <strong>SQL 복사하기</strong>
                <p className="ml-6 text-muted-foreground mt-1">
                  아래 &quot;SQL 복사&quot; 버튼을 클릭하여 마이그레이션 SQL을 클립보드에 복사
                </p>
              </li>
              <li>
                <strong>Supabase Dashboard 열기</strong>
                <p className="ml-6 text-muted-foreground mt-1">
                  &quot;Supabase Dashboard 열기&quot; 버튼 클릭 (새 탭에서 열림)
                </p>
              </li>
              <li>
                <strong>프로젝트 선택</strong>
                <p className="ml-6 text-muted-foreground mt-1">
                  Mimo Health Log 프로젝트 클릭
                </p>
              </li>
              <li>
                <strong>SQL Editor 이동</strong>
                <p className="ml-6 text-muted-foreground mt-1">
                  왼쪽 사이드바에서 &quot;SQL Editor&quot; 클릭 → &quot;New query&quot; 클릭
                </p>
              </li>
              <li>
                <strong>SQL 붙여넣기 및 실행</strong>
                <p className="ml-6 text-muted-foreground mt-1">
                  에디터에 복사한 SQL 붙여넣기 → 우측 상단 &quot;Run&quot; 버튼 클릭
                </p>
              </li>
              <li>
                <strong>완료 확인</strong>
                <p className="ml-6 text-muted-foreground mt-1">
                  &quot;Success. No rows returned&quot; 메시지 확인 → 아래 &quot;완료&quot; 체크
                </p>
              </li>
            </ol>
          </div>

          {/* 액션 버튼들 */}
          <div className="flex gap-3">
            <Button
              onClick={handleCopy}
              size="lg"
              className="flex-1"
              variant={copied ? "default" : "outline"}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  복사됨!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  1️⃣ SQL 복사
                </>
              )}
            </Button>

            <Button
              onClick={openSupabaseDashboard}
              size="lg"
              className="flex-1"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              2️⃣ Supabase Dashboard 열기
            </Button>
          </div>

          {/* SQL 미리보기 */}
          <div>
            <h3 className="font-semibold mb-2 text-sm">미리보기 (참고용)</h3>
            <div className="bg-muted p-4 rounded-lg overflow-x-auto max-h-96">
              <pre className="text-xs font-mono">{MIGRATION_SQL}</pre>
            </div>
          </div>

          {/* 완료 체크 */}
          <div className="border-t pt-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="migration-complete"
                checked={migrationRun}
                onChange={(e) => setMigrationRun(e.target.checked)}
                className="w-5 h-5"
              />
              <label htmlFor="migration-complete" className="text-sm font-medium cursor-pointer">
                ✅ 마이그레이션을 완료했습니다
              </label>
            </div>

            {migrationRun && (
              <div className="mt-4 bg-green-50 dark:bg-green-950/20 p-4 rounded-lg">
                <p className="text-green-900 dark:text-green-100 font-medium mb-2">
                  🎉 완료! 이제 병원 관리 기능을 사용할 수 있습니다
                </p>
                <div className="flex gap-2">
                  <Button asChild size="sm">
                    <a href="/upload">검사지 업로드하기</a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href="/dashboard">대시보드 보기</a>
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* 트러블슈팅 */}
          <details className="bg-muted/50 p-4 rounded-lg">
            <summary className="cursor-pointer font-medium text-sm">
              🔧 문제 해결 (클릭하여 펼치기)
            </summary>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <p><strong>Q: &quot;permission denied&quot; 에러가 발생해요</strong></p>
              <p className="ml-4">A: Supabase 프로젝트 소유자 계정으로 로그인했는지 확인하세요</p>

              <p className="mt-2"><strong>Q: &quot;relation already exists&quot; 에러가 발생해요</strong></p>
              <p className="ml-4">A: 이미 마이그레이션이 완료된 것입니다. 위 체크박스를 선택하고 계속 진행하세요</p>

              <p className="mt-2"><strong>Q: SQL Editor를 찾을 수 없어요</strong></p>
              <p className="ml-4">A: Dashboard 왼쪽 사이드바에서 &quot;SQL Editor&quot; 메뉴를 찾으세요. 없다면 프로젝트가 제대로 선택되었는지 확인하세요</p>
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  )
}
