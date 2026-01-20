// 공통 타입 정의

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

export interface StagingItem extends OcrResult {
  id: string
  standard_item_id: string | null
  standard_item_name: string | null
  status: 'Low' | 'Normal' | 'High' | 'Unknown'
  is_mapped: boolean
}

export interface TestRecord {
  id: string
  test_date: string
  hospital_name: string | null
  machine_type: string | null
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
}

export interface StandardItem {
  id: string
  category: string | null
  name: string
  display_name_ko: string | null
  default_unit: string | null
  description: string | null
}
