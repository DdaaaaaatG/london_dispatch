/**
 * [목적] 제공사 호출의 재시도·시간 예산·에러 변환(R-LLM-005, R-NFR-001). LlmError 를 AppError 로 바꾸는 유일한 지점. 설계 llm.md §2.3·§4.2
 * [공개 API] createLlm(deps) -> Llm{ complete(prompt, options?), ensureBudget, selectSpeaker(S3d) }, withRetry, planRetryTimeout, LLM_BUDGET_MS, RETRY_BACKOFF_MS, MIN_RETRY_TIMEOUT_MS, 타입 Llm·LlmDeps·RetryClock·CompleteOptions·SelectSpeakerInput
 * [비동기] 1차 → (network·timeout·5xx 면) 1초 대기 → 2차. LLM 단계 총 소요 ≤ LLM_BUDGET_MS(66초, S3d: complete 는 66초 − spentMs). selectSpeaker 는 1회 시도(≤ 15초, 이름 지목이면 호출 0회)·재시도 없음·throw 없음. 시계 now·sleep 주입 가능
 * [에러] AppError LLM_FAILED(502: network·timeout·5xx 재시도 후, 429·4xx·bad_response 즉시, 예산 부족) / LLM_EMPTY(502: blocked)
 * [설정] timeoutMs(config.llmTimeoutMs, 1000~60000)·logger·now·meter(S3b, UsageMeter — 시도마다 usage 누적·ensureBudget 위임) — 컨테이너가 값으로 전달. 로그에는 상태 코드·분류·길이·ms 만(R-NFR-004)
 * [테스트] server/test/llm-client.test.ts (SRV-T-180~184, 221·222, 265~267)
 */
import { AppError } from '../app-error'
import type { Logger } from '../logger'
import { countCodePoints } from '@shared/limits'
import { LlmError, type GenerateOutput, type LlmProvider, type Prompt } from './provider'
import {
  SELECT_TIMEOUT_MS,
  buildSelectPrompt,
  fallbackSpeaker,
  mentionedSpeaker,
  parseSpeakerChoice,
  type SelectFallbackReason,
  type SelectPromptInput,
  type SpeakerChoice,
} from './select'
import type { CharacterProfile, CommonPrompt } from './characters'
import type { CharacterId } from '@shared/types'
import type { UsageMeter } from './usage'

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
export const planRetryTimeout = (
  timeoutMs: number,
  elapsedMs: number,
  budgetMs: number = LLM_BUDGET_MS,
): number | null => {
  // 최소 기준은 남은 예산에 건다(timeoutMs 가 1000 처럼 작아도 예산이 넉넉하면 재시도한다)
  const remaining = budgetMs - elapsedMs - RETRY_BACKOFF_MS
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
  budgetMs: number = LLM_BUDGET_MS,
): Promise<GenerateOutput> => {
  const start = clock.now()
  try {
    return await attempt(Math.min(timeoutMs, budgetMs), 1)
  } catch (e) {
    const first = asLlmError(e)
    const elapsed = clock.now() - start
    hooks?.onAttemptFailed?.(first, 1, elapsed)
    if (!first.retryable) throw first
    const t2 = planRetryTimeout(timeoutMs, elapsed, budgetMs)
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

export type CompleteOptions = {
  /** 같은 요청에서 이미 쓴 LLM 단계 시간(ms, 화자 선택). 발화 예산 = LLM_BUDGET_MS − spentMs. 기본 0 */
  readonly spentMs?: number
}
export type SelectSpeakerInput = SelectPromptInput & {
  readonly profiles: Readonly<Record<CharacterId, CharacterProfile>>
  readonly common: CommonPrompt
}

export type Llm = {
  /** 제공사 응답 원문 text(후처리 전). 실패 → AppError LLM_FAILED / LLM_EMPTY */
  complete: (prompt: Prompt, options?: CompleteOptions) => Promise<string>
  /** S3d. 1회 시도(≤ SELECT_TIMEOUT_MS, 재시도 없음), usage 누적. throw 하지 않는다 — 실패는 fallbackSpeaker */
  selectSpeaker: (input: SelectSpeakerInput) => Promise<SpeakerChoice>
  /** S3b. meter 가 있으면 meter.ensureBudget(), 없으면 즉시 resolve. 초과면 AppError LLM_BUDGET_EXCEEDED */
  ensureBudget: () => Promise<void>
}

export type LlmDeps = {
  provider: LlmProvider
  /** config.llmTimeoutMs (1000~60000) */
  timeoutMs: number
  logger: Logger
  now: () => number
  /** 기본 setTimeout 기반. 테스트는 가짜 시계와 함께 주입 */
  sleep?: (ms: number) => Promise<void>
  /** S3b. 없으면 누적·게이트 없음(기존 테스트 하위 호환). 컨테이너는 항상 넣는다 */
  meter?: UsageMeter
}

const defaultSleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

/** LlmError → AppError. 제공사 상태·원인은 응답에 넣지 않는다 */
const toAppError = (err: LlmError): AppError =>
  new AppError(err.reason === 'blocked' ? 'LLM_EMPTY' : 'LLM_FAILED')

/** Llm 을 만든다. 요청마다 새로 만든다(상태는 호출 안의 지역 변수뿐) */
export const createLlm = (deps: LlmDeps): Llm => {
  const { provider, timeoutMs, logger, now, meter } = deps
  const clock: RetryClock = { now, sleep: deps.sleep ?? defaultSleep }

  /** 시도 1회 + 사용량 누적(성공·차단·형식 불일치 응답 모두). 누적 실패는 meter 가 삼킨다 */
  const attemptOnce = async (prompt: Prompt, t: number): Promise<GenerateOutput> => {
    try {
      const out = await provider.generate({
        system: prompt.system,
        turns: prompt.turns,
        timeoutMs: t,
      })
      if (out.usage !== undefined) await meter?.record(out.usage)
      return out
    } catch (e) {
      if (e instanceof LlmError && e.usage !== undefined) await meter?.record(e.usage)
      throw e
    }
  }

  /** 시도 실패 1건 로그. 상태·분류·시간만(원문·키 없음) */
  const logAttemptFailed = (err: LlmError, attemptNo: 1 | 2, ms: number): void => {
    logger.warn('llm_attempt_failed', {
      provider: provider.name,
      attempt: attemptNo,
      reason: err.reason,
      httpStatus: err.httpStatus,
      providerStatus: err.providerStatus,
      finishReason: err.finishReason,
      ms,
    })
  }

  const complete = async (prompt: Prompt, options?: CompleteOptions): Promise<string> => {
    const start = now()
    const budgetMs = LLM_BUDGET_MS - (options?.spentMs ?? 0)
    let attempts = 0
    let budget = false
    try {
      if (budgetMs < MIN_RETRY_TIMEOUT_MS) {
        budget = true
        throw new LlmError('timeout')
      }
      const out = await withRetry(
        (t, attemptNo) => {
          attempts = attemptNo
          return attemptOnce(prompt, t)
        },
        timeoutMs,
        clock,
        {
          onAttemptFailed: logAttemptFailed,
          onBudgetSkip: () => {
            budget = true
          },
        },
        budgetMs,
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
  const ensureBudget = async (): Promise<void> => {
    await meter?.ensureBudget()
  }

  /** 선택 호출 1회. 실패·해석 불가는 모두 기본 화자(throw 없음). 로그에 모델 응답 원문을 넣지 않는다 */
  const selectSpeaker = async (input: SelectSpeakerInput): Promise<SpeakerChoice> => {
    const start = now()
    const mentioned = mentionedSpeaker(input.history)
    if (mentioned !== null) {
      logger.info('speaker_select', {
        provider: provider.name,
        result: 'mention',
        character: mentioned,
        ms: 0,
      })
      return { speaker: mentioned, source: 'mention', reason: null, ms: 0 }
    }
    const prompt = buildSelectPrompt(input, input.profiles, input.common)
    let id: CharacterId | null = null
    let reason: SelectFallbackReason | null = null
    let httpStatus: number | undefined
    let outChars: number | undefined
    try {
      const out = await attemptOnce(prompt, Math.min(SELECT_TIMEOUT_MS, timeoutMs))
      outChars = countCodePoints(out.text)
      id = parseSpeakerChoice(out.text)
      if (id === null) reason = 'unparsable'
    } catch (e) {
      const err = asLlmError(e)
      reason = err.reason
      httpStatus = err.httpStatus
    }
    const speaker = id ?? fallbackSpeaker(input.history)
    const source: SpeakerChoice['source'] = id === null ? 'fallback' : 'model'
    const ms = now() - start
    logger.info('speaker_select', {
      provider: provider.name,
      result: source,
      reason,
      httpStatus,
      outChars,
      ms,
    })
    return { speaker, source, reason, ms }
  }
  return { complete, ensureBudget, selectSpeaker }
}
