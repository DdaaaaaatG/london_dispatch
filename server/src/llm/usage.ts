/**
 * [목적] 월(KST) AI 사용량 추정 누적과 예산 게이트(R-LLM-007 🔒). 설계 llm.md §12
 * [공개 API] createUsageMeter(deps) -> UsageMeter { ensureBudget, record }, kstMonthKey, nextKstMonthStartMs, budgetRetryAfterSec, estimateKrw, KST_OFFSET_MS, 타입 LlmUsage·UsagePricing·UsageMeterConfig·UsageTotals·UsageDelta·UsageStore·UsageMeter·UsageMeterDeps
 * [비동기] ensureBudget 은 store.get 1회 await(D1 읽기 1행). record 는 store.add 1회 await 이고 절대 throw 하지 않는다
 * [에러] AppError LLM_BUDGET_EXCEEDED(429, retryAfterSec = 다음 달 1일 00:00 KST 까지 초). 저장소 읽기 오류는 그대로 전파(닫힌 실패, D-LLM-22). record 실패는 warn 로그만
 * [설정] monthlyBudgetKrw·priceInputUsdPerM·priceOutputUsdPerM·krwPerUsd 를 컨테이너가 Config 에서 골라 값으로 전달. 로그에는 month·calls·정수 원·pct 만(토큰 개별 값·본문 없음)
 * [테스트] server/test/llm-usage.test.ts (SRV-T-210~217), llm-client.test.ts (SRV-T-221·222)
 */
import { AppError } from '../app-error'
import type { Logger } from '../logger'

/** 응답 1건의 토큰 수. 어댑터가 제공사 형식에서 옮긴다. 0 이상 정수 */
export type LlmUsage = {
  /** Gemini promptTokenCount */
  readonly promptTokens: number
  /** Gemini candidatesTokenCount */
  readonly outputTokens: number
  /** Gemini thoughtsTokenCount (사고 토큰 — 출력 단가로 청구) */
  readonly thoughtsTokens: number
}

/** 단가·환율. 컨테이너가 Config 에서 골라 넘긴다 */
export type UsagePricing = {
  readonly priceInputUsdPerM: number
  readonly priceOutputUsdPerM: number
  readonly krwPerUsd: number
}
export type UsageMeterConfig = UsagePricing & { readonly monthlyBudgetKrw: number }

/** 월 누적 행. db LlmUsageTotals 와 같은 모양(구조적 호환) */
export type UsageTotals = {
  /** 'YYYY-MM' (KST) */
  readonly month: string
  readonly calls: number
  readonly promptTokens: number
  /** candidates + thoughts 합 */
  readonly outputTokens: number
  /** 소수 보존(D-LLM-17) */
  readonly estKrw: number
}
export type UsageDelta = {
  readonly promptTokens: number
  /** candidates + thoughts */
  readonly outputTokens: number
  readonly estKrw: number
}

/** 저장소 포트. db.llmUsage(LlmUsageRepo)가 구조적으로 만족한다 — llm 은 db 를 import 하지 않는다(D-LLM-16) */
export type UsageStore = {
  readonly add: (month: string, delta: UsageDelta, nowMs: number) => Promise<UsageTotals>
  readonly get: (month: string) => Promise<UsageTotals | null>
}

export type UsageMeter = {
  /** 이번 달 누적 ≥ 예산이면 AppError('LLM_BUDGET_EXCEEDED', undefined, { retryAfterSec }). 저장소 오류는 전파(D-LLM-22) */
  readonly ensureBudget: () => Promise<void>
  /** 응답 1건 누적. 절대 throw 하지 않는다(실패는 warn 로그) */
  readonly record: (usage: LlmUsage) => Promise<void>
}

export type UsageMeterDeps = {
  store: UsageStore
  config: UsageMeterConfig
  logger: Logger
  now: () => number
}

/** 9시간. 한국은 서머타임이 없어 고정 오프셋이 정확하다(D-LLM-23) */
export const KST_OFFSET_MS = 32_400_000
const TOKENS_PER_UNIT = 1_000_000
const MS_PER_SEC = 1000
const MONTH_PAD = 2

/** 'YYYY-MM' (KST). UTC 게터로 읽으면 KST 벽시계다 */
export const kstMonthKey = (nowMs: number): string => {
  const kst = new Date(nowMs + KST_OFFSET_MS)
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(MONTH_PAD, '0')}`
}

/** 다음 달 1일 00:00 KST 의 epoch ms (12월 → 다음 해 1월은 Date.UTC 가 넘긴다) */
export const nextKstMonthStartMs = (nowMs: number): number => {
  const kst = new Date(nowMs + KST_OFFSET_MS)
  return Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth() + 1, 1) - KST_OFFSET_MS
}

/** 해제까지 남은 초(올림, 최소 1) */
export const budgetRetryAfterSec = (nowMs: number): number =>
  Math.max(1, Math.ceil((nextKstMonthStartMs(nowMs) - nowMs) / MS_PER_SEC))

/** 추정 원화(소수, 반올림 없음). 사고 토큰은 출력 단가로 계산한다 */
export const estimateKrw = (usage: LlmUsage, pricing: UsagePricing): number =>
  ((usage.promptTokens * pricing.priceInputUsdPerM +
    (usage.outputTokens + usage.thoughtsTokens) * pricing.priceOutputUsdPerM) /
    TOKENS_PER_UNIT) *
  pricing.krwPerUsd

const errName = (e: unknown): string => (e instanceof Error ? e.name : 'unknown')

/** 사용량 미터를 만든다. 요청마다 새로 만든다(상태 없음) */
export const createUsageMeter = (deps: UsageMeterDeps): UsageMeter => {
  const { store, config, logger, now } = deps

  const ensureBudget = async (): Promise<void> => {
    const month = kstMonthKey(now())
    const row = await store.get(month)
    const estKrw = row?.estKrw ?? 0
    if (estKrw < config.monthlyBudgetKrw) return
    logger.warn('llm_budget_exceeded', {
      month,
      estKrw: Math.round(estKrw),
      budgetKrw: config.monthlyBudgetKrw,
    })
    throw new AppError('LLM_BUDGET_EXCEEDED', undefined, {
      retryAfterSec: budgetRetryAfterSec(now()),
    })
  }

  const record = async (usage: LlmUsage): Promise<void> => {
    const month = kstMonthKey(now())
    try {
      const delta: UsageDelta = {
        promptTokens: usage.promptTokens,
        outputTokens: usage.outputTokens + usage.thoughtsTokens,
        estKrw: estimateKrw(usage, config),
      }
      const totals = await store.add(month, delta, now())
      logger.info('llm_usage', {
        month,
        calls: totals.calls,
        estKrw: Math.round(totals.estKrw),
        budgetKrw: config.monthlyBudgetKrw,
        pct: Math.floor((totals.estKrw / config.monthlyBudgetKrw) * 100),
      })
    } catch (e) {
      logger.warn('llm_usage_record_failed', { month, errName: errName(e) })
    }
  }

  return { ensureBudget, record }
}
