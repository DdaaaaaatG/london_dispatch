/**
 * [목적] 제공사 호출의 재시도·시간 예산·에러 변환(R-LLM-005, R-NFR-001). LlmError 를 AppError 로 바꾸는 유일한 지점. 설계 llm.md §2.3·§4.2
 * [공개 API] createLlm(deps), withRetry, planRetryTimeout, LLM_BUDGET_MS, RETRY_BACKOFF_MS, MIN_RETRY_TIMEOUT_MS, 타입 Llm·LlmDeps·RetryClock
 * [비동기] 1차 → (network·timeout·5xx 면) 1초 대기 → 2차. LLM 단계 총 소요 ≤ LLM_BUDGET_MS(66초). 시계 now·sleep 주입 가능
 * [에러] AppError LLM_FAILED(502: network·timeout·5xx 재시도 후, 429·4xx·bad_response 즉시, 예산 부족) / LLM_EMPTY(502: blocked)
 * [설정] timeoutMs(config.llmTimeoutMs, 1000~60000)·logger·now — 컨테이너가 값으로 전달. 로그에는 상태 코드·분류·길이·ms 만(R-NFR-004)
 * [테스트] server/test/llm-client.test.ts (SRV-T-180~184)
 */
import { AppError } from '../app-error'
import type { Logger } from '../logger'
import { countCodePoints } from '@shared/limits'
import { LlmError, type GenerateOutput, type LlmProvider, type Prompt } from './provider'

/** R-NFR-001: speak 전체 70초. LLM 단계 예산은 D1 왕복 여유 4초를 뺀 값 */
export const LLM_BUDGET_MS = 66_000
/** 재시도 전 대기(즉시 재시도 금지) */
export const RETRY_BACKOFF_MS = 1_000
/** 남은 예산이 이보다 짧으면 재시도하지 않는다 */
export const MIN_RETRY_TIMEOUT_MS = 2_000

export type RetryClock = {
  readonly now: () => number
  readonly sleep: (ms: number) => Promise<void>
}

type RetryHooks = {
  onAttemptFailed?: (err: LlmError, attemptNo: 1 | 2, ms: number) => void
  onBudgetSkip?: () => void
}

/** 2차 시도 타임아웃. 예산이 모자라면 null(재시도 안 함). 순수 함수 */
export const planRetryTimeout = (timeoutMs: number, elapsedMs: number): number | null => {
  // 최소 기준은 남은 예산에 건다(timeoutMs 가 1000 처럼 작아도 예산이 넉넉하면 재시도한다)
  const remaining = LLM_BUDGET_MS - elapsedMs - RETRY_BACKOFF_MS
  return remaining < MIN_RETRY_TIMEOUT_MS ? null : Math.min(timeoutMs, remaining)
}

const asLlmError = (e: unknown): LlmError =>
  e instanceof LlmError ? e : new LlmError('bad_response', { cause: e })

/** 1차 → (재시도 가능 실패면) 대기 → 2차. 최종 실패는 마지막 LlmError 를 throw */
export const withRetry = async (
  attempt: (timeoutMs: number, attemptNo: 1 | 2) => Promise<GenerateOutput>,
  timeoutMs: number,
  clock: RetryClock,
  hooks?: RetryHooks,
): Promise<GenerateOutput> => {
  const start = clock.now()
  try {
    return await attempt(Math.min(timeoutMs, LLM_BUDGET_MS), 1)
  } catch (e) {
    const first = asLlmError(e)
    const elapsed = clock.now() - start
    hooks?.onAttemptFailed?.(first, 1, elapsed)
    if (!first.retryable) throw first
    const t2 = planRetryTimeout(timeoutMs, elapsed)
    if (t2 === null) {
      hooks?.onBudgetSkip?.()
      throw first
    }
    await clock.sleep(RETRY_BACKOFF_MS)
    const secondStart = clock.now()
    try {
      return await attempt(t2, 2)
    } catch (e2) {
      const second = asLlmError(e2)
      hooks?.onAttemptFailed?.(second, 2, clock.now() - secondStart)
      throw second
    }
  }
}

export type Llm = {
  /** 제공사 응답 원문 text(후처리 전). 실패 → AppError LLM_FAILED / LLM_EMPTY */
  complete: (prompt: Prompt) => Promise<string>
}

export type LlmDeps = {
  provider: LlmProvider
  /** config.llmTimeoutMs (1000~60000) */
  timeoutMs: number
  logger: Logger
  now: () => number
  /** 기본 setTimeout 기반. 테스트는 가짜 시계와 함께 주입 */
  sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

/** LlmError → AppError. 제공사 상태·원인은 응답에 넣지 않는다 */
const toAppError = (err: LlmError): AppError =>
  new AppError(err.reason === 'blocked' ? 'LLM_EMPTY' : 'LLM_FAILED')

/** Llm 을 만든다. 요청마다 새로 만든다(상태는 호출 안의 지역 변수뿐) */
export const createLlm = (deps: LlmDeps): Llm => {
  const { provider, timeoutMs, logger, now } = deps
  const clock: RetryClock = { now, sleep: deps.sleep ?? defaultSleep }

  const complete = async (prompt: Prompt): Promise<string> => {
    const start = now()
    let attempts = 0
    let budget = false
    try {
      const out = await withRetry(
        (t, attemptNo) => {
          attempts = attemptNo
          return provider.generate({ system: prompt.system, turns: prompt.turns, timeoutMs: t })
        },
        timeoutMs,
        clock,
        {
          onAttemptFailed: (err, attemptNo, ms) =>
            logger.warn('llm_attempt_failed', {
              provider: provider.name,
              attempt: attemptNo,
              reason: err.reason,
              httpStatus: err.httpStatus,
              providerStatus: err.providerStatus,
              finishReason: err.finishReason,
              ms,
            }),
          onBudgetSkip: () => {
            budget = true
          },
        },
      )
      logger.info('llm_done', {
        provider: provider.name,
        attempts,
        outChars: countCodePoints(out.text),
        ms: now() - start,
      })
      return out.text
    } catch (e) {
      const err = asLlmError(e)
      const appError = toAppError(err)
      logger.error('llm_failed', {
        provider: provider.name,
        code: appError.code,
        reason: err.reason,
        attempts,
        budget,
        ms: now() - start,
      })
      throw appError
    }
  }
  return { complete }
}
