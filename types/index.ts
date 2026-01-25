// 공통 타입 정의 - v2 업데이트

// ============================================
// OCR 관련 타입
// ============================================

export interface OcrResult {
  name: string
  value: number
  unit: string
  ref_min: number | null
  ref_max: number | null
  ref_text: string | null
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
  value: number
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
    value: number
    unit: string
    ref_min: number | null
    ref_max: number | null
    ref_text: string | null
    source_filename: string
    ocr_raw_name: string
    mapping_confidence: number
    user_verified: boolean
  }>
}

export interface BatchSaveResponse {
  success: boolean
  data: {
    record_id: string
    saved_count: number
  }
}
