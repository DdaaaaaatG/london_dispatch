// SRV-T-210~217 — doc/200_설계/server/llm.md §12.12 (월 키·추정·게이트·누적). 순수 함수 + 가짜 UsageStore
import { describe, expect, it } from 'vitest'
import { AppError } from '../src/app-error'
import {
  budgetRetryAfterSec,
  createUsageMeter,
  estimateKrw,
  kstMonthKey,
  nextKstMonthStartMs,
  type LlmUsage,
  type UsageDelta,
  type UsageMeterConfig,
  type UsagePricing,
  type UsageStore,
  type UsageTotals,
} from '../src/llm'
import { createLogger } from '../src/logger'

const PRICING: UsagePricing = { priceInputUsdPerM: 0.3, priceOutputUsdPerM: 2.5, krwPerUsd: 1400 }
const CONFIG: UsageMeterConfig = { ...PRICING, monthlyBudgetKrw: 100000 }
const T = (iso: string): number => Date.parse(iso)

const VECTORS: [string, string, string, number][] = [
  ['2026-09-30T14:59:59.999Z', '2026-09', '2026-09-30T15:00:00.000Z', 1],
  ['2026-09-30T15:00:00.000Z', '2026-10', '2026-10-31T15:00:00.000Z', 2678400],
  ['2026-10-06T05:00:00.000Z', '2026-10', '2026-10-31T15:00:00.000Z', 2196000],
  ['2026-12-31T15:00:00.000Z', '2027-01', '2027-01-31T15:00:00.000Z', 2678400],
  ['2028-02-28T15:00:00.000Z', '2028-02', '2028-02-29T15:00:00.000Z', 86400],
]

type Log = { level: string; event: string; [k: string]: unknown }

const makeMeter = (opts: {
  rows?: Record<string, number>
  now?: number
  get?: UsageStore['get']
  add?: UsageStore['add']
}) => {
  const logs: Log[] = []
  const logger = createLogger((level, line) => {
    logs.push({ level, ...(JSON.parse(line) as object) } as Log)
  })
  const gets: string[] = []
  const adds: { month: string; delta: UsageDelta; nowMs: number }[] = []
  const row = (month: string, estKrw: number): UsageTotals => ({
    month,
    calls: 3,
    promptTokens: 0,
    outputTokens: 0,
    estKrw,
  })
  const store: UsageStore = {
    get:
      opts.get ??
      (async month => {
        gets.push(month)
        const v = opts.rows?.[month]
        return v === undefined ? null : row(month, v)
      }),
    add:
      opts.add ??
      (async (month, delta, nowMs) => {
        adds.push({ month, delta, nowMs })
        return row(month, 1234.56)
      }),
  }
  const now = opts.now ?? T('2026-10-06T05:00:00.000Z')
  const meter = createUsageMeter({ store, config: CONFIG, logger, now: () => now })
  return { meter, logs, gets, adds, now }
}

const caught = async (p: Promise<unknown>): Promise<unknown> => {
  try {
    await p
  } catch (e) {
    return e
  }
  return undefined
}

describe('월 키·추정 (순수 함수)', () => {
  it('SRV-T-210 kstMonthKey_and_nextKstMonthStartMs_match_vectors', () => {
    for (const [iso, key, next] of VECTORS) {
      expect(kstMonthKey(T(iso))).toBe(key)
      expect(nextKstMonthStartMs(T(iso))).toBe(T(next))
    }
  })

  it('SRV-T-211 budgetRetryAfterSec_is_ceil_and_at_least_1', () => {
    expect(budgetRetryAfterSec(T('2026-09-30T14:59:59.999Z'))).toBe(1)
    expect(budgetRetryAfterSec(T('2026-09-30T15:00:00.000Z'))).toBe(2678400)
    expect(budgetRetryAfterSec(T('2026-09-30T14:59:59.500Z'))).toBe(1)
    for (const [iso, , , sec] of VECTORS) {
      const v = budgetRetryAfterSec(T(iso))
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBe(sec)
    }
  })

  it('SRV-T-212 estimateKrw_matches_formula_vectors', () => {
    const u = (p: number, o: number, t: number): LlmUsage => ({
      promptTokens: p,
      outputTokens: o,
      thoughtsTokens: t,
    })
    expect(estimateKrw(u(100, 20, 0), PRICING)).toBeCloseTo(0.112, 9)
    expect(estimateKrw(u(3000, 300, 500), PRICING)).toBeCloseTo(4.06, 9)
    expect(estimateKrw(u(30000, 300, 1000), PRICING)).toBeCloseTo(17.15, 9)
    // 사고 토큰은 출력 단가로 계산된다
    expect(estimateKrw(u(0, 0, 1000), PRICING)).toBeCloseTo(estimateKrw(u(0, 1000, 0), PRICING), 12)
    expect(
      estimateKrw(u(5, 5, 5), { ...PRICING, priceInputUsdPerM: 0, priceOutputUsdPerM: 0 }),
    ).toBe(0)
  })
})

describe('게이트·누적 (UsageMeter)', () => {
  it('SRV-T-213 ensureBudget_allows_below_and_rejects_at_or_above_budget', async () => {
    const month = kstMonthKey(T('2026-10-06T05:00:00.000Z'))
    const free = makeMeter({})
    await free.meter.ensureBudget()
    expect(free.gets).toEqual([month])
    expect(free.logs).toHaveLength(0)

    const below = makeMeter({ rows: { [month]: 99999.999 } })
    await below.meter.ensureBudget()
    expect(below.logs).toHaveLength(0)

    for (const est of [100000, 100000.5]) {
      const m = makeMeter({ rows: { [month]: est } })
      const e = await caught(m.meter.ensureBudget())
      expect(e).toBeInstanceOf(AppError)
      const err = e as AppError
      expect([err.code, err.status]).toEqual(['LLM_BUDGET_EXCEEDED', 429])
      expect(err.retryAfterSec).toBe(budgetRetryAfterSec(m.now))
      expect(m.gets).toEqual([month])
      expect(m.logs).toHaveLength(1)
      expect(m.logs[0]).toMatchObject({
        level: 'warn',
        event: 'llm_budget_exceeded',
        month,
        estKrw: Math.round(est),
        budgetKrw: 100000,
      })
    }
  })

  it('SRV-T-214 ensureBudget_unlocks_on_next_kst_month', async () => {
    const rows = { '2026-10': 100000 }
    const before = makeMeter({ rows, now: T('2026-10-31T14:59:59.999Z') })
    const e = await caught(before.meter.ensureBudget())
    expect((e as AppError).code).toBe('LLM_BUDGET_EXCEEDED')
    const after = makeMeter({ rows, now: T('2026-10-31T15:00:00.000Z') })
    await after.meter.ensureBudget()
    expect(after.gets).toEqual(['2026-11'])
  })

  it('SRV-T-215 ensureBudget_propagates_store_error', async () => {
    const boom = new Error('d1 down')
    const m = makeMeter({
      get: async () => {
        throw boom
      },
    })
    const e = await caught(m.meter.ensureBudget())
    expect(e).toBe(boom)
    expect(e).not.toBeInstanceOf(AppError)
  })

  it('SRV-T-216 record_adds_delta_and_logs_usage_fields_only', async () => {
    const m = makeMeter({})
    await m.meter.record({ promptTokens: 100, outputTokens: 20, thoughtsTokens: 7 })
    expect(m.adds).toHaveLength(1)
    const add = m.adds[0]!
    expect(add.month).toBe('2026-10')
    expect(add.nowMs).toBe(m.now)
    expect(add.delta.promptTokens).toBe(100)
    expect(add.delta.outputTokens).toBe(27)
    expect(add.delta.estKrw).toBeCloseTo(0.1365, 9)
    expect(m.logs).toHaveLength(1)
    const log = m.logs[0]!
    expect([log.level, log.event]).toEqual(['info', 'llm_usage'])
    const { level: _l, event: _e, ...fields } = log
    expect(Object.keys(fields).sort()).toEqual(['budgetKrw', 'calls', 'estKrw', 'month', 'pct'])
    expect(Number.isInteger(log.estKrw)).toBe(true)
    expect(log.estKrw).toBe(1235)
    expect(log.pct).toBe(1)
  })

  it('SRV-T-217 record_never_throws_when_store_fails', async () => {
    const m = makeMeter({
      add: async () => {
        throw new TypeError('d1 down')
      },
    })
    await expect(
      m.meter.record({ promptTokens: 1, outputTokens: 1, thoughtsTokens: 0 }),
    ).resolves.toBeUndefined()
    expect(m.logs.filter(l => l.event === 'llm_usage')).toHaveLength(0)
    const warns = m.logs.filter(l => l.event === 'llm_usage_record_failed')
    expect(warns).toHaveLength(1)
    expect(warns[0]).toMatchObject({ level: 'warn', month: '2026-10', errName: 'TypeError' })
  })
})
