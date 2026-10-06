/**
 * [목적] llm_usage 테이블 접근 함수. 월 1행 가산 UPSERT 와 조회 (R-LLM-007). 설계 db.md §2.4·§3.6
 * [공개 API] createLlmUsageRepo(binding) -> LlmUsageRepo { add, get }, 타입 LlmUsageTotals·LlmUsageDelta·LlmUsageRepo
 * [비동기] D1 prepare().bind().first() await. add 는 UPSERT 1문장이라 원자적
 * [에러] D1 오류 전파. add 의 RETURNING 행 없음은 AppError INTERNAL
 * [설정] 없음. month 문자열(KST 'YYYY-MM')은 llm 모듈이 계산해 넘긴다
 * [테스트] server/test/db.test.ts (SRV-T-223·224)
 */
import type { D1Database } from '@cloudflare/workers-types'
import { AppError } from '../app-error'
import { SQL_LLM_USAGE_ADD, SQL_LLM_USAGE_BY_MONTH } from './sql'
import type { LlmUsageRow } from './types'

export type LlmUsageTotals = {
  /** 'YYYY-MM' (KST). 계산은 llm 모듈, db 는 받은 문자열을 쓴다 */
  month: string
  calls: number
  promptTokens: number
  /** candidates + thoughts */
  outputTokens: number
  /** REAL, 소수 보존 */
  estKrw: number
}
export type LlmUsageDelta = { promptTokens: number; outputTokens: number; estKrw: number }

export type LlmUsageRepo = {
  /** month 행에 1회분을 더한다(없으면 만든다). UPSERT 1문장, 갱신 뒤 누적 행 반환 */
  add: (month: string, delta: LlmUsageDelta, nowMs: number) => Promise<LlmUsageTotals>
  /** month 행. 없으면 null */
  get: (month: string) => Promise<LlmUsageTotals | null>
}

const toLlmUsageTotals = (row: LlmUsageRow): LlmUsageTotals => ({
  month: row.month,
  calls: row.calls,
  promptTokens: row.prompt_tokens,
  outputTokens: row.output_tokens,
  estKrw: row.est_krw,
})

/** llm_usage 저장소를 만든다 */
export const createLlmUsageRepo = (binding: D1Database): LlmUsageRepo => ({
  add: async (month, delta, nowMs) => {
    const row = await binding
      .prepare(SQL_LLM_USAGE_ADD)
      .bind(month, delta.promptTokens, delta.outputTokens, delta.estKrw, nowMs)
      .first<LlmUsageRow>()
    if (row === null) throw new AppError('INTERNAL')
    return toLlmUsageTotals(row)
  },
  get: async month => {
    const row = await binding.prepare(SQL_LLM_USAGE_BY_MONTH).bind(month).first<LlmUsageRow>()
    return row === null ? null : toLlmUsageTotals(row)
  },
})
