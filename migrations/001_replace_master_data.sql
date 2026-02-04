-- =====================================================
-- Premuto 검사항목 마스터 데이터 전면 교체 마이그레이션
-- 생성일: 2026-02-04
-- 버전: v4
-- 항목 수: 120개 표준항목, 76개 별칭
-- =====================================================

-- =====================================================
-- 1단계: 기존 데이터 삭제 (의존성 순서대로)
-- =====================================================

-- test_results 삭제 (test_records에 CASCADE되어 있으므로 test_records도 함께 삭제됨)
TRUNCATE TABLE test_results CASCADE;

-- item_aliases_master 삭제
TRUNCATE TABLE item_aliases_master CASCADE;

-- standard_items_master 삭제
TRUNCATE TABLE standard_items_master CASCADE;

-- =====================================================
-- 2단계: 새 컬럼 추가 (없으면)
-- =====================================================

-- description_common 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'standard_items_master' AND column_name = 'description_common'
  ) THEN
    ALTER TABLE standard_items_master ADD COLUMN description_common TEXT;
  END IF;
END $$;

-- description_high 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'standard_items_master' AND column_name = 'description_high'
  ) THEN
    ALTER TABLE standard_items_master ADD COLUMN description_high TEXT;
  END IF;
END $$;

-- description_low 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'standard_items_master' AND column_name = 'description_low'
  ) THEN
    ALTER TABLE standard_items_master ADD COLUMN description_low TEXT;
  END IF;
END $$;

-- =====================================================
-- 3단계: standard_items_master INSERT (120개)
-- =====================================================

INSERT INTO standard_items_master (
  id, category, name, display_name_ko, default_unit,
  exam_type, organ_tags, description_common, description_high, description_low
) VALUES
(gen_random_uuid(), 'Vital', 'BT', '체온', '℃', 'Vital', '["기본신체"]'::jsonb, '체온으로 감염, 염증, 체온조절 이상을 평가합니다.', '발열 (감염, 염증, 열사병, 흥분)', '저체온 (쇼크, 마취 후, 신생아, 저혈당)'),
(gen_random_uuid(), 'Vital', 'BW', '체중', 'Kg', 'Vital', '["기본신체"]'::jsonb, '체중은 영양 상태, 질병 진행, 약물 용량 산정의 기준입니다.', '비만, 부종, 복수', '악액질, 탈수, 영양실조, 만성 질환'),
(gen_random_uuid(), 'Vital', 'Pulse', '맥박', '/min', 'Vital', '["기본신체","심장"]'::jsonb, '심박수로 심혈관 상태와 자율신경계 반응을 평가합니다.', '빈맥 (통증, 발열, 심부전, 빈혈, 쇼크)', '서맥 (고칼륨혈증, 갑상선기능저하증, 심장 전도 장애)'),
(gen_random_uuid(), 'Vital', 'Systolic BP', '수축기혈압', 'mmHg', 'Vital', '["기본신체","심장","신장"]'::jsonb, '심장이 수축할 때의 혈압입니다. 고혈압은 신장, 눈, 뇌, 심장에 손상을 줄 수 있습니다.', '고혈압 (신장질환, 쿠싱, 갑상선기능항진증, 갈색세포종)', '저혈압 (쇼크, 탈수, 심부전, 마취 중)'),
(gen_random_uuid(), 'CBC', '%BASO', '호염기구%', '%', 'CBC', '["혈액","면역"]'::jsonb, '백혈구 중 호염기구가 차지하는 비율입니다.', '알레르기, 과민반응', '임상적 의미 제한적'),
(gen_random_uuid(), 'CBC', '%EOS', '호산구%', '%', 'CBC', '["혈액","면역","알레르기"]'::jsonb, '백혈구 중 호산구가 차지하는 비율입니다.', '기생충, 알레르기, 과민반응', '스트레스, 스테로이드 반응'),
(gen_random_uuid(), 'CBC', '%LYM', '림프구%', '%', 'CBC', '["혈액","면역"]'::jsonb, '백혈구 중 림프구가 차지하는 비율입니다.', '만성 감염, 바이러스 감염, 림프종, 면역 자극', '급성 스트레스, 스테로이드 투여, 림프관 손실'),
(gen_random_uuid(), 'CBC', '%MONO', '단핵구%', '%', 'CBC', '["혈액","면역"]'::jsonb, '백혈구 중 단핵구가 차지하는 비율입니다.', '만성 염증, 감염 회복기', '임상적 의미 제한적'),
(gen_random_uuid(), 'CBC', '%NEU', '호중구%', '%', 'CBC', '["혈액","면역"]'::jsonb, '백혈구 중 호중구가 차지하는 비율입니다.', '세균 감염, 스트레스, 스테로이드 반응', '림프구 증가 (상대적), 호중구 감소증'),
(gen_random_uuid(), 'CBC', '%RETIC', '망상적혈구%', '%', 'CBC', '["혈액"]'::jsonb, '망상적혈구가 전체 적혈구에서 차지하는 비율입니다. 골수의 적혈구 생산 활성도를 반영합니다.', '재생성 빈혈 (출혈, 용혈), 빈혈 치료 반응', '비재생성 빈혈 (골수 억제, 만성 신부전, 철분 결핍)'),
(gen_random_uuid(), 'CBC', 'BASO', '호염기구', 'K/μL', 'CBC', '["혈액","면역"]'::jsonb, '히스타민을 함유한 희귀한 백혈구입니다. 알레르기 반응에 관여합니다.', '알레르기, 기생충 감염, 골수증식성 질환', '임상적 의미 제한적'),
(gen_random_uuid(), 'CBC', 'BAND', '띠호중구', 'K/μL', 'CBC', '["혈액","면역"]'::jsonb, '미성숙 호중구로 골수에서 조기 방출된 것입니다. 좌방이동(left shift)의 지표입니다.', '급성 세균 감염, 중증 염증, 패혈증, 조직 괴사', '임상적 의미 제한적'),
(gen_random_uuid(), 'CBC', 'CH', '세포혈색소함량', '-', 'CBC', '["혈액"]'::jsonb, '개별 적혈구의 혈색소 함량을 직접 측정한 값입니다.', '구상적혈구증, 적혈구 탈수', '철분 결핍, 지중해빈혈'),
(gen_random_uuid(), 'CBC', 'CHCM', '세포혈색소농도평균', 'g/dL', 'CBC', '["혈액"]'::jsonb, '적혈구 내 평균 혈색소 농도를 직접 측정한 값입니다.', '구상적혈구증, 탈수', '철분 결핍, 망상적혈구 증가'),
(gen_random_uuid(), 'CBC', 'CHr', '망상적혈구혈색소', 'pg', 'CBC', '["혈액"]'::jsonb, '망상적혈구의 혈색소 함량입니다. 최근 철분 공급 상태를 실시간으로 반영합니다.', '정상 철분 공급', '기능적 철분 결핍 (만성 질환, 에리스로포이에틴 치료 시)'),
(gen_random_uuid(), 'CBC', 'EOS', '호산구', 'K/μL', 'CBC', '["혈액","면역","알레르기"]'::jsonb, '기생충 감염과 알레르기 반응에 관여하는 세포입니다.', '기생충 감염, 알레르기, 호산구성 질환, 과민반응', '급성 스트레스, 스테로이드 투여'),
(gen_random_uuid(), 'CBC', 'HCT', '적혈구용적률', '%', 'CBC', '["혈액"]'::jsonb, '혈액 중 적혈구가 차지하는 부피 비율입니다. 빈혈과 탈수의 기본 지표입니다.', '탈수, 적혈구증가증, 비장 수축 (흥분)', '빈혈 (출혈, 용혈, 골수 억제), 과수화'),
(gen_random_uuid(), 'CBC', 'HDW', '혈색소분포폭', 'g/dL', 'CBC', '["혈액"]'::jsonb, '혈색소 농도의 분포폭입니다. 적혈구 집단의 혈색소 균일성을 반영합니다.', '철분 결핍, 혼합성 빈혈', '임상적 의미 제한적'),
(gen_random_uuid(), 'CBC', 'HGB', '혈색소', 'g/dL', 'CBC', '["혈액"]'::jsonb, '적혈구 내 산소 운반 단백질입니다. 빈혈 진단의 핵심 지표입니다.', '탈수, 적혈구증가증', '빈혈 (출혈, 용혈, 골수 억제, 만성 질환)'),
(gen_random_uuid(), 'CBC', 'LUC(#)', '대형미분류세포수', 'K/uL', 'CBC', '["혈액","면역"]'::jsonb, '자동혈구분석기에서 분류하지 못한 대형 세포의 절대수입니다.', '반응성 림프구, 비정형 세포, 아세포 (혈액 도말 확인 필요)', '임상적 의미 제한적'),
(gen_random_uuid(), 'CBC', 'LUC(%)', '대형미분류세포%', '%', 'CBC', '["혈액","면역"]'::jsonb, '자동혈구분석기에서 분류하지 못한 대형 세포의 비율입니다.', '반응성 림프구, 비정형 세포, 아세포', '임상적 의미 제한적'),
(gen_random_uuid(), 'CBC', 'LYM', '림프구', 'K/μL', 'CBC', '["혈액","면역"]'::jsonb, '면역 반응을 조절하는 세포입니다. 바이러스 감염과 면역 상태를 반영합니다.', '만성 감염, 바이러스 감염, 림프종, 면역 자극', '급성 스트레스, 스테로이드 투여, 림프관 손실'),
(gen_random_uuid(), 'CBC', 'MCH', '평균적혈구혈색소', 'pg', 'CBC', '["혈액"]'::jsonb, '적혈구 1개당 평균 헤모글로빈 양입니다.', '용혈, 지질혈증 (간섭)', '철분 결핍, 만성 출혈'),
(gen_random_uuid(), 'CBC', 'MCHC', '평균적혈구혈색소농도', 'g/dL', 'CBC', '["혈액"]'::jsonb, '적혈구 내 헤모글로빈 농도입니다.', '용혈, 지질혈증/용혈 (간섭), 구상적혈구증', '철분 결핍, 망상적혈구 증가'),
(gen_random_uuid(), 'CBC', 'MCV', '평균적혈구용적', 'fL', 'CBC', '["혈액"]'::jsonb, '적혈구 한 개의 평균 크기입니다. 빈혈의 원인 분류에 사용됩니다.', '대적혈구증 (재생성 빈혈, B12/엽산 결핍, FeLV)', '소적혈구증 (철분 결핍, 간문맥 단락, 아키타견종)'),
(gen_random_uuid(), 'CBC', 'MONO', '단핵구', 'K/μL', 'CBC', '["혈액","면역"]'::jsonb, '조직에서 대식세포로 분화하는 세포입니다. 만성 염증의 지표입니다.', '만성 염증, 감염 회복기, 스트레스, 스테로이드 반응', '임상적 의미 제한적'),
(gen_random_uuid(), 'CBC', 'MPV', '평균혈소판용적', 'fL', 'CBC', '["혈액","지혈"]'::jsonb, '혈소판 한 개의 평균 크기입니다. 혈소판 생산 상태를 반영합니다.', '혈소판 재생 활발 (면역매개 혈소판감소증 회복기)', '골수 억제'),
(gen_random_uuid(), 'CBC', 'NEU', '호중구', 'K/μL', 'CBC', '["혈액","면역"]'::jsonb, '세균 감염에 대한 일차 방어세포입니다. 가장 흔한 백혈구입니다.', '세균 감염, 스트레스, 스테로이드, 조직 괴사', '골수 억제, 심한 패혈증 (소모), 약물 반응, 파보바이러스'),
(gen_random_uuid(), 'CBC', 'PCT', '혈소판용적률', '%', 'CBC', '["혈액","지혈"]'::jsonb, '혈액 중 혈소판이 차지하는 부피 비율입니다.', '혈소판증가증', '혈소판감소증'),
(gen_random_uuid(), 'CBC', 'PDW', '혈소판분포폭', 'fL', 'CBC', '["혈액","지혈"]'::jsonb, '혈소판 크기의 변이 정도입니다.', '혈소판 재생 (크기 다양), 면역매개 혈소판감소증', '임상적 의미 제한적'),
(gen_random_uuid(), 'CBC', 'PLT', '혈소판', 'K/μL', 'CBC', '["혈액","지혈"]'::jsonb, '지혈에 필수적인 혈액세포입니다. 출혈 경향 평가에 사용됩니다.', '반응성 혈소판증가증, 철분 결핍, 비장절제 후', '면역매개 혈소판감소증, 골수억제, DIC, 감염'),
(gen_random_uuid(), 'CBC', 'RBC', '적혈구', '10x12/L', 'CBC', '["혈액"]'::jsonb, '산소를 운반하는 혈액세포입니다. HCT, HGB와 함께 빈혈 평가의 기본 지표입니다.', '탈수, 적혈구증가증, 비장 수축', '빈혈 (출혈, 용혈, 골수 억제)'),
(gen_random_uuid(), 'CBC', 'RDW', '적혈구분포폭', '%', 'CBC', '["혈액"]'::jsonb, '적혈구 크기의 변이 정도입니다. 빈혈의 원인 감별에 도움됩니다.', '혼합성 빈혈, 철분 결핍, 수혈 후, 재생성 빈혈', '임상적 의미 제한적'),
(gen_random_uuid(), 'CBC', 'RETIC', '망상적혈구', 'K/μL', 'CBC', '["혈액"]'::jsonb, '골수에서 새로 만들어진 미성숙 적혈구입니다. 골수 재생 반응의 직접 지표입니다.', '재생성 빈혈 (출혈, 용혈), 빈혈 치료 반응', '비재생성 빈혈 (골수 억제, 만성 신부전)'),
(gen_random_uuid(), 'CBC', 'RETIC-HGB', '망상적혈구혈색소', 'pg', 'CBC', '["혈액"]'::jsonb, '망상적혈구의 혈색소 함량입니다. CHr와 유사한 지표로 철분 상태를 반영합니다.', '정상 철분 공급', '기능적 철분 결핍'),
(gen_random_uuid(), 'CBC', 'WBC', '백혈구', '10x9/L', 'CBC', '["혈액","면역"]'::jsonb, '감염과 염증에 대항하는 면역세포입니다. 전체 면역 상태를 평가하는 기본 지표입니다.', '감염, 염증, 스트레스, 백혈병, 스테로이드 투여', '골수억제, 바이러스 감염, 면역억제, 패혈증'),
(gen_random_uuid(), 'Chemistry', 'A/G ratio', '알부민글로불린비', '-', 'Chemistry', '["간","면역"]'::jsonb, '알부민과 글로불린의 비율입니다. 간 기능과 면역 상태를 종합적으로 평가합니다.', '탈수 (알부민 상대적 증가)', '저알부민혈증, 고글로불린혈증 (만성 염증, 면역매개질환)'),
(gen_random_uuid(), 'Chemistry', 'ALKP', '알칼리성인산분해효소', 'U/L', 'Chemistry', '["간","뼈","담도"]'::jsonb, '담관과 뼈에서 분비되는 효소입니다. 담즙 정체와 스테로이드 반응을 평가합니다.', '담즙 정체, 스테로이드 유도 (개), 뼈 질환, 성장기', '임상적 의미 크게 없음'),
(gen_random_uuid(), 'Chemistry', 'ALT', '알라닌아미노전이효소', 'U/L', 'Chemistry', '["간"]'::jsonb, '간세포에 특이적인 효소입니다. 간세포 손상의 민감한 지표입니다.', '간세포 손상/괴사, 간염, 간독성, 저산소증', '임상적 의미 제한적'),
(gen_random_uuid(), 'Chemistry', 'AST', '아스파르테이트아미노전이효소', 'U/L', 'Chemistry', '["간","근육"]'::jsonb, '간과 근육에 존재하는 효소입니다. 간/근육 손상을 반영합니다.', '간세포 손상, 근육 손상, 용혈', '임상적 의미 제한적'),
(gen_random_uuid(), 'Chemistry', 'Albumin', '알부민', 'g/dL', 'Chemistry', '["간","신장","영양"]'::jsonb, '간에서 합성되는 주요 혈장 단백질입니다. 간 기능, 영양, 단백 소실을 평가합니다.', '탈수', '간부전, 단백소실장병증, 단백소실신병증, 영양실조, 복수'),
(gen_random_uuid(), 'Chemistry', 'Amylase', '아밀라아제', 'U/L', 'Chemistry', '["췌장"]'::jsonb, '전분 분해 효소입니다. 개에서 췌장염 평가에 보조적으로 사용됩니다.', '췌장염, 신부전 (배설 감소), 위장관 질환', '임상적 의미 제한적'),
(gen_random_uuid(), 'Chemistry', 'BUN', '혈액요소질소', 'mg/dL', 'Chemistry', '["신장"]'::jsonb, '단백질 대사 산물로 신장에서 배설됩니다. 신장 기능과 탈수 평가에 사용됩니다.', '신장질환, 탈수, 위장관 출혈, 고단백 식이, 요로 폐색', '간부전, 저단백 식이, 다뇨'),
(gen_random_uuid(), 'Chemistry', 'BUN:Cr Ratio', 'BUN크레아티닌비', '-', 'Chemistry', '["신장"]'::jsonb, 'BUN과 크레아티닌의 비율입니다. 신전성/신성/신후성 질소혈증 감별에 도움됩니다.', '신전성 질소혈증 (탈수, 심부전), 위장관 출혈, 고단백 식이', '간부전, 저단백 식이'),
(gen_random_uuid(), 'Chemistry', 'CK', '크레아틴키나아제', 'U/L', 'Chemistry', '["심장","근육"]'::jsonb, '근육 손상의 특이적 지표입니다. 골격근과 심근에 많이 존재합니다.', '근육 손상 (외상, 경련, 주사 후), 횡문근융해증, 심근 손상', '임상적 의미 제한적'),
(gen_random_uuid(), 'Chemistry', 'Calcium', '칼슘', 'mg/dL', 'Chemistry', '["전해질","내분비","뼈"]'::jsonb, '뼈, 근육, 신경 기능에 필수적인 미네랄입니다. 내분비와 종양 질환 평가에 사용됩니다.', '종양 (림프종, 항문낭선암), 부갑상선기능항진증, 비타민D 중독', '저알부민혈증, 부갑상선기능저하증, 신부전, 급성 췌장염, 에틸렌글리콜 중독'),
(gen_random_uuid(), 'Chemistry', 'Cl', '염소', 'mmol/L', 'Chemistry', '["전해질"]'::jsonb, '세포외액의 주요 음이온입니다. 산-염기 균형과 수분 균형에 관여합니다.', '탈수, 대사성 산증 (정상 음이온차), 신세뇨관 산증', '구토 (위산 소실), 대사성 알칼리증, 이뇨제'),
(gen_random_uuid(), 'Chemistry', 'Creatinine', '크레아티닌', 'mg/dL', 'Chemistry', '["신장"]'::jsonb, '근육 대사 산물로 신장에서만 배설됩니다. 신장 사구체 여과율의 지표입니다.', '신장질환 (급성/만성), 탈수, 요로 폐색, 근육량 많은 품종', '근육량 감소 (악액질), 다뇨'),
(gen_random_uuid(), 'Chemistry', 'GGT', '감마글루타밀전이효소', 'U/L', 'Chemistry', '["간","담도"]'::jsonb, '담관에서 분비되는 효소입니다. 담즙 정체의 민감한 지표입니다.', '담즙 정체, 담관 질환, 췌장염, 스테로이드 유도', '임상적 의미 제한적'),
(gen_random_uuid(), 'Chemistry', 'GOT/GPT', 'GOT/GPT비', '%', 'Chemistry', '["간"]'::jsonb, 'AST(GOT)와 ALT(GPT)의 비율입니다. 간 손상의 원인 감별에 보조적으로 사용됩니다.', '근육 손상 동반 (AST 우세)', '순수 간세포 손상 (ALT 우세)'),
(gen_random_uuid(), 'Chemistry', 'Globulin', '글로불린', 'g/dL', 'Chemistry', '["간","면역"]'::jsonb, '면역글로불린을 포함한 단백질입니다. 염증과 면역 상태를 반영합니다.', '만성 염증, 감염, 면역매개질환, 종양', '면역결핍, 신생아'),
(gen_random_uuid(), 'Chemistry', 'Glucose', '혈당', 'mg/dL', 'Chemistry', '["췌장","내분비","대사"]'::jsonb, '혈당 수치로 에너지 대사 상태를 반영합니다.', '당뇨병, 스트레스 (고양이), 스테로이드 투여, 췌장염', '인슐린 과다, 패혈증, 간부전, 부신기능저하증'),
(gen_random_uuid(), 'Chemistry', 'K', '칼륨', 'mmol/L', 'Chemistry', '["전해질"]'::jsonb, '세포 내 주요 양이온으로 심장 기능과 근육 수축에 필수적입니다.', '신부전, 요로 폐색, 부신기능저하증, 산증, 조직 손상', '구토, 설사, 이뇨제, 알칼리증, 식욕부진'),
(gen_random_uuid(), 'Chemistry', 'LDH', '젖산탈수소효소', 'U/L', 'Chemistry', '["심장","간","근육"]'::jsonb, '다양한 조직에 존재하는 효소입니다. 비특이적이지만 조직 손상의 보조 지표입니다.', '용혈, 간 손상, 근육 손상, 종양, 조직 괴사', '임상적 의미 제한적'),
(gen_random_uuid(), 'Chemistry', 'Lactate', '젖산', 'mmol/L', 'Chemistry', '["산염기","대사"]'::jsonb, '혐기성 대사의 산물입니다. 조직 관류 저하와 산소 부족의 중요한 지표입니다.', '조직 저관류 (쇼크, 패혈증), 심한 운동, 경련, 종양', '임상적 의미 제한적'),
(gen_random_uuid(), 'Chemistry', 'Lipase', '리파아제', 'U/L', 'Chemistry', '["췌장"]'::jsonb, '지방 분해 효소입니다. 췌장염 진단에 사용됩니다.', '췌장염, 신부전 (배설 감소), 위장관 질환', '임상적 의미 제한적'),
(gen_random_uuid(), 'Chemistry', 'Mg', '마그네슘', 'mg/dL', 'Chemistry', '["전해질","근육","심장"]'::jsonb, '효소 반응, 근육 수축, 신경 전달에 필수적인 미네랄입니다.', '신부전, 의인성 (Mg 함유 제산제/관장제)', '식욕부진, 구토/설사, 이뇨제, 당뇨병성 케톤산증, 재급식증후군'),
(gen_random_uuid(), 'Chemistry', 'NA/K', '나트륨칼륨비', '-', 'Chemistry', '["전해질","내분비"]'::jsonb, '나트륨과 칼륨의 비율입니다. 부신기능 평가에 중요합니다.', '임상적 의미 제한적', '부신기능저하증 (애디슨병) — 비율 27 미만 시 강력 의심'),
(gen_random_uuid(), 'Chemistry', 'NH3', '암모니아', 'ug/dL', 'Chemistry', '["간"]'::jsonb, '단백질 대사 산물로 간에서 요소로 전환됩니다. 간 기능 평가의 중요한 지표입니다.', '간부전, 간문맥 단락, 간성 뇌증, 요소 회로 효소 결핍', '임상적 의미 제한적'),
(gen_random_uuid(), 'Chemistry', 'Na', '나트륨', 'mmol/L', 'Chemistry', '["전해질"]'::jsonb, '세포외액의 주요 양이온으로 수분 균형과 삼투압 조절에 핵심적입니다.', '탈수, 중추성 요붕증, 고장성 수액 투여', '구토/설사, 부신기능저하증, 과수화, 심한 다뇨'),
(gen_random_uuid(), 'Chemistry', 'Phosphorus', '인', 'mg/dL', 'Chemistry', '["신장","뼈","내분비"]'::jsonb, '뼈와 에너지 대사에 관여하는 미네랄입니다. 신장질환 모니터링에 중요합니다.', '신부전, 부갑상선기능저하증, 비타민D 중독, 종양 용해 증후군', '부갑상선기능항진증, 인슐린 투여, 재급식증후군'),
(gen_random_uuid(), 'Chemistry', 'Protein-Total', '총단백', 'g/dL', 'Chemistry', '["간","신장","영양"]'::jsonb, '혈액 내 총 단백질 양입니다. 영양상태와 면역기능을 반영합니다.', '탈수, 만성 염증, 다발성 골수종', '단백 소실 (신장/장), 간부전, 출혈, 영양실조'),
(gen_random_uuid(), 'Chemistry', 'T.Bilirubin', '총빌리루빈', 'mg/dL', 'Chemistry', '["간","담도","혈액"]'::jsonb, '빌리루빈은 적혈구 파괴 산물로 간에서 처리됩니다. 용혈, 간질환, 담즙 정체를 평가합니다.', '용혈, 간세포 손상, 담즙 정체, 담관 폐색', '임상적 의미 제한적'),
(gen_random_uuid(), 'Chemistry', 'T.Cholesterol', '총콜레스테롤', 'mg/dL', 'Chemistry', '["대사"]'::jsonb, '혈중 총 콜레스테롤입니다. 지질 대사와 내분비 질환을 평가합니다.', '갑상선기능저하증, 당뇨병, 쿠싱증후군, 담즙 정체', '간부전, 흡수 장애, 단백소실장병증'),
(gen_random_uuid(), 'Chemistry', 'Triglycerides', '중성지방', 'mg/dL', 'Chemistry', '["췌장","대사"]'::jsonb, '혈중 중성지방입니다. 지질 대사 장애를 평가합니다.', '식후, 갑상선기능저하증, 당뇨병, 쿠싱증후군, 췌장염', '영양실조, 흡수 장애'),
(gen_random_uuid(), 'Chemistry', 'mOsm', '삼투압', 'mmol/kg', 'Chemistry', '["신장"]'::jsonb, '혈액의 삼투압으로 수분 균형과 전해질 상태를 종합적으로 반영합니다.', '고나트륨혈증, 탈수, 고혈당, 요독증', '저나트륨혈증, 과수화'),
(gen_random_uuid(), 'Special', 'CRP', 'C반응성단백', 'mg/L', 'Special', '["염증"]'::jsonb, 'C반응성단백으로 급성 염증의 민감한 지표입니다.', '급성 염증, 감염, 조직 손상, 수술 후', '임상적 의미 제한적'),
(gen_random_uuid(), 'Special', 'SDMA', '대칭디메틸아르기닌', 'ug/dL', 'Special', '["신장"]'::jsonb, '신장에서 배설되는 아미노산 유도체입니다. 조기 신장질환 발견에 유용합니다.', '신장 기능 저하 (GFR 40% 감소 시 상승)', '임상적 의미 제한적'),
(gen_random_uuid(), 'Special', 'cPL', '개특이리파아제', 'ng/ml', 'Special', '["췌장"]'::jsonb, '개 특이 췌장 리파아제입니다. 개 췌장염 진단의 가장 특이적인 지표입니다.', '췌장염 (급성/만성)', '임상적 의미 없음'),
(gen_random_uuid(), 'Special', 'proBNP', '뇌나트륨이뇨펩타이드', 'pmol/L', 'Special', '["심장"]'::jsonb, '심장 근육 스트레스 시 분비되는 호르몬 전구체입니다. 심장질환 선별 검사에 사용됩니다.', '심근 신장/비대, 심부전, 폐고혈압', '임상적 의미 제한적'),
(gen_random_uuid(), 'Special', '심장사상충', '심장사상충항원', '-', 'Special', '["심장","감염"]'::jsonb, '심장사상충(Dirofilaria immitis) 성충 항원을 검출합니다.', '양성 (심장사상충 감염)', '음성 (미감염 또는 잠복기)'),
(gen_random_uuid(), 'Blood Gas', 'Anion', '음이온', 'mmol', 'Blood Gas', '["산염기"]'::jsonb, '음이온 수치입니다.', '대사성 이상', '임상적 의미 제한적'),
(gen_random_uuid(), 'Blood Gas', 'Anion Gap', '음이온차', '-', 'Blood Gas', '["산염기"]'::jsonb, '측정되지 않는 음이온의 양입니다. 대사성 산증의 원인 감별에 사용됩니다.', '젖산 산증, 케톤산증, 신부전, 중독 (에틸렌글리콜 등)', '저알부민혈증, 검사 오류'),
(gen_random_uuid(), 'Blood Gas', 'BE', '염기과잉', 'mmol', 'Blood Gas', '["산염기"]'::jsonb, '염기과잉으로 대사성 산-염기 상태를 수치화합니다.', '대사성 알칼리증', '대사성 산증'),
(gen_random_uuid(), 'Blood Gas', 'cBASE(B)', '혈액염기과잉', 'mmol', 'Blood Gas', '["산염기"]'::jsonb, '혈액의 염기과잉입니다.', '대사성 알칼리증', '대사성 산증'),
(gen_random_uuid(), 'Blood Gas', 'cBASE(B,ox)', '혈액염기과잉(산소보정)', 'mmol', 'Blood Gas', '["산염기"]'::jsonb, '산소화 보정된 혈액 염기과잉입니다.', '대사성 알칼리증', '대사성 산증'),
(gen_random_uuid(), 'Blood Gas', 'cBASE(Ecf)', '세포외액염기과잉', 'mmol', 'Blood Gas', '["산염기"]'::jsonb, '세포외액의 염기과잉입니다. 대사성 산-염기 상태의 임상적으로 가장 유용한 지표입니다.', '대사성 알칼리증', '대사성 산증'),
(gen_random_uuid(), 'Blood Gas', 'cBASE(Ecf,ox)', '세포외액염기과잉(산소보정)', 'mmol', 'Blood Gas', '["산염기"]'::jsonb, '산소화 보정된 세포외액 염기과잉입니다.', '대사성 알칼리증', '대사성 산증'),
(gen_random_uuid(), 'Blood Gas', 'cHCO3', '중탄산염', 'mmol', 'Blood Gas', '["산염기"]'::jsonb, '혈액의 주요 완충 물질입니다. 대사성 산-염기 장애 평가의 핵심 지표입니다.', '대사성 알칼리증, 호흡성 산증 보상', '대사성 산증, 호흡성 알칼리증 보상'),
(gen_random_uuid(), 'Blood Gas', 'cHCO3(P,st)', '표준중탄산염', 'mmol', 'Blood Gas', '["산염기"]'::jsonb, '표준 조건(pCO2 40mmHg)에서의 중탄산염입니다. 순수 대사성 변화를 반영합니다.', '대사성 알칼리증', '대사성 산증'),
(gen_random_uuid(), 'Blood Gas', 'ctCO2(B)', '혈액총이산화탄소', 'mmol', 'Blood Gas', '["산염기"]'::jsonb, '혈액 내 총 이산화탄소입니다.', '대사성 알칼리증, 호흡성 산증', '대사성 산증, 호흡성 알칼리증'),
(gen_random_uuid(), 'Blood Gas', 'ctCO2(P)', '혈장총이산화탄소', 'mmol', 'Blood Gas', '["산염기"]'::jsonb, '혈장 내 총 이산화탄소입니다.', '대사성 알칼리증, 호흡성 산증', '대사성 산증, 호흡성 알칼리증'),
(gen_random_uuid(), 'Blood Gas', 'ctO2', '총산소함량', 'Vol%', 'Blood Gas', '["호흡"]'::jsonb, '혈액 내 총 산소 함량입니다. 산소 운반 능력을 반영합니다.', '산소 투여, 적혈구증가증', '빈혈, 저산소증'),
(gen_random_uuid(), 'Blood Gas', 'p50(act)', '산소반포화압', '-', 'Blood Gas', '["호흡"]'::jsonb, '산소해리곡선에서 50% 포화 시 산소분압입니다. 산소 친화도를 반영합니다.', '산소 친화도 감소 (조직에 산소 방출 증가)', '산소 친화도 증가 (조직에 산소 방출 감소)'),
(gen_random_uuid(), 'Blood Gas', 'pCO2', '이산화탄소분압', 'mmHg', 'Blood Gas', '["산염기","호흡"]'::jsonb, '혈액 내 이산화탄소 분압입니다. 환기 상태와 호흡성 산-염기 장애를 평가합니다.', '환기 저하 (호흡성 산증), 기도 폐색, 신경근육 질환', '과환기 (호흡성 알칼리증), 통증, 불안, 대사성 산증 보상'),
(gen_random_uuid(), 'Blood Gas', 'pCO2(T)', '이산화탄소분압(체온보정)', 'mmHg', 'Blood Gas', '["산염기","호흡"]'::jsonb, '체온 보정된 이산화탄소 분압입니다.', '환기 저하, 호흡성 산증', '과환기, 호흡성 알칼리증'),
(gen_random_uuid(), 'Blood Gas', 'pH', '수소이온농도', '-', 'Blood Gas', '["산염기"]'::jsonb, '혈액의 산도를 나타냅니다. 산-염기 균형 평가의 기본 지표입니다.', '알칼리증 (호흡성/대사성)', '산증 (호흡성/대사성)'),
(gen_random_uuid(), 'Blood Gas', 'pH(T)', '수소이온농도(체온보정)', '-', 'Blood Gas', '["산염기"]'::jsonb, '체온 보정된 혈액 산도입니다.', '알칼리증', '산증'),
(gen_random_uuid(), 'Blood Gas', 'pO2', '산소분압', 'mmHg', 'Blood Gas', '["호흡"]'::jsonb, '혈액 내 산소 분압입니다. 폐의 산소화 능력을 직접 반영합니다.', '산소 투여', '저산소증 (폐질환, 환기-관류 불일치, 우-좌 단락)'),
(gen_random_uuid(), 'Blood Gas', 'pO2(T)', '산소분압(체온보정)', 'mmHg', 'Blood Gas', '["호흡"]'::jsonb, '체온 보정된 산소분압입니다.', '산소 투여', '저산소증'),
(gen_random_uuid(), 'Blood Gas', 'sO2', '산소포화도', '%', 'Blood Gas', '["호흡"]'::jsonb, '헤모글로빈의 산소 포화도입니다. 조직으로의 산소 전달을 반영합니다.', '산소 투여', '저산소증, 빈혈, 일산화탄소 중독'),
(gen_random_uuid(), 'Blood Gas', 'pO2(a/A,T)', '동맥/폐포산소분압비(체온보정)', '%', 'Blood Gas', '["호흡"]'::jsonb, '체온 보정된 동맥/폐포 산소분압비입니다. 폐의 가스교환 효율을 평가합니다.', '양호한 산소화', '가스교환 장애 (폐질환, ARDS)'),
(gen_random_uuid(), 'Blood Gas', 'RI', '호흡지수', '-', 'Blood Gas', '["호흡"]'::jsonb, '호흡지수로 폐의 산소화 능력을 종합 평가합니다.', '폐질환, ARDS, 폐렴', '정상 폐기능'),
(gen_random_uuid(), 'Blood Gas', 'RI(T)', '호흡지수(체온보정)', '-', 'Blood Gas', '["호흡"]'::jsonb, '체온 보정된 호흡지수입니다.', '폐질환', '정상'),
(gen_random_uuid(), 'Blood Gas', 'PO2(A)', '폐포산소분압', 'mmHg', 'Blood Gas', '["호흡"]'::jsonb, 'ABL80F에서 계산된 폐포 산소분압(PAO2)입니다.', '높은 FiO2 (산소 투여)', '고지대, 저환기'),
(gen_random_uuid(), 'Blood Gas', 'PO2(A,T)', '폐포산소분압(체온보정)', 'mmHg', 'Blood Gas', '["호흡"]'::jsonb, '체온 보정된 폐포 산소분압입니다.', '높은 FiO2', '고지대, 저환기'),
(gen_random_uuid(), 'Blood Gas', 'PO2(A-A)', 'A-a gradient', 'mmHg', 'Blood Gas', '["호흡"]'::jsonb, '폐포-동맥 산소분압차입니다. 폐의 가스교환 효율을 직접 평가하는 핵심 지표입니다.', '폐질환 (폐렴, ARDS, 폐부종, 폐혈전색전증), V/Q 불일치', '정상 가스교환'),
(gen_random_uuid(), 'Blood Gas', 'PO2(A-A,T)', 'A-a gradient(체온보정)', 'mmHg', 'Blood Gas', '["호흡"]'::jsonb, '체온 보정된 폐포-동맥 산소분압차입니다.', '폐질환', '정상'),
(gen_random_uuid(), 'Blood Gas', 'PO2(A/A)', '동맥/폐포산소분압비', '%', 'Blood Gas', '["호흡"]'::jsonb, '동맥/폐포 산소분압비입니다. FiO2에 영향을 덜 받아 산소 투여 중에도 유용합니다.', '양호한 산소화', '가스교환 장애'),
(gen_random_uuid(), 'Coagulation', 'APTT', '활성화부분트롬보플라스틴시간', 'sec', 'Coagulation', '["지혈"]'::jsonb, '활성화 부분 트롬보플라스틴 시간으로 내인성 응고경로를 평가합니다.', '혈우병, 헤파린 투여, DIC, 간부전', '임상적 의미 제한적'),
(gen_random_uuid(), 'Coagulation', 'D-dimer', '디다이머', 'mg/L', 'Coagulation', '["지혈"]'::jsonb, '피브린 분해 산물입니다. 혈전 형성과 용해의 지표입니다.', 'DIC, 폐혈전색전증, 혈전증, 수술 후, 종양', '임상적 의미 제한적'),
(gen_random_uuid(), 'Coagulation', 'Fibrinogen', '피브리노겐', 'mg/dL', 'Coagulation', '["지혈"]'::jsonb, '피브리노겐으로 응고 최종단계와 급성기 반응을 반영합니다.', '급성 염증, 임신', '간부전, DIC, 대량 수혈'),
(gen_random_uuid(), 'Coagulation', 'PT', '프로트롬빈시간', 'sec', 'Coagulation', '["지혈"]'::jsonb, '외인성 응고경로를 평가합니다. 간 기능과 응고인자를 반영합니다.', '간부전, DIC, 항응고제 중독 (와파린/쥐약), 비타민K 결핍', '임상적 의미 제한적'),
(gen_random_uuid(), 'Coagulation', 'TEG_Angle', 'TEG각도', 'deg', 'Coagulation', '["지혈"]'::jsonb, '트롬보엘라스토그래피에서 피브린 형성 속도를 나타내는 각도입니다.', '과응고 (혈전 경향)', '저응고 (피브리노겐 결핍)'),
(gen_random_uuid(), 'Coagulation', 'TEG_K', 'TEG응고시간', 'min', 'Coagulation', '["지혈"]'::jsonb, '트롬보엘라스토그래피에서 응고 형성 속도를 나타냅니다.', '저응고 (피브리노겐 결핍, 혈소판 감소)', '과응고 (혈전 경향)'),
(gen_random_uuid(), 'Coagulation', 'TEG_MA', 'TEG최대진폭', 'mm', 'Coagulation', '["지혈"]'::jsonb, '트롬보엘라스토그래피에서 응고 강도의 최대치입니다. 혈소판과 피브리노겐 기능을 반영합니다.', '과응고 (혈전 경향, 혈소판 과반응)', '저응고 (혈소판감소증, 피브리노겐 결핍, DIC)'),
(gen_random_uuid(), 'Coagulation', 'TEG_R', 'TEG반응시간', 'min', 'Coagulation', '["지혈"]'::jsonb, '트롬보엘라스토그래피에서 응고 개시까지의 반응시간입니다.', '저응고 (응고인자 결핍, 헤파린)', '과응고 (혈전 경향)'),
(gen_random_uuid(), '뇨검사', 'PH(뇨)', '뇨pH', '-', '뇨검사', '["신장"]'::jsonb, '소변의 산도입니다. 식이, 산-염기 상태, 감염을 반영합니다.', '알칼리뇨 (세균 감염/우레아분해균, 식후, 식이)', '산성뇨 (육식, 대사성 산증, 단백뇨)'),
(gen_random_uuid(), '뇨검사', 'UPC', '뇨단백크레아티닌비', '-', '뇨검사', '["신장"]'::jsonb, '소변 내 단백질과 크레아티닌의 비율입니다. 사구체 및 세뇨관 손상을 평가합니다.', '사구체신염, 단백소실신병증, 신장질환 진행', '임상적 의미 제한적'),
(gen_random_uuid(), '뇨검사', '요비중', '요비중', '-', '뇨검사', '["신장"]'::jsonb, '소변의 농축 정도를 나타냅니다. 신장의 농축 능력을 평가합니다.', '탈수 (정상 반응)', '만성 신부전, 요붕증, 부신기능저하증, 과수화'),
(gen_random_uuid(), '뇨검사', 'COLOR(뇨)', '뇨색상', '-', '뇨검사', '["신장"]'::jsonb, '소변의 색상입니다. 농축도, 혈뇨, 빌리루빈뇨 등을 시각적으로 평가합니다.', '짙은 황색 (농축), 적색/갈색 (혈뇨, 혈색소뇨), 황록색 (빌리루빈뇨)', '무색/옅은 색 (희석뇨, 다뇨)'),
(gen_random_uuid(), '뇨검사', 'BLOOD(뇨)', '뇨잠혈', '-', '뇨검사', '["신장"]'::jsonb, '소변 내 적혈구, 혈색소, 미오글로빈을 검출합니다.', '혈뇨 (방광염, 결석, 종양), 혈색소뇨 (용혈), 미오글로빈뇨 (근육 손상)', '음성 (정상)'),
(gen_random_uuid(), '뇨검사', 'KETONE(뇨)', '뇨케톤', '-', '뇨검사', '["대사"]'::jsonb, '소변 내 케톤체를 검출합니다. 지방 대사 이상의 지표입니다.', '당뇨병성 케톤산증, 기아, 저탄수화물 식이', '음성 (정상)'),
(gen_random_uuid(), '뇨검사', 'NITRATE(뇨)', '뇨아질산염', '-', '뇨검사', '["신장","감염"]'::jsonb, '세균에 의해 질산염이 아질산염으로 환원된 것을 검출합니다.', '세균성 요로감염 (그람음성균)', '음성 (정상, 또는 비환원성 세균 감염)'),
(gen_random_uuid(), '안과검사', '눈물량(OD)', '눈물량(우)', 'mm', '안과검사', '["안과"]'::jsonb, '우안의 눈물 분비량 (Schirmer Tear Test)입니다.', '임상적 의미 제한적 (정상 범위 이상)', '건성각결막염 (KCS), 안면신경 마비, 약물 부작용'),
(gen_random_uuid(), '안과검사', '눈물량(OS)', '눈물량(좌)', 'mm', '안과검사', '["안과"]'::jsonb, '좌안의 눈물 분비량 (Schirmer Tear Test)입니다.', '임상적 의미 제한적', '건성각결막염 (KCS), 안면신경 마비, 약물 부작용'),
(gen_random_uuid(), '안과검사', '안압(OD)', '안압(우)', 'mmHg', '안과검사', '["안과"]'::jsonb, '우안의 안압 (Intraocular Pressure)입니다.', '녹내장, 포도막염 후 이차 녹내장, 수정체 탈구', '포도막염, 안구 위축'),
(gen_random_uuid(), '안과검사', '안압(OS)', '안압(좌)', 'mmHg', '안과검사', '["안과"]'::jsonb, '좌안의 안압입니다.', '녹내장, 포도막염 후 이차 녹내장, 수정체 탈구', '포도막염, 안구 위축'),
(gen_random_uuid(), 'Echo', 'E', 'E파속도', 'm/s', 'Echo', '["심장"]'::jsonb, '심초음파에서 승모판 유입 초기 혈류 속도입니다. 이완기 기능 평가에 사용됩니다.', '용적 과부하, 승모판 폐쇄부전, 제한성 충만', '이완기 기능 장애, 탈수'),
(gen_random_uuid(), 'Echo', 'LVIDd', '좌심실이완기내경', 'cm', 'Echo', '["심장"]'::jsonb, '좌심실의 이완기 내경입니다. 심비대와 확장성 심근병증 평가에 사용됩니다.', '확장성 심근병증, 승모판 폐쇄부전, 용적 과부하', '저혈량증, 탈수');

-- =====================================================
-- 4단계: item_aliases_master INSERT (76개)
-- canonical_name으로 standard_item_id 조회하여 연결
-- =====================================================

INSERT INTO item_aliases_master (
  id, alias, canonical_name, source_hint, standard_item_id, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  v.alias,
  v.canonical_name,
  NULLIF(v.source_hint, ''),
  s.id,
  NOW(),
  NOW()
FROM (VALUES
  ('ALP(ALKP)', 'ALKP', 'IDEXX'),
  ('ALP', 'ALKP', ''),
  ('tBil', 'T.Bilirubin', ''),
  ('TBIL', 'T.Bilirubin', ''),
  ('Total Bilirubin', 'T.Bilirubin', ''),
  ('Hct(ABL80F)', 'HCT', 'ABL80F'),
  ('Hct', 'HCT', ''),
  ('HGB(Gas)', 'HGB', 'Blood Gas'),
  ('ctHb', 'HGB', 'ABL80F'),
  ('Hb', 'HGB', ''),
  ('Hemoglobin', 'HGB', ''),
  ('Cl-', 'Cl', 'Chemistry'),
  ('Cl(ABL80F)', 'Cl', 'ABL80F'),
  ('Chloride', 'Cl', ''),
  ('K+', 'K', 'Chemistry'),
  ('K+(ABL80F)', 'K', 'ABL80F'),
  ('Potassium', 'K', ''),
  ('Na+', 'Na', 'Chemistry'),
  ('Na+(ABL80F)', 'Na', 'ABL80F'),
  ('Sodium', 'Na', ''),
  ('Ca++(ABL80F)', 'Calcium', 'ABL80F'),
  ('cCa++(7.40)', 'Calcium', 'ABL80F pH보정'),
  ('Ca', 'Calcium', ''),
  ('Ca++', 'Calcium', ''),
  ('Lipase(vLIP)', 'Lipase', 'IDEXX Spec'),
  ('vLIP', 'Lipase', 'IDEXX Spec'),
  ('NH3(Ammonia)', 'NH3', ''),
  ('Ammonia', 'NH3', ''),
  ('MG', 'Mg', ''),
  ('Magnesium', 'Mg', ''),
  ('BT(체온)', 'BT', ''),
  ('Body Temperature', 'BT', ''),
  ('BW(체중)', 'BW', ''),
  ('Body Weight', 'BW', ''),
  ('Pulse(맥박)', 'Pulse', ''),
  ('Heart Rate', 'Pulse', ''),
  ('HR', 'Pulse', ''),
  ('SBP', 'Systolic BP', ''),
  ('TP', 'Protein-Total', ''),
  ('Total Protein', 'Protein-Total', ''),
  ('Alb', 'Albumin', ''),
  ('Glob', 'Globulin', ''),
  ('Cre', 'Creatinine', ''),
  ('CREA', 'Creatinine', ''),
  ('GLU', 'Glucose', ''),
  ('TCHO', 'T.Cholesterol', ''),
  ('TG', 'Triglycerides', ''),
  ('PHOS', 'Phosphorus', ''),
  ('IP', 'Phosphorus', ''),
  ('Spec cPL', 'cPL', 'IDEXX'),
  ('NT-proBNP', 'proBNP', ''),
  ('CardiopetProBNP', 'proBNP', 'IDEXX'),
  ('HW Ag', '심장사상충', ''),
  ('STT(OD)', '눈물량(OD)', ''),
  ('STT(OS)', '눈물량(OS)', ''),
  ('IOP(OD)', '안압(OD)', ''),
  ('IOP(OS)', '안압(OS)', ''),
  ('USG', '요비중', ''),
  ('SG', '요비중', ''),
  ('Urine pH', 'PH(뇨)', ''),
  ('COLOR', 'COLOR(뇨)', ''),
  ('BLOOD', 'BLOOD(뇨)', ''),
  ('KETONE', 'KETONE(뇨)', ''),
  ('NITRATE', 'NITRATE(뇨)', ''),
  ('Retic', 'RETIC', ''),
  ('Reticulocyte', 'RETIC', ''),
  ('Band Neutrophil', 'BAND', ''),
  ('PO2(A)(ABL80F)', 'PO2(A)', 'ABL80F'),
  ('PO2(A,T)(ABL80F)', 'PO2(A,T)', 'ABL80F'),
  ('PO2(A-A)(ABL80F)', 'PO2(A-A)', 'ABL80F'),
  ('PO2(A-A,T)(ABL80F)', 'PO2(A-A,T)', 'ABL80F'),
  ('PO2(A/A)(ABL80F)', 'PO2(A/A)', 'ABL80F'),
  ('PO2(A/A,T)(ABL80F)', 'pO2(a/A,T)', 'ABL80F'),
  ('PO2(A,A,T)(ABL80F)', 'pO2(a/A,T)', 'ABL80F OCR오류'),
  ('CBASE(B,ST)(ABL80F)', 'cBASE(B)', 'ABL80F standard temp'),
  ('CBASE(ECF,ST)(ABL80', 'cBASE(Ecf)', 'ABL80F standard temp (OCR잘림)')
) AS v(alias, canonical_name, source_hint)
LEFT JOIN standard_items_master s ON s.name = v.canonical_name;

-- =====================================================
-- 5단계: 검증 쿼리
-- =====================================================

-- 삽입된 standard_items_master 개수 확인
SELECT 'standard_items_master' as table_name, COUNT(*) as count FROM standard_items_master;

-- 삽입된 item_aliases_master 개수 확인
SELECT 'item_aliases_master' as table_name, COUNT(*) as count FROM item_aliases_master;

-- standard_item_id가 NULL인 alias 확인 (매칭 실패한 항목)
SELECT alias, canonical_name, source_hint
FROM item_aliases_master
WHERE standard_item_id IS NULL;

-- =====================================================
-- 완료
-- =====================================================
