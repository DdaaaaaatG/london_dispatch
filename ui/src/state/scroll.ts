/**
 * 스크롤 계산(순수) — 설계 chat/design/functions.md §2 · F-CH-13 · 요구 R-CHAT-003 · R-CHAT-010
 * 비유: 두루마리 위에 종이를 덧붙이면 그만큼 아래로 감아 줘야 읽던 줄이 제자리에 있다.
 * anchorScrollTop 이 "덧붙인 길이만큼 감기"다. DOM·React 의존 없음.
 */
/** 위쪽 근처 판정 임계(ui-design-strategy §6.4) */
export const TOP_THRESHOLD_PX = 80
/** 아래쪽 근처 판정 임계(ui-design-strategy §6.4) */
export const BOTTOM_THRESHOLD_PX = 120

export type ScrollMetrics = { scrollTop: number; scrollHeight: number; clientHeight: number }

/** 맨 아래로부터의 거리(px). 음수는 0 */
export const distanceFromBottom = (m: ScrollMetrics): number =>
  Math.max(0, m.scrollHeight - m.scrollTop - m.clientHeight)

/** 맨 위 근처인가 */
export const isNearTop = (m: ScrollMetrics): boolean => m.scrollTop <= TOP_THRESHOLD_PX

/** 맨 아래 근처인가 */
export const isNearBottom = (m: ScrollMetrics): boolean =>
  distanceFromBottom(m) <= BOTTOM_THRESHOLD_PX

/** 앞쪽에 붙인 뒤 읽던 자리를 지키는 scrollTop */
export const anchorScrollTop = (prev: ScrollMetrics, nextScrollHeight: number): number =>
  prev.scrollTop + (nextScrollHeight - prev.scrollHeight)

/** 저장한 거리(null = 맨 아래)로 되돌릴 scrollTop. 범위 밖은 0 ~ 최대로 자른다 */
export const restoreScrollTop = (
  m: Pick<ScrollMetrics, 'scrollHeight' | 'clientHeight'>,
  saved: number | null,
): number => {
  const max = Math.max(0, m.scrollHeight - m.clientHeight)
  return Math.min(Math.max(max - (saved ?? 0), 0), max)
}
