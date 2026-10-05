/**
 * 날짜·시각 표기 — 설계 rooms/design/components.md §1.6 · F-RM-11 · 요구 R-ROOMS-001 · R-CHAT-002
 * 브라우저 로컬 시간대의 Date 게터로 만들고 두 자리 0 채움. 외부 라이브러리 없음.
 */
const pad2 = (n: number): string => String(n).padStart(2, '0')

/** 'MM.DD' 예: 10.05 */
export const formatMonthDay = (epochMs: number): string => {
  const date = new Date(epochMs)
  return `${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`
}

/** 'HH:mm' 24시간 예: 16:40 */
export const formatTime = (epochMs: number): string => {
  const date = new Date(epochMs)
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

/** 'YYYY-MM-DD' (`<time dateTime>`용) */
export const toIsoDate = (epochMs: number): string => {
  const date = new Date(epochMs)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** 'YYYY-MM-DDTHH:mm' (`<time dateTime>`용) */
export const toIsoDateTime = (epochMs: number): string =>
  `${toIsoDate(epochMs)}T${formatTime(epochMs)}`
