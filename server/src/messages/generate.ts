/**
 * [목적] 캐릭터 1턴 생성(speak, R-MSG-003)과 마지막 캐릭터 메시지 재작성(regenerate, R-MSG-006). 방 단위 잠금(R-MSG-007)·updated_at 갱신(R-ROOM-005)·응답 뒤 훅 자리(R-MEM-002). 설계 messages.md §2.3·§4.2·§4.3
 * [공개 API] createGenerateOps(deps) -> { speak, regenerate }, SPEAK_LOCK_MS, 타입 SpeakInput·Background·AfterSpeakEvent·AfterSpeakHook·GenerateDeps·GenerateOps
 * [비동기] llm() 확인 → 잠금 선점 → Promise.all(pageDesc ∥ getSummary) → llm.complete → 저장 → finally 해제(실패는 warn 로그만). afterSpeak 는 background.waitUntil 로 등록
 * [에러] VALIDATION_ERROR·NOT_FOUND·SPEAK_IN_PROGRESS·NOT_LAST_MESSAGE·NOT_CHARACTER_MESSAGE, llm 의 LLM_FAILED·LLM_EMPTY 와 CONFIG_INVALID 는 그대로 전파
 * [설정] contextMessages(config.contextMessages)와 llm 지연 생성 함수를 deps 값으로 받는다. 바인딩을 읽지 않는다
 * [테스트] server/test/messages-generate.test.ts (SRV-T-191~209)
 */
import type { SpeakBody } from '@shared/types'
import { AppError } from '../app-error'
import type { Db, Message } from '../db'
import { buildSpeakPrompt, isCharacterId, postprocessLine, type Llm } from '../llm'
import type { Logger } from '../logger'
import { isMessageId } from './text'

/** = @shared/types SpeakBody */
export type SpeakInput = SpeakBody
/** 응답 뒤 작업 등록기. 라우트가 c.executionCtx.waitUntil 을 감싸 넘긴다 */
export type Background = { waitUntil: (task: Promise<unknown>) => void }
export type AfterSpeakEvent = { roomId: string; messageId: number }
/** speak 성공 뒤 waitUntil 로 실행되는 훅. 실패는 서비스가 잡아 로그만 남긴다 */
export type AfterSpeakHook = (event: AfterSpeakEvent) => Promise<void>

/** R-MSG-007: 잠금 만료 90초. R-NFR-001 상한 70초보다 길다 */
export const SPEAK_LOCK_MS = 90_000

export type GenerateDeps = {
  db: Db
  now: () => number
  logger: Logger
  /** config.contextMessages (1~100) */
  contextMessages: number
  /** 지연 생성. 부를 때 키를 확인한다 */
  llm: () => Llm
  /** 없으면 no-op(S4 가 채운다) */
  afterSpeak?: AfterSpeakHook
}

export type GenerateOps = {
  /** 캐릭터 1턴 생성·저장 */
  speak: (roomId: string, input: SpeakInput, background: Background) => Promise<Message>
  /** 마지막 캐릭터 메시지를 같은 캐릭터로 다시 생성 */
  regenerate: (messageId: number) => Promise<Message>
}

const ROOM_NOT_FOUND_MESSAGE = '방을 찾을 수 없습니다.'
const MESSAGE_NOT_FOUND_MESSAGE = '메시지를 찾을 수 없습니다.'
const CHARACTER_INVALID_MESSAGE = '캐릭터는 sebastian 또는 ciel 중 하나여야 합니다.'

const roomNotFound = (): AppError => new AppError('NOT_FOUND', ROOM_NOT_FOUND_MESSAGE)
const messageNotFound = (): AppError => new AppError('NOT_FOUND', MESSAGE_NOT_FOUND_MESSAGE)
const errName = (e: unknown): string => (e instanceof Error ? e.name : 'unknown')

/** speak·regenerate 를 만든다 */
export const createGenerateOps = (deps: GenerateDeps): GenerateOps => {
  const { db, now, logger, contextMessages } = deps

  const releaseQuietly = async (roomId: string, untilMs: number): Promise<void> => {
    try {
      await db.rooms.releaseSpeakLock(roomId, untilMs)
    } catch (e) {
      logger.warn('speak_lock_release_failed', { roomId, errName: errName(e) })
    }
  }

  /** 선점 → 작업 → finally 해제. onMissing 은 방이 없을 때 던질 에러 */
  const withSpeakLock = async <T>(
    roomId: string,
    onMissing: () => AppError,
    task: () => Promise<T>,
  ): Promise<T> => {
    const startMs = now()
    const untilMs = startMs + SPEAK_LOCK_MS
    const acquired = await db.rooms.acquireSpeakLock(roomId, untilMs, startMs)
    if (acquired === 'missing') throw onMissing()
    if (acquired === 'busy') throw new AppError('SPEAK_IN_PROGRESS')
    try {
      return await task()
    } finally {
      await releaseQuietly(roomId, untilMs)
    }
  }

  const runAfterSpeak = async (hook: AfterSpeakHook, event: AfterSpeakEvent): Promise<void> => {
    try {
      await hook(event)
    } catch (e) {
      logger.warn('after_speak_failed', { roomId: event.roomId, errName: errName(e) })
    }
  }

  const speak: GenerateOps['speak'] = async (roomId, input, background) => {
    const character: unknown = input?.character
    if (!isCharacterId(character)) throw new AppError('VALIDATION_ERROR', CHARACTER_INVALID_MESSAGE)
    const llm = deps.llm()
    const startMs = now()
    const saved = await withSpeakLock(roomId, roomNotFound, async () => {
      const [rowsDesc, summary] = await Promise.all([
        db.messages.pageDesc(roomId, contextMessages),
        db.memory.getSummary(roomId),
      ])
      const prompt = buildSpeakPrompt({ character, summary, history: [...rowsDesc].reverse() })
      const text = postprocessLine(await llm.complete(prompt))
      const row = await db.messages.insert(
        { roomId, speaker: character, kind: 'line', text, authorMbId: null, authorName: null },
        now(),
      )
      if (row === null) throw roomNotFound()
      return row
    })
    const hook = deps.afterSpeak
    if (hook !== undefined) {
      background.waitUntil(runAfterSpeak(hook, { roomId, messageId: saved.id }))
    }
    logger.info('speak_done', { roomId, messageId: saved.id, character, ms: now() - startMs })
    return saved
  }

  const regenerate: GenerateOps['regenerate'] = async messageId => {
    if (!isMessageId(messageId)) throw messageNotFound()
    const target = await db.messages.getById(messageId)
    if (target === null) throw messageNotFound()
    if (target.speaker === 'user') throw new AppError('NOT_CHARACTER_MESSAGE')
    const character = target.speaker
    const llm = deps.llm()
    const startMs = now()
    const saved = await withSpeakLock(target.roomId, messageNotFound, async () => {
      const [rowsDesc, summary] = await Promise.all([
        db.messages.pageDesc(target.roomId, contextMessages + 1),
        db.memory.getSummary(target.roomId),
      ])
      const head = rowsDesc[0]
      if (head === undefined || head.id < messageId) throw messageNotFound()
      if (head.id > messageId) throw new AppError('NOT_LAST_MESSAGE')
      const history = rowsDesc.slice(1).reverse()
      const prompt = buildSpeakPrompt({ character, summary, history })
      const text = postprocessLine(await llm.complete(prompt))
      const row = await db.messages.updateText(messageId, text, now())
      if (row === null) throw messageNotFound()
      return row
    })
    logger.info('regenerate_done', {
      roomId: target.roomId,
      messageId,
      character,
      ms: now() - startMs,
    })
    return saved
  }

  return { speak, regenerate }
}
