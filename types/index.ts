// 공통 타입 정의 - v2 업데이트

// ============================================
// OCR 관련 타입
// ============================================

export interface OcrResult {
  name: string
  raw_name?: string           // 원본 항목명 (검사지에 표기된 그대로)
  value: number | string      // 특수값 지원 (<500, *14 등)
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
  value: number | string      // 특수값 지원
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
  uploaded_files: Array<{
    filename: string
    size: number
    type: string
  }>
  results: Array<{
    standard_item_id: string
    value: number | string    // 특수값 지원
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

export type LogCategory = 'meal' | 'water' | 'medicine' | 'poop' | 'pee' | 'breathing'

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
}

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
}

// ============================================
// 설정 관련 타입
// ============================================

export interface UserSettings {
  id: string
  user_id: string
  // 테마 설정
  theme: 'light' | 'dark' | 'system'
  created_at: string
  updated_at: string
}

export interface UserSettingsInput {
  theme?: 'light' | 'dark' | 'system'
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
  preset_name: string
  medicines: Medicine[]
  created_at: string
  updated_at: string
}

export interface MedicinePresetInput {
  preset_name: string
  medicines: Medicine[]
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
  }
}
