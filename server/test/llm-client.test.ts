// SRV-T-180~184, 319~321 - doc/200_설계/server/llm.md 8, 14.7 (재시도·예산·로그). 실제 타이머 없이 가짜 시계로 검증한다
import { describe, expect, it } from 'vitest'
import { AppError } from '../src/app-error'
import {
  createLlm,
  createUsageMeter,
  DEFAULT_PROMPT_SETTINGS,
  FAKE_USAGE,
  FakeProvider,
  buildSummaryPrompt,
  LLM_BUDGET_MS,
  planRetryTimeout,
  SUMMARY_BUDGET_MS,
  SELECT_TIMEOUT_MS,
  type FakeStep,
  type LlmUsage,
  type Prompt,
  type UsagePricing,
  type UsageTotals,
  type UsageMeter,
} from '../src/llm'
import { GeminiProvider } from '../src/llm/gemini'
import { LlmError, type LlmFailReason } from '../src/llm/provider'
import { createLogger } from '../src/logger'

const PRICING: UsagePricing = { priceInputUsdPerM: 0.3, priceOutputUsdPerM: 2.5, krwPerUsd: 1400 }
const PROMPT: Prompt = { system: 'SYS', turns: [{ role: 'user', text: 'TURN' }] }

/** 가짜 시계: now 는 변수 값, sleep 은 값을 올린다 */
const makeClock = () => {
  let t = 0
  const sleeps: number[] = []
  return {
    now: () => t,
    sleep: async (ms: number) => {
      sleeps.push(ms)
      t += ms
    },
    advance: (ms: number) => {
      t += ms
    },
    sleeps,
  }
}
type Clock = ReturnType<typeof makeClock>

/** ms 만큼 시간을 쓰고 실패하는 각본 */
const failAfter =
  (clock: Clock, ms: number, error: LlmError): FakeStep =>
  async () => {
    clock.advance(ms)
    throw error
  }

const setup = (steps: (clock: Clock) => FakeStep[]) => {
  const clock = makeClock()
  const provider = new FakeProvider(steps(clock))
  const lines: string[] = []
  const logger = createLogger((_level, line) => lines.push(line))
  const llm = createLlm({ provider, timeoutMs: 60_000, logger, now: clock.now, sleep: clock.sleep })
  const logs = () => lines.map(l => JSON.parse(l) as Record<string, unknown>)
  return { clock, provider, llm, lines, logs }
}

const appError = async (p: Promise<unknown>): Promise<AppError> => {
  try {
    await p
  } catch (e) {
    expect(e).toBeInstanceOf(AppError)
    return e as AppError
  }
  throw new Error('expected AppError')
}

describe('createLlm 재시도 (R-LLM-005)', () => {
  it.each<LlmFailReason>(['network', 'timeout', 'http_5xx'])(
    'SRV-T-180 createLlm_retries_once_then_succeeds: %s',
    async reason => {
      const { llm, provider, clock } = setup(c => [
        failAfter(c, 1000, new LlmError(reason)),
        { text: '좋아' },
      ])
      expect(await llm.complete(PROMPT)).toBe('좋아')
      expect(provider.calls).toHaveLength(2)
      expect(provider.calls.map(c => c.timeoutMs)).toEqual([60_000, 60_000])
      expect(provider.calls[0]).toMatchObject({ system: 'SYS', turns: PROMPT.turns })
      expect(clock.sleeps).toEqual([1000])
    },
  )

  it.each<[LlmFailReason, string]>([
    ['http_429', 'LLM_FAILED'],
    ['http_4xx', 'LLM_FAILED'],
    ['bad_response', 'LLM_FAILED'],
    ['blocked', 'LLM_EMPTY'],
  ])('SRV-T-181 createLlm_does_not_retry_non_retryable: %s', async (reason, code) => {
    const { llm, provider, clock } = setup(() => [{ error: new LlmError(reason) }])
    const err = await appError(llm.complete(PROMPT))
    expect(err.code).toBe(code)
    expect(err.status).toBe(502)
    expect(provider.calls).toHaveLength(1)
    expect(clock.sleeps).toHaveLength(0)
  })

  it('SRV-T-182 createLlm_fails_after_second_failure', async () => {
    const { llm, provider, logs } = setup(() => [
      { error: new LlmError('http_5xx', { httpStatus: 503 }) },
      { error: new LlmError('timeout') },
    ])
    const err = await appError(llm.complete(PROMPT))
    expect([err.code, err.status]).toEqual(['LLM_FAILED', 502])
    expect(provider.calls).toHaveLength(2)
    const failed = logs().find(l => l.event === 'llm_failed')
    expect(failed).toMatchObject({
      attempts: 2,
      code: 'LLM_FAILED',
      reason: 'timeout',
      budget: false,
    })
  })
})

describe('시간 예산 (R-NFR-001)', () => {
  it('SRV-T-183 createLlm_total_stays_within_budget', async () => {
    const a = setup(c => [
      failAfter(c, 60_000, new LlmError('timeout')),
      failAfter(c, 5000, new LlmError('timeout')),
    ])
    await appError(a.llm.complete(PROMPT))
    expect(a.provider.calls.map(c => c.timeoutMs)).toEqual([60_000, 5000])
    expect(a.clock.now()).toBeLessThanOrEqual(LLM_BUDGET_MS)

    const b = setup(c => [failAfter(c, 64_500, new LlmError('http_5xx'))])
    await appError(b.llm.complete(PROMPT))
    expect(b.provider.calls).toHaveLength(1)
    expect(b.logs().find(l => l.event === 'llm_failed')).toMatchObject({
      budget: true,
      attempts: 1,
    })

    expect(planRetryTimeout(60_000, 1000)).toBe(60_000)
    expect(planRetryTimeout(60_000, 60_000)).toBe(5000)
    expect(planRetryTimeout(60_000, 63_500)).toBeNull()
    expect(planRetryTimeout(1000, 500)).toBe(1000)
    expect(LLM_BUDGET_MS + 4000).toBe(70_000)
  })
})

describe('로그 (R-NFR-004)', () => {
  const SENTINELS = ['SENTINEL_KEY_x9', 'SENTINEL_SYS_a1', 'SENTINEL_TURN_b2', 'SENTINEL_MSG_c3']

  const providerFetch = (statuses: number[]): typeof fetch => {
    let n = 0
    return async () => {
      const status = statuses[n] ?? 200
      n += 1
      return status === 200
        ? new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }))
        : new Response(
            JSON.stringify({ error: { status: 'UNAVAILABLE', message: SENTINELS[3] } }),
            { status },
          )
    }
  }

  const run = async (statuses: number[]) => {
    const clock = makeClock()
    const lines: string[] = []
    const provider = new GeminiProvider(
      { apiKey: SENTINELS[0] as string, model: 'm' },
      providerFetch(statuses),
    )
    const llm = createLlm({
      provider,
      timeoutMs: 60_000,
      logger: createLogger((_l, line) => lines.push(line)),
      now: clock.now,
      sleep: clock.sleep,
    })
    const prompt: Prompt = {
      system: SENTINELS[1] as string,
      turns: [{ role: 'user', text: SENTINELS[2] as string }],
    }
    const result = await llm.complete(prompt).then(
      text => ({ text }),
      (e: unknown) => ({ error: e as AppError }),
    )
    return { lines, result }
  }

  it('SRV-T-184 createLlm_logs_without_secrets_prompt_or_provider_message', async () => {
    const ok = await run([503, 200])
    expect(ok.result).toEqual({ text: 'ok' })
    const events = ok.lines.map(l => JSON.parse(l) as Record<string, unknown>)
    expect(events.map(e => e.event)).toEqual(['llm_attempt_failed', 'llm_done'])
    expect(Object.keys(events[0] as object).sort()).toEqual([
      'attempt',
      'event',
      'httpStatus',
      'level',
      'ms',
      'provider',
      'providerStatus',
      'reason',
    ])
    expect(Object.keys(events[1] as object).sort()).toEqual([
      'attempts',
      'event',
      'level',
      'ms',
      'outChars',
      'provider',
    ])

    const bad = await run([503, 503])
    const error = (bad.result as { error: AppError }).error
    expect(error.code).toBe('LLM_FAILED')
    const failedEvent = JSON.parse(bad.lines.at(-1) as string) as Record<string, unknown>
    expect(Object.keys(failedEvent).sort()).toEqual([
      'attempts',
      'budget',
      'code',
      'event',
      'level',
      'ms',
      'provider',
      'reason',
    ])

    const everything = [...ok.lines, ...bad.lines, error.message, JSON.stringify(error)].join('\n')
    for (const s of SENTINELS) expect(everything).not.toContain(s)
    expect(error.cause).toBeUndefined()
  })
})

// ---- S3b (SRV-T-221·222) — doc/200_설계/server/llm.md §12.12 ----
describe('S3b 시도별 누적·게이트 위임', () => {
  const USAGE = { promptTokens: 10, outputTokens: 2, thoughtsTokens: 1 }

  const withMeter = (steps: (clock: Clock) => FakeStep[]) => {
    const clock = makeClock()
    const provider = new FakeProvider(steps(clock))
    const recorded: LlmUsage[] = []
    let gates = 0
    const meter: UsageMeter = {
      record: async u => {
        recorded.push(u)
      },
      ensureBudget: async () => {
        gates += 1
      },
    }
    const logger = createLogger(() => undefined)
    const llm = createLlm({
      provider,
      timeoutMs: 60_000,
      logger,
      now: clock.now,
      sleep: clock.sleep,
      meter,
    })
    return { llm, recorded, gates: () => gates, provider }
  }

  it('SRV-T-221 createLlm_records_usage_per_attempt', async () => {
    // 1) 5xx(usage 없음) → 성공: 성공 응답 1회만 누적
    const a = withMeter(() => [{ error: new LlmError('http_5xx') }, { text: 'ok' }])
    expect(await a.llm.complete(PROMPT)).toBe('ok')
    expect(a.recorded).toEqual([FAKE_USAGE])
    // 2) blocked(usage) → LLM_EMPTY, 1회 누적
    const b = withMeter(() => [{ error: new LlmError('blocked', { usage: USAGE }) }])
    expect((await appError(b.llm.complete(PROMPT))).code).toBe('LLM_EMPTY')
    expect(b.recorded).toEqual([USAGE])
    // 3) 5xx(usage) → 성공: 재시도 2번 모두 누적
    const c = withMeter(() => [
      { error: new LlmError('http_5xx', { usage: USAGE }) },
      { text: 'ok' },
    ])
    expect(await c.llm.complete(PROMPT)).toBe('ok')
    expect(c.recorded).toEqual([USAGE, FAKE_USAGE])
    // 4) meter 없음: SRV-T-180 과 같은 결과
    const d = setup(c2 => [failAfter(c2, 1000, new LlmError('http_5xx')), { text: '좋아' }])
    expect(await d.llm.complete(PROMPT)).toBe('좋아')
    expect(d.provider.calls).toHaveLength(2)
  })

  it('SRV-T-222 createLlm_keeps_result_when_record_fails_and_delegates_ensureBudget', async () => {
    const clock = makeClock()
    const lines: string[] = []
    const logger = createLogger((_l, line) => lines.push(line))
    const meter = createUsageMeter({
      store: {
        get: async () => null,
        add: async () => {
          throw new Error('d1 down')
        },
      },
      config: { ...PRICING, monthlyBudgetKrw: 100000 },
      logger,
      now: clock.now,
    })
    const llm = createLlm({
      provider: new FakeProvider([{ text: '결과' }]),
      timeoutMs: 60_000,
      logger,
      now: clock.now,
      sleep: clock.sleep,
      meter,
    })
    expect(await llm.complete(PROMPT)).toBe('결과')
    const events = lines.map(l => (JSON.parse(l) as { event: string }).event)
    expect(events.filter(e => e === 'llm_usage_record_failed')).toHaveLength(1)
    expect(events).toContain('llm_done')
    // ensureBudget: meter 없음 → 즉시 resolve
    await expect(setup(() => []).llm.ensureBudget()).resolves.toBeUndefined()
    // meter 있음 → meter.ensureBudget 1회
    const spy = withMeter(() => [])
    await spy.llm.ensureBudget()
    expect(spy.gates()).toBe(1)
  })
})

describe('S3d 화자 선택 · 예산 분배 (R-LLM-008·R-NFR-001)', () => {
  const HISTORY = [
    { speaker: 'sebastian' as const, kind: 'line' as const, text: '비밀_본문_A' },
    { speaker: 'user' as const, kind: 'line' as const, text: '비밀_본문_B' },
  ]
  const selectInput = {
    history: HISTORY,
    profiles: DEFAULT_PROMPT_SETTINGS.profiles,
    common: DEFAULT_PROMPT_SETTINGS.common,
  }
  const metered = (steps: (clock: Clock) => FakeStep[], timeoutMs = 60_000) => {
    const clock = makeClock()
    const provider = new FakeProvider(steps(clock))
    const recorded: LlmUsage[] = []
    const meter: UsageMeter = {
      record: async u => {
        recorded.push(u)
      },
      ensureBudget: async () => undefined,
    }
    const lines: string[] = []
    const logger = createLogger((_l, line) => lines.push(line))
    const llm = createLlm({
      provider,
      timeoutMs,
      logger,
      now: clock.now,
      sleep: clock.sleep,
      meter,
    })
    return { llm, provider, recorded, lines, clock }
  }

  it('SRV-T-265 selectSpeaker_single_attempt_with_15s_timeout_and_usage', async () => {
    const a = metered(() => [{ text: 'ciel' }])
    const choice = await a.llm.selectSpeaker(selectInput)
    expect(choice).toMatchObject({ speaker: 'ciel', source: 'model', reason: null })
    expect(a.provider.calls).toHaveLength(1)
    expect(a.provider.calls[0]?.timeoutMs).toBe(SELECT_TIMEOUT_MS)
    expect(a.recorded).toEqual([FAKE_USAGE])
    const b = metered(() => [{ text: 'ciel' }], 3000)
    await b.llm.selectSpeaker(selectInput)
    expect(b.provider.calls[0]?.timeoutMs).toBe(3000)
  })

  it('SRV-T-266 selectSpeaker_falls_back_without_retry_and_never_throws', async () => {
    const USAGE = { promptTokens: 10, outputTokens: 2, thoughtsTokens: 1 }
    const cases: { step: FakeStep; reason: string; usage: LlmUsage[] }[] = [
      { step: { error: new LlmError('timeout') }, reason: 'timeout', usage: [] },
      { step: { error: new LlmError('network') }, reason: 'network', usage: [] },
      { step: { error: new LlmError('http_5xx') }, reason: 'http_5xx', usage: [] },
      { step: { error: new LlmError('http_429') }, reason: 'http_429', usage: [] },
      {
        step: { error: new LlmError('blocked', { usage: USAGE }) },
        reason: 'blocked',
        usage: [USAGE],
      },
      { step: { text: '모르겠다' }, reason: 'unparsable', usage: [FAKE_USAGE] },
    ]
    for (const c of cases) {
      const t = metered(() => [c.step])
      const choice = await t.llm.selectSpeaker(selectInput)
      expect(choice).toMatchObject({ speaker: 'ciel', source: 'fallback', reason: c.reason })
      expect(t.provider.calls).toHaveLength(1)
      expect(t.recorded).toEqual(c.usage)
      const joined = t.lines.join('|')
      expect(joined).toContain('speaker_select')
      expect(joined).not.toContain('모르겠다')
      expect(joined).not.toContain('비밀_본문')
    }
  })

  it('SRV-T-267 complete_spentMs_shrinks_budget', async () => {
    const a = metered(c => [failAfter(c, 1000, new LlmError('network')), { text: 'ok' }])
    expect(await a.llm.complete(PROMPT, { spentMs: 8000 })).toBe('ok')
    expect(a.provider.calls.map(x => x.timeoutMs)).toEqual([58_000, 56_000])
    const b = metered(() => [])
    expect((await appError(b.llm.complete(PROMPT, { spentMs: 65_000 }))).code).toBe('LLM_FAILED')
    expect(b.provider.calls).toHaveLength(0)
    const c = metered(c2 => [failAfter(c2, 1000, new LlmError('network')), { text: 'ok' }])
    await c.llm.complete(PROMPT)
    expect(c.provider.calls.map(x => x.timeoutMs)).toEqual([60_000, 60_000])
  })
})

describe('S3d 이름 지목 (R-LLM-008 개정)', () => {
  it('SRV-T-280 selectSpeaker_mention_skips_provider_and_usage', async () => {
    const clock = makeClock()
    const provider = new FakeProvider([{ text: 'sebastian' }])
    const recorded: LlmUsage[] = []
    const lines: string[] = []
    const logger = createLogger((_l, line) => lines.push(line))
    const meter: UsageMeter = {
      record: async u => {
        recorded.push(u)
      },
      ensureBudget: async () => undefined,
    }
    const llm = createLlm({ provider, timeoutMs: 60_000, logger, now: clock.now, meter })
    const choice = await llm.selectSpeaker({
      history: [{ speaker: 'user', kind: 'ooc', text: '시엘이 말해 줘' }],
      profiles: DEFAULT_PROMPT_SETTINGS.profiles,
      common: DEFAULT_PROMPT_SETTINGS.common,
    })
    expect(choice).toEqual({ speaker: 'ciel', source: 'mention', reason: null, ms: 0 })
    expect(provider.calls).toHaveLength(0)
    expect(recorded).toHaveLength(0)
    const log = lines.map(l => JSON.parse(l) as Record<string, unknown>)
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({ event: 'speaker_select', result: 'mention', character: 'ciel' })
    expect(lines.join('')).not.toContain('말해 줘')
  })
})

describe('S4 요약 시간 예산·사용량 (R-MEM-002·R-LLM-007)', () => {
  it('SRV-T-319 complete_budgetMs_limits_first_timeout_and_retry', async () => {
    const budget = { budgetMs: 25_000 }
    // ① 정상: 1차 타임아웃 = 25000
    const a = setup(() => [{ text: 'ok' }])
    expect(await a.llm.complete(PROMPT, budget)).toBe('ok')
    expect(a.provider.calls.map(c => c.timeoutMs)).toEqual([25_000])
    // ② 1차 timeout 이 25초를 다 씀 → 재시도 없음
    const b = setup(c => [failAfter(c, 25_000, new LlmError('timeout'))])
    expect((await appError(b.llm.complete(PROMPT, budget))).code).toBe('LLM_FAILED')
    expect(b.provider.calls).toHaveLength(1)
    const failed = b.logs().find(l => l.event === 'llm_failed')
    expect(failed).toMatchObject({ budget: true, attempts: 1 })
    // ③ 1차 network 즉시 실패(100ms) → 1초 대기 → 2차 = 25000 − 100 − 1000
    const c = setup(c2 => [failAfter(c2, 100, new LlmError('network')), { text: 'ok2' }])
    expect(await c.llm.complete(PROMPT, budget)).toBe('ok2')
    expect(c.provider.calls.map(x => x.timeoutMs)).toEqual([25_000, 23_900])
  })

  it('SRV-T-320 complete_budgetMs_minus_spentMs_and_default_unchanged', async () => {
    const a = setup(() => [{ text: 'ok' }])
    await a.llm.complete(PROMPT, { budgetMs: 25_000, spentMs: 5_000 })
    expect(a.provider.calls.map(c => c.timeoutMs)).toEqual([20_000])
    const b = setup(() => [{ text: 'ok' }])
    await b.llm.complete(PROMPT)
    await b.llm.complete(PROMPT, { spentMs: 6_000 })
    expect(b.provider.calls.map(c => c.timeoutMs)).toEqual([60_000, 60_000])
    const c = setup(() => [{ text: 'ok' }])
    await c.llm.complete(PROMPT, { spentMs: 10_000 })
    expect(c.provider.calls.map(x => x.timeoutMs)).toEqual([56_000])
  })

  it('SRV-T-321 complete_with_summary_prompt_accumulates_usage', async () => {
    const clock = makeClock()
    const store = new Map<string, UsageTotals>()
    const meter = createUsageMeter({
      store: {
        get: async month => store.get(month) ?? null,
        add: async (month, delta) => {
          const prev = store.get(month)
          const next: UsageTotals = {
            month,
            calls: (prev?.calls ?? 0) + 1,
            promptTokens: (prev?.promptTokens ?? 0) + delta.promptTokens,
            outputTokens: (prev?.outputTokens ?? 0) + delta.outputTokens,
            estKrw: (prev?.estKrw ?? 0) + delta.estKrw,
          }
          store.set(month, next)
          return next
        },
      },
      config: { ...PRICING, monthlyBudgetKrw: 100_000 },
      logger: createLogger(() => undefined),
      now: clock.now,
    })
    const llm = createLlm({
      provider: new FakeProvider([{ text: '요약' }]),
      timeoutMs: 60_000,
      logger: createLogger(() => undefined),
      now: clock.now,
      sleep: clock.sleep,
      meter,
    })
    const prompt = buildSummaryPrompt({
      previous: '',
      messages: [{ speaker: 'ciel', kind: 'line', text: '본문' }],
    })
    expect(await llm.complete(prompt, { budgetMs: SUMMARY_BUDGET_MS })).toBe('요약')
    const rows = [...store.values()]
    expect(rows).toHaveLength(1)
    expect(rows[0]?.calls).toBe(1)
    expect(rows[0]?.estKrw).toBeGreaterThan(0)
    expect(rows[0]?.promptTokens).toBe(FAKE_USAGE.promptTokens)
  })
})
