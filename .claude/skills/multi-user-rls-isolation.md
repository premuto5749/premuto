# Multi-User RLS Isolation Pattern (다중 사용자 RLS 격리 패턴)

다중 사용자 SaaS 애플리케이션에서 **Supabase Row Level Security(RLS)를 활용한 데이터 격리** 패턴.

## 핵심 원칙

1. **DB 레벨 격리**: 애플리케이션 코드가 아닌 DB 정책으로 접근 제어
2. **Zero Trust**: 사용자는 본인 데이터만 접근 가능
3. **스토리지 격리**: 파일 저장소도 사용자별 폴더로 분리

## 데이터베이스 스키마 설계

### 1. 사용자 참조 컬럼

모든 사용자 데이터 테이블에 `user_id` 컬럼 추가:

```sql
CREATE TABLE user_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 기타 컬럼들...
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- user_id 인덱스 (필수)
CREATE INDEX idx_user_records_user_id ON user_records(user_id);
```

### 2. RLS 정책 설정

```sql
-- RLS 활성화
ALTER TABLE user_records ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 데이터만 조회
CREATE POLICY "Users can view own records"
  ON user_records FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: 본인 user_id로만 삽입
CREATE POLICY "Users can insert own records"
  ON user_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: 본인 데이터만 수정
CREATE POLICY "Users can update own records"
  ON user_records FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: 본인 데이터만 삭제
CREATE POLICY "Users can delete own records"
  ON user_records FOR DELETE
  USING (auth.uid() = user_id);
```

### 3. 서비스 롤 정책 (관리자용)

```sql
-- 서비스 롤은 모든 데이터 접근 가능 (백엔드 배치 작업 등)
CREATE POLICY "Service role has full access"
  ON user_records FOR ALL
  USING (auth.role() = 'service_role');
```

## 스토리지 격리

### 폴더 구조

```
storage/
└── uploads/
    └── {user_id}/
        ├── images/
        ├── documents/
        └── temp/
```

### 스토리지 정책

```sql
-- 스토리지 버킷 생성
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', false);

-- 본인 폴더만 접근
CREATE POLICY "Users can access own folder"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'uploads' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
```

## 클라이언트 코드

### 데이터 조회 (자동 필터링)

```typescript
// RLS가 활성화되어 있으므로 별도 필터 불필요
const { data, error } = await supabase
  .from('user_records')
  .select('*');
// → 자동으로 현재 로그인 사용자의 데이터만 반환
```

### 데이터 삽입

```typescript
const { data, error } = await supabase
  .from('user_records')
  .insert({
    // user_id는 트리거 또는 클라이언트에서 설정
    user_id: (await supabase.auth.getUser()).data.user?.id,
    title: 'My Record',
    content: '...'
  });
```

### 파일 업로드

```typescript
const userId = (await supabase.auth.getUser()).data.user?.id;
const filePath = `${userId}/images/${file.name}`;

const { data, error } = await supabase.storage
  .from('uploads')
  .upload(filePath, file);
```

## Signed URL 패턴

비공개 파일을 임시로 접근할 수 있는 URL 생성:

```typescript
// DB에는 파일 경로만 저장
const record = { file_path: 'user123/images/photo.jpg' };

// API 응답 시 Signed URL 동적 생성
async function getRecordWithSignedUrl(record: Record) {
  if (record.file_path) {
    const { data } = await supabase.storage
      .from('uploads')
      .createSignedUrl(record.file_path, 60 * 60 * 24 * 7); // 7일 유효

    record.file_url = data?.signedUrl;
  }
  return record;
}
```

## 하위 호환성

기존 데이터(공개 URL로 저장된 경우) 처리:

```typescript
function resolveFileUrl(record: Record): string | null {
  if (!record.file_path) return null;

  // 기존 URL (http로 시작)은 그대로 사용
  if (record.file_path.startsWith('http')) {
    return record.file_path;
  }

  // 새 데이터 (경로만 저장)는 Signed URL 생성
  return generateSignedUrl(record.file_path);
}
```

## 체크리스트

새 테이블 생성 시 확인사항:

- [ ] `user_id UUID NOT NULL REFERENCES auth.users(id)` 컬럼 추가
- [ ] `user_id` 인덱스 생성
- [ ] RLS 활성화: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- [ ] SELECT/INSERT/UPDATE/DELETE 정책 각각 생성
- [ ] 서비스 롤 정책 (필요시)

## 주의사항

### 1. CASCADE DELETE

사용자 탈퇴 시 관련 데이터 자동 삭제:

```sql
user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
```

### 2. 조인 쿼리

RLS는 각 테이블에 독립적으로 적용됨. 조인 시 양쪽 테이블 모두 RLS 정책 필요:

```sql
-- posts와 comments 모두 user_id 기반 RLS 필요
SELECT p.*, c.*
FROM posts p
JOIN comments c ON p.id = c.post_id;
```

### 3. 백엔드 작업

배치 작업, 통계 집계 등은 서비스 롤 사용:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
// → RLS 우회하여 전체 데이터 접근
```

## 참고

이 패턴은 Premuto 프로젝트의 다중 사용자 반려동물 건강 기록 서비스에서 도출되었습니다.
각 사용자는 본인의 반려동물 데이터만 접근할 수 있으며, DB 레벨에서 격리됩니다.
