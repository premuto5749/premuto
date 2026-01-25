import { createClient } from '@/lib/supabase/client'
import type { StandardItem } from '@/types'

/**
 * OCR 결과 항목을 표준 항목으로 자동 매핑
 */
export async function autoMapItem(rawName: string): Promise<string | null> {
  const supabase = createClient()
  
  // 1. item_mappings 테이블에서 동의어 검색
  const { data, error } = await supabase
    .from('item_mappings')
    .select('standard_item_id')
    .eq('raw_name', rawName)
    .single()

  if (error || !data) {
    return null
  }

  return data.standard_item_id
}

/**
 * 모든 표준 항목 조회
 */
export async function getAllStandardItems(): Promise<StandardItem[]> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('standard_items')
    .select('*')
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    console.error('Failed to fetch standard items:', error)
    return []
  }

  return data || []
}

/**
 * 상태 판정 로직
 * Value가 Ref_Min보다 낮으면 Low, Ref_Max보다 높으면 High
 */
export function calculateStatus(
  value: number | string,
  refMin: number | null,
  refMax: number | null
): 'Low' | 'Normal' | 'High' | 'Unknown' {
  // 참고치가 없으면 Unknown
  if (refMin === null && refMax === null) {
    return 'Unknown'
  }

  // value를 숫자로 변환 (string일 수 있음: <500, *14 등)
  const numericValue = typeof value === 'number'
    ? value
    : parseFloat(String(value).replace(/[<>*,]/g, ''))

  // 숫자로 변환 불가능한 경우
  if (isNaN(numericValue)) {
    return 'Unknown'
  }

  // Low 판정
  if (refMin !== null && numericValue < refMin) {
    return 'Low'
  }

  // High 판정
  if (refMax !== null && numericValue > refMax) {
    return 'High'
  }

  // Normal
  return 'Normal'
}

/**
 * 신규 표준 항목 생성
 */
export async function createStandardItem(
  name: string,
  category: string,
  displayNameKo: string,
  defaultUnit: string,
  description?: string
): Promise<string | null> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('standard_items')
    .insert({
      name,
      category,
      display_name_ko: displayNameKo,
      default_unit: defaultUnit,
      description
    })
    .select('id')
    .single()

  if (error) {
    console.error('Failed to create standard item:', error)
    return null
  }

  return data.id
}

/**
 * 새로운 매핑 추가
 */
export async function createItemMapping(
  rawName: string,
  standardItemId: string
): Promise<boolean> {
  const supabase = createClient()
  
  const { error } = await supabase
    .from('item_mappings')
    .insert({
      raw_name: rawName,
      standard_item_id: standardItemId
    })

  if (error) {
    console.error('Failed to create item mapping:', error)
    return false
  }

  return true
}
