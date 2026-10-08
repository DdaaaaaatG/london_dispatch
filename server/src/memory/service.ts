/**
 * [목적] 방 단위 장기기억(요약): 조회·편집(R-MEM-001 🔒)과 speak 뒤 자동 요약(R-MEM-002 🔒). 중복 요약은 memory 행 조건부 UPSERT 로 막는다(R-MEM-003). 요약 호출도 월 예산에 누적·게이트(R-LLM-007). 설계 memory.md §2·§4·§5
 * [공개 API] createMemoryService(deps) -> MemoryService { get, put, summarizeIfNeeded }, 타입 MemoryState·PutMemoryInput·SummarizeOutcome·SummarizeStage·MemoryDeps
 * [비동기] get·put 은 D1 1~2회. summarizeIfNeeded: 읽기 → (기준 초과면) 예산 확인 → 대상 읽기 → llm.complete(≤ 25초) → 조건부 UPSERT 1회. 어떤 실패도 throw 하지 않고 로그 + 결과로 돌려준다
 * [에러] get·put: AppError VALIDATION_ERROR(summary 가 문자열 아님·4000자 초과)·NOT_FOUND(방 없음), D1 오류 전파. summarizeIfNeeded: 없음(failed{stage, code})
 * [설정] contextMessages(config.contextMessages)·summaryThreshold(config.memorySummaryThreshold)·llm 지연 생성 함수를 deps 값으로 받는다. 바인딩을 읽지 않는다. 요약 본문·메시지 본문·프롬프트는 로그에 넣지 않는다(길이·id·ms 만)
 * [테스트] server/test/memory.test.ts (SRV-T-299~315, 332~333)
 */
import { countCodePoints, MEMORY_SUMMARY_MAX, normalizeText } from '@shared/limits'
import type { MemoryResponse, PutMemoryBody } from '@shared/types'
import { AppError } from '../app-error'
import type { Db, MemoryRecord } from '../db'
import { buildSummaryPrompt, postprocessSummary, SUMMARY_BUDGET_MS, type Llm } from '../llm'
import type { Logger } from '../logger'
import { capByChars, fitSummary, pendingCountCap, planSummary } from './summarize'

/** = @shared/types MemoryResponse. 행이 없으면 { summary: '', sourceUntilId: 0, updatedAt: null } */
export type MemoryState = MemoryResponse
/** = @shared/types PutMemoryBody */
export type PutMemoryInput = PutMemoryBody

export type SummarizeStage = 'read' | 'budget' | 'llm' | 'write'
/** 요약 1회의 결과. summarizeIfNeeded 는 throw 하지 않고 이것을 돌려준다(테스트 단언용, 훅은 버린다) */
export type SummarizeOutcome =
  | { readonly status: 'skipped'; readonly reason: 'below_threshold' | 'empty_range' | 'budget' }
  | {
      readonly status: 'summarized'
      /** 이번에 반영한 마지막 messages.id (= 새 source_until_id) */
      readonly untilId: number
      readonly messages: number
      readonly truncated: boolean
    }
  | { readonly status: 'conflict' }
  | { readonly status: 'failed'; readonly stage: SummarizeStage; readonly code: string }

export type MemoryDeps = {
  db: Db
  now: () => number
  logger: Logger
  /** config.contextMessages (1~100) */
  contextMessages: number
  /** config.memorySummaryThreshold (2~1000, > contextMessages — parseEnv 가 보장) */
  summaryThreshold: number
  /** 지연 생성. 요약이 필요할 때만 부른다(키 확인 포함) */
  llm: () => Promise<Llm>
}

export type MemoryService = {
  /** 방의 장기기억. 행 없음 → 기본값. 방 없음 → NOT_FOUND */
  get: (roomId: string) => Promise<MemoryState>
  /** summary 교체(trim, 0~4000 코드 포인트). source_until_id 유지, 단 trim 후 빈 요약이면 0 으로 리셋(다음 speak 때 처음부터 재요약). 행이 없으면 만든다(source 0) */
  put: (roomId: string, input: PutMemoryInput) => Promise<MemoryState>
  /** speak 뒤 훅 본체. 기준 초과면 오래된 구간을 요약해 합치고 전진. 절대 throw 하지 않는다 */
  summarizeIfNeeded: (roomId: string) => Promise<SummarizeOutcome>
}

const SUMMARY_INVALID_MESSAGE = `장기기억은 0~${MEMORY_SUMMARY_MAX}자로 입력해 주세요.`
const ROOM_NOT_FOUND_MESSAGE = '방을 찾을 수 없습니다.'
const EMPTY_STATE: MemoryState = { summary: '', sourceUntilId: 0, updatedAt: null }

const roomNotFound = (): AppError => new AppError('NOT_FOUND', ROOM_NOT_FOUND_MESSAGE)
const toState = (r: MemoryRecord): MemoryState => ({
  summary: r.summary,
  sourceUntilId: r.sourceUntilId,
  updatedAt: r.updatedAt,
})
const codeOf = (e: unknown): string => (e instanceof AppError ? e.code : 'INTERNAL')
const nameOf = (e: unknown): string => (e instanceof Error ? e.name : 'unknown')

/** 읽을 때의 값(없으면 빈 기본값)과 이번 요약 개수 */
type Plan = { base: { summary: string; sourceUntilId: number }; take: number }

/** memory 서비스를 만든다. 생성 시 db·llm 에 손대지 않는다 */
export const createMemoryService = (deps: MemoryDeps): MemoryService => {
  const { db, now, logger } = deps

  const get: MemoryService['get'] = async roomId => {
    if (!(await db.rooms.exists(roomId))) throw roomNotFound()
    const record = await db.memory.getState(roomId)
    return record === null ? EMPTY_STATE : toState(record)
  }

  const put: MemoryService['put'] = async (roomId, input) => {
    const raw: unknown = input?.summary
    if (typeof raw !== 'string') throw new AppError('VALIDATION_ERROR', SUMMARY_INVALID_MESSAGE)
    const summary = normalizeText(raw)
    if (countCodePoints(summary) > MEMORY_SUMMARY_MAX) {
      throw new AppError('VALIDATION_ERROR', SUMMARY_INVALID_MESSAGE)
    }
    const record = await db.memory.putSummary(roomId, summary, now())
    if (record === null) throw roomNotFound()
    return toState(record)
  }

  /** ①②③: 읽기·기준 판정. 기준 이하면 null */
  const plan = async (roomId: string): Promise<Plan | null> => {
    const state = await db.memory.getState(roomId)
    const base = { summary: state?.summary ?? '', sourceUntilId: state?.sourceUntilId ?? 0 }
    const cap = pendingCountCap(deps.summaryThreshold, deps.contextMessages)
    const pending = await db.messages.countAfter(roomId, base.sourceUntilId, cap)
    const take = planSummary(pending, deps.summaryThreshold, deps.contextMessages)
    return take === 0 ? null : { base, take }
  }

  /** ④: 예산 게이트. 초과면 llm 대신 null(건너뜀), 그 밖의 실패는 던진다 */
  const gate = async (roomId: string): Promise<Llm | null> => {
    const llm = await deps.llm()
    try {
      await llm.ensureBudget()
    } catch (e) {
      if (!(e instanceof AppError) || e.code !== 'LLM_BUDGET_EXCEEDED') throw e
      logger.info('memory_summary_skipped', { roomId, reason: 'budget' })
      return null
    }
    return llm
  }

  type Stage = { current: SummarizeStage }

  const run = async (roomId: string, stage: Stage, startMs: number): Promise<SummarizeOutcome> => {
    const planned = await plan(roomId)
    if (planned === null) return { status: 'skipped', reason: 'below_threshold' }
    const { base, take } = planned
    stage.current = 'budget'
    const llm = await gate(roomId)
    if (llm === null) return { status: 'skipped', reason: 'budget' }
    stage.current = 'read'
    const batch = capByChars(await db.messages.listAfter(roomId, base.sourceUntilId, take))
    const last = batch[batch.length - 1]
    if (last === undefined) return { status: 'skipped', reason: 'empty_range' }
    stage.current = 'llm'
    const prompt = buildSummaryPrompt({ previous: base.summary, messages: batch })
    const raw = await llm.complete(prompt, { budgetMs: SUMMARY_BUDGET_MS })
    const { text, truncated } = fitSummary(postprocessSummary(raw))
    stage.current = 'write'
    const ok = await db.memory.advance(
      roomId,
      { summary: text, sourceUntilId: last.id },
      base,
      now(),
    )
    const ms = now() - startMs
    if (!ok) {
      logger.info('memory_summary_conflict', { roomId, expectedUntilId: base.sourceUntilId, ms })
      return { status: 'conflict' }
    }
    logger.info('memory_summarized', {
      roomId,
      fromId: base.sourceUntilId,
      untilId: last.id,
      messages: batch.length,
      inChars: batch.reduce((n, m) => n + countCodePoints(m.text), 0),
      outChars: countCodePoints(text),
      truncated,
      ms,
    })
    return { status: 'summarized', untilId: last.id, messages: batch.length, truncated }
  }

  const summarizeIfNeeded: MemoryService['summarizeIfNeeded'] = async roomId => {
    const startMs = now()
    const stage: Stage = { current: 'read' }
    try {
      return await run(roomId, stage, startMs)
    } catch (e) {
      const code = codeOf(e)
      logger.warn('memory_summary_failed', {
        roomId,
        stage: stage.current,
        code,
        errName: nameOf(e),
        ms: now() - startMs,
      })
      return { status: 'failed', stage: stage.current, code }
    }
  }

  return { get, put, summarizeIfNeeded }
}
