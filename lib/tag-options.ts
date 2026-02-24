// 건강 이벤트 태그 옵션 상수

// ============================================
// 배변 색상
// ============================================
export const POOP_COLOR_OPTIONS = [
  { value: 'chocolate', label: '갈색', color: '#8B4513', description: '정상적인 대변 색상입니다.' },
  { value: 'gray', label: '회색', color: '#9CA3AF', description: '담도 문제가 있을 수 있습니다. 지속되면 수의사 상담을 권장합니다.' },
  { value: 'black', label: '검은색', color: '#1F2937', description: '상부 소화관 출혈 가능성. 수의사 상담을 권장합니다.' },
  { value: 'red', label: '붉은색', color: '#EF4444', description: '하부 소화관 출혈 가능성. 수의사 상담을 권장합니다.' },
  { value: 'green', label: '초록색', color: '#22C55E', description: '풀을 먹었거나 담즙 문제일 수 있습니다.' },
  { value: 'yellow', label: '노란색', color: '#EAB308', description: '소화 문제나 간 관련 문제일 수 있습니다.' },
] as const

// ============================================
// 배변 경도
// ============================================
export const POOP_CONSISTENCY_OPTIONS = [
  { value: 'watery', label: '설사(물)', icon: '💦', score: 7, description: '물처럼 형태가 없음. 웅덩이 형태로 나옴.' },
  { value: 'soft', label: '묽음', icon: '〰️', score: 6, description: '일부 형태가 있으나 쉽게 무너짐.' },
  { value: 'mushy', label: '부드러움', icon: '🔘', score: 5, description: '형태가 있으나 매우 부드러움. 주우면 자국이 남음.' },
  { value: 'normal', label: '보통', icon: '✅', score: 3, description: '적당히 단단하고 형태가 잘 유지됨. 이상적인 상태.' },
  { value: 'hard', label: '딱딱함', icon: '🪨', score: 2, description: '건조하고 딱딱함. 수분 부족 가능성.' },
  { value: 'dry', label: '건조', icon: '🏜️', score: 1, description: '매우 딱딱하고 건조. 배출 시 힘듬. 수분 섭취 확인 필요.' },
] as const

// ============================================
// 구토 색상
// ============================================
export const VOMIT_COLOR_OPTIONS = [
  { value: 'clear', label: '투명(무색)', color: '#E5E7EB', description: '위액만 나온 경우. 공복 구토일 수 있습니다.' },
  { value: 'food', label: '음식물', color: '#D97706', description: '소화되지 않은 음식. 과식이나 급하게 먹었을 때.' },
  { value: 'white_foam', label: '흰색(거품)', color: '#F3F4F6', description: '위산과 침이 섞인 거품. 공복이나 위 자극.' },
  { value: 'yellow', label: '노란색(담즙)', color: '#FACC15', description: '담즙 역류. 공복 시간이 길었을 수 있습니다.' },
  { value: 'green', label: '초록색', color: '#22C55E', description: '담즙이나 풀을 먹었을 수 있습니다.' },
  { value: 'brown', label: '갈색', color: '#92400E', description: '소화된 음식이나 혈액. 지속되면 수의사 상담.' },
  { value: 'red', label: '붉은색(혈액)', color: '#EF4444', description: '혈액 혼입. 즉시 수의사 상담을 권장합니다.' },
] as const

// ============================================
// 타입 유틸리티
// ============================================
export type PoopColor = typeof POOP_COLOR_OPTIONS[number]['value']
export type PoopConsistency = typeof POOP_CONSISTENCY_OPTIONS[number]['value']
export type VomitColor = typeof VOMIT_COLOR_OPTIONS[number]['value']

export interface PoopTags {
  color?: PoopColor
  consistency?: PoopConsistency
}

export interface VomitTags {
  color?: VomitColor
}

export type DailyLogTags = PoopTags | VomitTags

// 태그 옵션 아이템 공통 타입
export interface TagOption {
  value: string
  label: string
  color?: string
  icon?: string
  description?: string
  score?: number
}
