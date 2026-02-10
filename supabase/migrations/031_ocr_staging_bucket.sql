-- OCR 스테이징 버킷 생성
-- OCR 처리 후 ~ 사용자 저장 시점까지 파일을 임시 보관
-- 저장 완료 후 Google Drive로 업로드하고 스테이징 파일 삭제

-- 1. ocr-staging 버킷 생성 (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('ocr-staging', 'ocr-staging', false)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS 정책: 본인 userId 경로만 접근 가능
-- 경로 규칙: {userId}/{batchId}/{filename}

-- SELECT (다운로드)
CREATE POLICY "Users can download own staging files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'ocr-staging'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- INSERT (업로드)
CREATE POLICY "Users can upload own staging files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ocr-staging'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- DELETE (정리)
CREATE POLICY "Users can delete own staging files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'ocr-staging'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
