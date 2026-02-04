// Supabase 데이터베이스 타입 정의
// 실제 타입은 Supabase 설정 후 'npx supabase gen types typescript' 명령으로 생성됩니다.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      standard_items_master: {
        Row: {
          id: string
          category: string | null
          name: string
          display_name_ko: string | null
          default_unit: string | null
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          category?: string | null
          name: string
          display_name_ko?: string | null
          default_unit?: string | null
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          category?: string | null
          name?: string
          display_name_ko?: string | null
          default_unit?: string | null
          description?: string | null
          created_at?: string
        }
      }
      item_mappings_master: {
        Row: {
          id: string
          raw_name: string
          standard_item_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          raw_name: string
          standard_item_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          raw_name?: string
          standard_item_id?: string | null
          created_at?: string
        }
      }
      test_records: {
        Row: {
          id: string
          test_date: string
          hospital_name: string | null
          machine_type: string | null
          created_at: string
        }
        Insert: {
          id?: string
          test_date: string
          hospital_name?: string | null
          machine_type?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          test_date?: string
          hospital_name?: string | null
          machine_type?: string | null
          created_at?: string
        }
      }
      test_results: {
        Row: {
          id: string
          record_id: string | null
          standard_item_id: string | null
          value: number
          ref_min: number | null
          ref_max: number | null
          ref_text: string | null
          status: 'Low' | 'Normal' | 'High' | 'Unknown' | null
          unit: string | null
          created_at: string
        }
        Insert: {
          id?: string
          record_id?: string | null
          standard_item_id?: string | null
          value: number
          ref_min?: number | null
          ref_max?: number | null
          ref_text?: string | null
          status?: 'Low' | 'Normal' | 'High' | 'Unknown' | null
          unit?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          record_id?: string | null
          standard_item_id?: string | null
          value?: number
          ref_min?: number | null
          ref_max?: number | null
          ref_text?: string | null
          status?: 'Low' | 'Normal' | 'High' | 'Unknown' | null
          unit?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
