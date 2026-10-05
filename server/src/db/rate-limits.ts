/**
 * [목적] rate_limits 테이블 접근 함수. 증가와 한도 판정을 UPSERT 한 문장으로 닫는다 (R-AUTH-005, R-NFR-003). 설계 db.md §3.2·§3.3
 * [공개 API] createRateLimitsRepo(binding) -> RateLimitsRepo { hit, purgeBefore }
 * [비동기] D1 prepare().bind().first()/run() await. 조건부 UPSERT 1문장이라 원자적
 * [에러] D1 오류 전파(purge 실패는 호출자가 무시할 수 있다)
 * [설정] 없음. 한도(limit)·창 시작(windowStartMs)은 auth 서비스가 인자로 넘긴다
 * [테스트] server/test/db.test.ts (SRV-T-126·127)
 */
import type { D1Database } from '@cloudflare/workers-types'
import { SQL_RATE_LIMITS_HIT, SQL_RATE_LIMITS_PURGE_BEFORE } from './sql'
import type { RateLimitRow } from './types'

export type RateLimitsRepo = {
  /** (mbId, windowStartMs) 창 카운트 +1. count < limit 일 때만 증가하고 새 count 를, 한도면 null */
  hit: (mbId: string, windowStartMs: number, limit: number) => Promise<number | null>
  /** window_start < windowStartMs 인 행(모든 mb_id)을 지우고 지운 행 수 */
  purgeBefore: (windowStartMs: number) => Promise<number>
}

/** rate_limits 저장소를 만든다 */
export const createRateLimitsRepo = (binding: D1Database): RateLimitsRepo => ({
  hit: async (mbId, windowStartMs, limit) => {
    const row = await binding
      .prepare(SQL_RATE_LIMITS_HIT)
      .bind(mbId, windowStartMs, limit)
      .first<RateLimitRow>()
    return row?.count ?? null
  },
  purgeBefore: async windowStartMs => {
    const result = await binding.prepare(SQL_RATE_LIMITS_PURGE_BEFORE).bind(windowStartMs).run()
    return result.meta.changes
  },
})
