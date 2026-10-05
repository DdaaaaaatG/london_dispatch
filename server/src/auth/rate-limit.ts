/**
 * [목적] 레이트리밋 분 창 계산 순수 함수 (R-AUTH-005). 설계 auth.md §2.5
 * [공개 API] RATE_WINDOW_MS, windowStartOf(nowMs), retryAfterSecOf(nowMs)
 * [비동기] 없음(동기 순수 함수)
 * [에러] 없음
 * [설정] 없음. 한도(rateLimitPerMin)는 service.ts 가 Config 에서 받는다
 * [테스트] server/test/auth.test.ts (SRV-T-110)
 */

/** 레이트리밋 창 길이(ms) */
export const RATE_WINDOW_MS = 60_000
const MS_PER_SEC = 1000

/** 분 창 시작 epoch ms = floor(nowMs / 60000) * 60000 */
export const windowStartOf = (nowMs: number): number =>
  Math.floor(nowMs / RATE_WINDOW_MS) * RATE_WINDOW_MS

/** 다음 창 시작까지 남은 초. 올림, 최소 1 */
export const retryAfterSecOf = (nowMs: number): number =>
  Math.max(1, Math.ceil((windowStartOf(nowMs) + RATE_WINDOW_MS - nowMs) / MS_PER_SEC))
