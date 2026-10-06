// SRV-T-180~184 — doc/200_설계/server/llm.md §8 (재시도·예산·로그). 실제 타이머 없이 가짜 시계로 검증한다
import { describe, expect, it } from 'vitest'
import { AppError } from '../src/app-error'
import {
  createLlm,
  FakeProvider,
  LLM_BUDGET_MS,
  planRetryTimeout,
  type FakeStep,
  type Prompt,
} from '../src/llm'
import { GeminiProvider } from '../src/llm/gemini'
import { LlmError, type LlmFailReason } from '../src/llm/provider'
import { createLogger } from '../src/logger'

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
