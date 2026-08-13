-- 052_app_settings_grants_and_config_rls.sql
--
-- 051 의 후속. 051 은 "너무 열려 있던" 것을 막았고, 이 마이그레이션은
-- 그 반대인 "너무 잠겨서 기능이 죽어 있던" 것과 남은 쓰기 구멍을 다룬다.
--
-- 재실행 안전(idempotent).

-- ===========================================================================
-- 1) app_settings: 권한(GRANT) 누락으로 기능이 죽어 있던 문제
-- ===========================================================================
-- 증상: `permission denied for table app_settings` (SQLSTATE 42501)
--       Postgres 로그에 2026-08-11 하루만 20여 건.
--
-- 원인: RLS 정책은 처음부터 올바르게 두 개 있었다.
--         Anyone can read app_settings   SELECT  USING (true)
--         Admins can modify app_settings ALL     USING (user_roles 에 admin)
--       그런데 테이블 GRANT 는 service_role 에만 있고 anon/authenticated 에는
--       아예 없었다. RLS 와 GRANT 는 별개의 관문이고 Postgres 는 GRANT 를
--       먼저 검사한다 — 안내문은 붙였는데 출입카드를 안 준 상태였다.
--
-- 실제 피해 (실측):
--   · app_settings 6개 행 전부 created_at == updated_at, 최신 2026-02-10
--     → 관리자 설정 화면이 한 번도 저장에 성공한 적이 없다
--   · lib/site-settings.ts (app/layout.tsx 가 모든 페이지에서 호출) 가 실패 후
--     catch 로 삼켜 DEFAULT_SETTINGS 반환 → 사이트명·설명·파비콘·로고·OG이미지·
--     키워드·테마색이 관리자 설정과 무관하게 항상 코드 기본값
--   · lib/tier.ts 도 동일 → 티어 제한이 관리자 설정값이 아닌 코드 기본값으로 동작
--
-- 접근 방식: 코드를 service client 로 바꾸는 대신 GRANT 만 준다.
--   app_settings 를 읽는 파일이 11개이고, 그중 관리자 라우트 6개는 service
--   client 로 바꾸면 RLS 가 담당하던 관리자 검증이 사라져 오히려 위험해진다.
--   설계는 원래 옳았으므로 빠진 GRANT 만 채우는 것이 최소 수정이다.
--
-- 민감도 분리: anon 에게 전부 열지 않는다. site_settings/popup_settings/
--   lost_animal_flyers 는 비로그인 경로가 실제로 필요하지만(app/layout.tsx,
--   /api/site-settings, /api/popup-settings, /api/lost-animals GET 은 모두
--   인증 없는 공개 엔드포인트), tier_config·ocr_* 는 사업 설정이라 제외한다.

-- 1-a) 기존 "누구나 전부 읽기" 정책을 키 기준으로 좁힌다
DROP POLICY IF EXISTS "Anyone can read app_settings" ON public.app_settings;

-- 비로그인 포함 누구나 — 공개 브랜딩/공고 키만
CREATE POLICY "Public can read public app_settings"
  ON public.app_settings FOR SELECT
  USING (key IN ('site_settings', 'popup_settings', 'lost_animal_flyers'));

-- 로그인 사용자 — 전체 (lib/tier.ts 가 tier_config 를 읽어야 한다)
CREATE POLICY "Authenticated can read app_settings"
  ON public.app_settings FOR SELECT TO authenticated
  USING (true);

-- 1-b) 빠져 있던 GRANT. 쓰기는 "Admins can modify app_settings" 정책이 걸러낸다
--      (admin/super_admin 역할 보유자만 통과. 현재 보유자 1명)
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;

-- ===========================================================================
-- 2) sort_order_configs: 비로그인 쓰기 구멍 차단
-- ===========================================================================
-- "Allow all access" (cmd=ALL, roles=public, qual=true) 로 열려 있어 로그인 없이
-- 전역 정렬 설정 4행을 수정·삭제할 수 있었다. 개인정보는 없다(user_id 컬럼 없음).
--
-- 앱 영향 없음: 유일한 접근 지점 getSortOrderConfig()
-- (lib/ocr/item-matcher-v3.ts:681) 는 호출자가 0개다 — 정의만 있고 쓰이지 않는다.
-- 읽기를 authenticated 로 열어 두므로 나중에 쓰기 시작해도 동작한다.
--
-- 정책 형태는 이 DB 의 기존 마스터 테이블 패턴을 따른다
-- (item_aliases_master / standard_items_master: read for authenticated +
--  write for service role).
DROP POLICY IF EXISTS "Allow all access" ON public.sort_order_configs;

CREATE POLICY "Config read for authenticated"
  ON public.sort_order_configs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Config write for service role"
  ON public.sort_order_configs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.sort_order_configs FROM anon;

-- ===========================================================================
-- 3) items_by_exam_type: SECURITY DEFINER 뷰 (advisor ERROR)
-- ===========================================================================
-- 051 에서 고친 daily_stats 와 정확히 같은 유형이다. 뷰가 소유자 권한으로
-- 실행돼 기저 테이블 RLS 를 우회한다. 개인정보는 없다(검사항목 마스터 175행)
-- 지만 같은 계열을 남겨 둘 이유가 없어 함께 처리한다.
--
-- 앱 영향 없음: 코드 참조 0건(ts/tsx/js 전수 검색).
ALTER VIEW public.items_by_exam_type SET (security_invoker = on);

-- ===========================================================================
-- 남은 후속 (automation 쪽 확인 필요 — 이 마이그레이션 범위 밖)
-- ===========================================================================
--   shortform_capcut_templates  RLS 미활성 (4행)
--   shortform_capcut_generated  RLS 미활성 (0행)
--   graphic_styles              RLS 미활성 (2행)
-- 세 테이블 모두 premuto-automation 소유다. 잠그기 전에 automation 코드가
-- anon 키로 읽는지 확인해야 한다. 확인 없이 잠그면 automation 이 깨진다.
