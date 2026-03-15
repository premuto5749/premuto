// 공통 타입 정의 - v2 업데이트

// ============================================
// OCR 관련 타입
// ============================================

export interface OcrResult {
  name: string
  raw_name?: string           // 원본 항목명 (검사지에 표기된 그대로)
  value: number | string | null  // 특수값 지원 (<500, *14 등), null = 값 없음
  unit: string
  ref_min: number | null
  ref_max: number | null
  ref_text: string | null
  reference?: string          // 원본 참조범위 (예: "3-50", "<14")
  is_abnormal?: boolean       // 이상 여부 (▲, ▼, H, L 표시)
  abnormal_direction?: 'high' | 'low' | null  // 이상 방향
}

export interface OcrResponse {
  items: OcrResult[]
  test_date?: string
  hospital_name?: string
  machine_type?: string
}

// v2: 다중 파일 OCR 응답
export interface OcrBatchResponse {
  success: boolean
  data: {
    test_date: string
    hospital_name: string
    batch_id: string
    results: Array<{
      filename: string
      items: OcrResult[]
      metadata: {
        pages: number
        processingTime: number
        test_date?: string
        hospital_name?: string
      }
    }>
    warnings: Array<{
      type: 'date_mismatch' | 'duplicate_item' | 'parse_error'
      message: string
      files: string[]
    }>
  }
}

// ============================================
// AI 매칭 관련 타입
// ============================================

export interface AiMappingSuggestion {
  standard_item_id: string
  standard_item_name: string
  display_name_ko: string
  confidence: number // 0-100
  reasoning: string
  source_hint?: string // 장비/병원 힌트 (v3)
}

export interface AiMappingResponse {
  success: boolean
  data: Array<{
    ocr_item: OcrResult
    suggested_mapping: AiMappingSuggestion | null
  }>
}

// ============================================
// Staging 관련 타입
// ============================================

export interface StagingItem extends OcrResult {
  id: string
  standard_item_id: string | null
  standard_item_name: string | null
  status: 'Low' | 'Normal' | 'High' | 'Unknown'
  is_mapped: boolean
  // v2 추가
  source_filename?: string
  mapping_confidence?: number
  ai_suggestion?: AiMappingSuggestion
}

// ============================================
// 데이터베이스 테이블 타입
// ============================================

export interface Hospital {
  id: string
  name: string
  address?: string | null
  phone?: string | null
  website?: string | null
  notes?: string | null
  created_at?: string
  updated_at?: string
}

export interface StandardItem {
  id: string
  category: string | null
  name: string
  display_name_ko: string | null
  default_unit: string | null
  description: string | null
}

export interface ItemMapping {
  id: string
  raw_name: string
  standard_item_id: string
  // v2 추가
  confidence_score?: number
  mapping_source?: 'ai' | 'user' | 'manual'
  created_at?: string
  created_by?: string
}

export interface TestRecord {
  id: string
  test_date: string
  hospital_name: string | null
  machine_type: string | null
  created_at?: string
  // v2 추가
  uploaded_files?: Array<{
    filename: string
    size: number
    type: string
  }>
  file_count?: number
  batch_upload_id?: string
}

export interface TestResult {
  id: string
  record_id: string
  standard_item_id: string
  value: number | string | null  // 특수값 지원, null = 값 없음
  ref_min: number | null
  ref_max: number | null
  ref_text: string | null
  status: 'Low' | 'Normal' | 'High' | 'Unknown'
  unit: string | null
  created_at?: string
  // v2 추가
  source_filename?: string
  ocr_raw_name?: string
  mapping_confidence?: number
  user_verified?: boolean
  is_abnormal?: boolean       // 이상 여부
  abnormal_direction?: 'high' | 'low' | null
}

// ============================================
// 배치 저장 관련 타입
// ============================================

export interface BatchSaveRequest {
  batch_id: string
  test_date: string
  hospital_name: string
  ocr_batch_id?: string  // 원본 OCR batch_id (스테이징에서 파일 조회용)
  uploaded_files: Array<{
    filename: string
    size: number
    type: string
  }>
  results: Array<{
    standard_item_id: string
    value: number | string | null  // 특수값 지원, null = 값 없음
    unit: string
    ref_min: number | null
    ref_max: number | null
    ref_text: string | null
    source_filename: string
    ocr_raw_name: string
    mapping_confidence: number
    user_verified: boolean
    is_abnormal?: boolean
    abnormal_direction?: 'high' | 'low' | null
  }>
}

export interface BatchSaveResponse {
  success: boolean
  data: {
    record_id: string
    saved_count: number
  }
}

// ============================================
// 일일 건강 기록 (Daily Log) 타입
// ============================================

export type LogCategory = 'meal' | 'water' | 'snack' | 'medicine' | 'poop' | 'pee' | 'breathing' | 'weight' | 'walk' | 'vomit' | 'note'

export interface DailyLog {
  id: string
  user_id: string            // 소유자 ID (RLS로 본인 기록만 조회 가능)
  pet_id: string | null      // 반려동물 ID
  category: LogCategory
  logged_at: string          // ISO 날짜/시간
  amount: number | null      // 양 (g, ml, 회/분 등) - 식사의 경우 급여량
  leftover_amount: number | null  // 남긴 양 (식사 카테고리에서 사용)
  unit: string | null        // 단위
  memo: string | null        // 메모
  photo_urls: string[]       // 사진 URL 배열 (최대 5장)
  medicine_name: string | null  // 약 이름 (category가 medicine일 때)
  snack_name: string | null     // 간식 이름 (category가 snack일 때)
  calories: number | null       // 칼로리 (category가 snack일 때)
  input_source?: 'preset' | 'manual'  // 프리셋/직접입력 구분
  walk_end_at?: string | null    // 산책 종료 시각 (null = 진행 중)
  walk_id?: string | null        // 산책 중 기록한 활동 연결용
  tags?: Record<string, string | string[]> | null  // 태그 (JSONB)
  created_at: string
  updated_at: string
}

export interface DailyLogInput {
  category: LogCategory
  pet_id?: string | null     // 반려동물 ID
  logged_at?: string         // 기본값: 현재 시간
  amount?: number | null     // 급여량 (식사의 경우)
  leftover_amount?: number | null  // 남긴 양 (식사 카테고리에서 사용)
  unit?: string | null
  memo?: string | null
  photo_urls?: string[]      // 사진 URL 배열 (최대 5장)
  medicine_name?: string | null
  snack_name?: string | null
  calories?: number | null
  input_source?: 'preset' | 'manual'
  walk_end_at?: string | null    // 산책 종료 시각
  walk_id?: string | null        // 산책 중 다른 활동 연결
  tags?: Record<string, string | string[]> | null  // 태그 (JSONB)
}

/** 복사/붙여넣기용 클립보드 항목 (핵심 필드만) */
export interface ClipboardLogItem {
  category: LogCategory
  pet_id: string | null
  amount: number | null
  leftover_amount: number | null
  unit: string | null
  medicine_name: string | null
  snack_name: string | null
  calories: number | null
  input_source: 'preset' | 'manual'
  time: string  // "HH:mm" (logged_at에서 추출)
}

/** 복사 선택 가능 카테고리 (weight, walk, vomit, note 제외) */
export const COPYABLE_CATEGORIES: LogCategory[] = [
  'meal', 'water', 'snack', 'medicine', 'poop', 'pee', 'breathing'
]

export interface DailyStats {
  user_id: string            // 소유자 ID
  pet_id: string | null      // 반려동물 ID
  log_date: string
  total_meal_amount: number
  meal_count: number
  total_water_amount: number
  water_count: number
  medicine_count: number
  poop_count: number
  pee_count: number
  avg_breathing_rate: number | null
  breathing_count: number
  snack_count: number
  total_snack_amount: number
  total_snack_calories: number
  walk_count: number
  total_walk_duration: number
  vomit_count: number
  note_count: number
}

// ============================================
// 설정 관련 타입
// ============================================

export interface CardLayoutItem {
  category: LogCategory
  visible: boolean
}

export interface UserSettings {
  id: string
  user_id: string
  // 테마 설정
  theme: 'light' | 'dark' | 'system'
  // 카드 배치 설정
  card_layout: CardLayoutItem[] | null
  created_at: string
  updated_at: string
}

export interface UserSettingsInput {
  theme?: 'light' | 'dark' | 'system'
  card_layout?: CardLayoutItem[] | null
}

export interface Medicine {
  name: string
  dosage: number
  dosage_unit: 'mg' | 'tablet' | 'ml'
  frequency: 'qd' | 'bid' | 'tid' | 'qid' | 'prn' | string  // qd=1일1회, bid=1일2회, tid=1일3회, qid=1일4회, prn=필요시
}

export interface MedicinePreset {
  id: string
  user_id: string
  pet_id: string | null      // null = 모든 반려동물에게 표시, string = 특정 반려동물에게만 표시
  preset_name: string
  medicines: Medicine[]
  created_at: string
  updated_at: string
}

export interface MedicinePresetInput {
  preset_name: string
  pet_id?: string | null     // null = 모든 반려동물, string = 특정 반려동물
  medicines: Medicine[]
}

export interface SnackPreset {
  id: string
  user_id: string
  pet_id: string | null
  name: string
  default_amount: number | null
  calories_per_unit: number | null
  unit: string
  memo: string | null
  created_at: string
  updated_at: string
}

export interface SnackPresetInput {
  name: string
  pet_id?: string | null
  default_amount?: number | null
  calories_per_unit?: number | null
  unit?: string
  memo?: string | null
}

// ============================================
// 반려동물 프로필 타입
// ============================================

export interface Pet {
  id: string
  user_id: string
  name: string
  type: string | null          // 고양이, 강아지, 기타
  breed: string | null         // 품종
  birth_date: string | null    // 생년월일 (YYYY-MM-DD)
  weight_kg: number | null     // 체중 (kg)
  photo_url: string | null     // 프로필 사진 URL
  is_default: boolean          // 기본 선택 여부
  sort_order: number           // 정렬 순서
  is_neutered: boolean         // 중성화 여부
  activity_level: 'low' | 'normal' | 'high'  // 활동량
  food_calorie_density: number | null  // 사료 칼로리 밀도 (kcal/g)
  created_at: string
  updated_at: string
}

export interface PetInput {
  name: string
  type?: string | null
  breed?: string | null
  birth_date?: string | null
  weight_kg?: number | null
  photo_url?: string | null
  is_default?: boolean
  is_neutered?: boolean
  activity_level?: 'low' | 'normal' | 'high'
  food_calorie_density?: number | null
}

// ============================================
// Google Drive 연동 타입
// ============================================

export interface GoogleDriveConnection {
  id: string
  user_id: string
  google_email: string | null
  access_token: string           // 암호화된 토큰
  refresh_token: string          // 암호화된 토큰
  token_expires_at: string | null
  root_folder_id: string | null
  is_active: boolean
  last_sync_at: string | null
  created_at: string
  updated_at: string
}

export interface GoogleDriveSyncLog {
  id: string
  user_id: string
  source_type: 'daily_log_photo' | 'ocr_source'
  source_id: string | null
  file_name: string
  drive_file_id: string | null
  drive_folder_path: string | null
  status: 'pending' | 'uploading' | 'success' | 'failed'
  error_message: string | null
  retry_count: number
  created_at: string
}

// ============================================
// 사료 데이터베이스 (Pet Food) 타입
// ============================================

export type FoodType = '건사료' | '습식' | '기타'
export type FoodCategory = '건사료' | '습식' | '생식' | '간식' | '보충제/영양제'
export type TargetAnimal = '강아지' | '고양이' | '공통'

export interface PetFood {
  id: string
  name: string
  brand: string | null
  calorie_density: number
  food_type: FoodType
  food_category: FoodCategory
  target_animal: TargetAnimal
  user_id: string | null
  pet_id: string | null
  ingredients_text: string | null
  photo_urls: string[] | null
  is_active: boolean
  memo: string | null
  created_at: string
  updated_at: string
  nutrients?: PetFoodNutrient[]
}

export interface PetFoodInput {
  name: string
  brand?: string | null
  calorie_density?: number | null
  food_type?: FoodType
  food_category?: FoodCategory
  target_animal?: TargetAnimal
  pet_id?: string | null
  ingredients_text?: string | null
  photo_urls?: string[] | null
  is_active?: boolean
  memo?: string | null
  nutrients?: PetFoodNutrientInput[]
}

export interface PetFoodNutrient {
  id: string
  pet_food_id: string
  nutrient_name: string
  value: number
  unit_id: string | null
  unit_symbol?: string
  sort_order: number
  created_at: string
}

export interface NutrientUnit {
  id: string
  symbol: string
  label: string
  sort_order: number
}

export interface PetFoodNutrientInput {
  nutrient_name: string
  value: number
  unit_symbol: string
  sort_order?: number
}

export interface PetFoodOcrResult {
  brand: string | null
  name: string | null
  food_category: FoodCategory | null
  target_animal: TargetAnimal | null
  ingredients_text: string | null
  calorie_density: number | null
  nutrients: PetFoodNutrientInput[]
}

// ============================================
// 급여 계획 (Feeding Plan) 타입
// ============================================

export type CalorieDensityUnit = 'kcal_per_g' | 'kcal_per_100g'

export interface FeedingPlanFood {
  food_id: string | null
  name: string
  brand?: string | null
  calorie_density: number        // 항상 kcal/g 단위로 저장
  calorie_density_input?: number // 사용자가 입력한 원본값 (UI용)
  calorie_density_unit?: CalorieDensityUnit // 입력 시 선택한 단위 (UI용)
  ratio_percent: number
}

export interface FeedingPlan {
  id: string
  user_id: string
  pet_id: string
  plan_date: string
  weight_kg: number
  is_neutered: boolean
  activity_level: 'low' | 'normal' | 'high'
  rer: number
  activity_factor: number
  der: number
  foods: FeedingPlanFood[]
  feeding_frequency: number
  created_at: string
  updated_at: string
}

export interface FeedingPlanInput {
  pet_id: string
  plan_date?: string
  weight_kg: number
  is_neutered: boolean
  activity_level: 'low' | 'normal' | 'high'
  foods: FeedingPlanFood[]
  feeding_frequency?: number
}

// 카테고리별 설정
export const LOG_CATEGORY_CONFIG: Record<LogCategory, {
  label: string
  icon: string
  unit: string
  placeholder: string
  color: string
}> = {
  meal: {
    label: '식사',
    icon: '🍚',
    unit: 'g',
    placeholder: '섭취량 (g)',
    color: 'bg-orange-100 text-orange-700'
  },
  water: {
    label: '음수',
    icon: '💧',
    unit: 'ml',
    placeholder: '음수량 (ml)',
    color: 'bg-blue-100 text-blue-700'
  },
  snack: {
    label: '간식',
    icon: '🍪',
    unit: '개',
    placeholder: '간식량',
    color: 'bg-pink-100 text-pink-700'
  },
  medicine: {
    label: '약',
    icon: '💊',
    unit: '정',
    placeholder: '복용량',
    color: 'bg-purple-100 text-purple-700'
  },
  poop: {
    label: '배변',
    icon: '💩',
    unit: '회',
    placeholder: '',
    color: 'bg-amber-100 text-amber-700'
  },
  pee: {
    label: '배뇨',
    icon: '🚽',
    unit: '회',
    placeholder: '',
    color: 'bg-yellow-100 text-yellow-700'
  },
  breathing: {
    label: '호흡수',
    icon: '🫁',
    unit: '회/분',
    placeholder: '분당 호흡수',
    color: 'bg-teal-100 text-teal-700'
  },
  weight: {
    label: '체중',
    icon: '⚖️',
    unit: 'kg',
    placeholder: '체중 (kg)',
    color: 'bg-emerald-100 text-emerald-700'
  },
  walk: {
    label: '산책',
    icon: '🐕',
    unit: '분',
    placeholder: '산책 시간',
    color: 'bg-green-100 text-green-700'
  },
  vomit: {
    label: '구토',
    icon: '🤮',
    unit: '회',
    placeholder: '',
    color: 'bg-rose-100 text-rose-700'
  },
  note: {
    label: '기타',
    icon: '📝',
    unit: '',
    placeholder: '',
    color: 'bg-gray-100 text-gray-700'
  }
}
