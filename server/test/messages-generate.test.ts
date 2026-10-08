// SRV-T-191~209, 326 - doc/200_설계/server/messages.md 8.2, 13.4 (speak·regenerate·잠금). D1 + FakeProvider + 가짜 시계
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '../src/app-error'
import type { CharacterSettings } from '@shared/types'
import { validSettings } from '../../shared/test/settings-vectors'
import { createDb, type Db } from '../src/db'
import { ConfigError, parseEnv } from '../src/env'
import {
  budgetRetryAfterSec,
  buildSpeakPrompt,
  createLlm,
  createUsageMeter,
  FAKE_USAGE,
  FakeProvider,
  kstMonthKey,
  type FakeStep,
  type Llm,
  DEFAULT_PROMPT_SETTINGS,
  type PromptSettings,
} from '../src/llm'
import { LlmError } from '../src/llm/provider'
import { createLogger } from '../src/logger'
import { createMessagesService, SPEAK_LOCK_MS, type MessagesService } from '../src/messages'
import { createServices } from '../src/services'
import { createSettingsService } from '../src/settings'
import { insertLine, insertRoom, insertUsage, resetDb, usageRow } from './helpers'

const T0 = 1_000_000

type Log = { level: string; event: string; [k: string]: unknown }

type Setup = {
  svc: MessagesService
  db: Db
  fake: FakeProvider
  logs: Log[]
  clock: { t: number }
  waits: Promise<unknown>[]
  bg: { waitUntil: (p: Promise<unknown>) => void }
}

type SetupOptions = {
  now?: number
  contextMessages?: number
  wrapDb?: (db: Db) => Db
  /** S3b: 월 비용 meter 를 단다(예산 100000원 · 기본 단가) */
  meter?: boolean
  afterSpeak?: (e: { roomId: string; messageId: number }) => Promise<void>
  /** S3c: 설정 읽기 함수(없으면 시드) */
  loadPromptSettings?: () => Promise<PromptSettings>
  /** S3f: 공장 교체(D1 오류 흉내) */
  llm?: () => Promise<Llm>
}

/** 가짜 시계·수집 로거·FakeProvider 를 단 서비스를 만든다 */
const setup = (steps: FakeStep[] = [], opts: SetupOptions = {}): Setup => {
  const clock = { t: opts.now ?? T0 }
  const now = (): number => clock.t
  const logs: Log[] = []
  const logger = createLogger((_level, line) => {
    logs.push(JSON.parse(line) as Log)
  })
  const fake = new FakeProvider(steps)
  const baseDb = createDb(env.DB)
  const db = opts.wrapDb === undefined ? baseDb : opts.wrapDb(baseDb)
  const llm = (): Llm =>
    createLlm({
      provider: fake,
      timeoutMs: 60_000,
      logger,
      now,
      sleep: async ms => {
        clock.t += ms
      },
      ...(opts.meter === true
        ? {
            meter: createUsageMeter({
              store: db.llmUsage,
              config: {
                monthlyBudgetKrw: 100000,
                priceInputUsdPerM: 0.3,
                priceOutputUsdPerM: 2.5,
                krwPerUsd: 1400,
              },
              logger,
              now,
            }),
          }
        : {}),
    })
  const svc = createMessagesService({
    db,
    now,
    logger,
    contextMessages: opts.contextMessages ?? 40,
    llm: opts.llm ?? (() => Promise.resolve(llm())),
    ...(opts.afterSpeak === undefined ? {} : { afterSpeak: opts.afterSpeak }),
    ...(opts.loadPromptSettings === undefined
      ? {}
      : { loadPromptSettings: opts.loadPromptSettings }),
  })
  const waits: Promise<unknown>[] = []
  return { svc, db, fake, logs, clock, waits, bg: { waitUntil: p => waits.push(p) } }
}

const codeOf = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p
  } catch (e) {
    if (e instanceof AppError) return e.code
    throw e
  }
  return 'NO_ERROR'
}

const insertUser = async (roomId: string, text: string, createdAt = 1): Promise<number> => {
  const row = await env.DB.prepare(
    "INSERT INTO messages (room_id, speaker, kind, text, author_mb_id, author_name, created_at) VALUES (?1, 'user', 'line', ?2, 'mb_x', '손님', ?3) RETURNING id",
  )
    .bind(roomId, text, createdAt)
    .first<{ id: number }>()
  if (row === null) throw new Error('insert failed')
  return row.id
}

const lockOf = async (id: string): Promise<number | null | undefined> =>
  (
    await env.DB.prepare('SELECT speaking_until AS s FROM rooms WHERE id = ?1')
      .bind(id)
      .first<{ s: number | null }>()
  )?.s

const updatedAtOf = async (id: string): Promise<number | undefined> =>
  (
    await env.DB.prepare('SELECT updated_at AS u FROM rooms WHERE id = ?1')
      .bind(id)
      .first<{ u: number }>()
  )?.u

const countOf = async (roomId: string): Promise<number> =>
  (
    await env.DB.prepare('SELECT COUNT(*) AS n FROM messages WHERE room_id = ?1')
      .bind(roomId)
      .first<{ n: number }>()
  )?.n ?? 0

const textOf = (fake: FakeProvider, n = 0): string => fake.calls[n]?.turns[0]?.text ?? ''

const deferred = () => {
  let resolve: () => void = () => undefined
  const promise = new Promise<void>(r => {
    resolve = r
  })
  return { promise, resolve }
}

describe('speak', () => {
  beforeEach(resetDb)

  it('SRV-T-191 speak_saves_character_line_and_touches_room', async () => {
    await insertRoom('a', 'A', 1, 100)
    const s = setup([{ text: '세바스찬: 분부대로.' }], { now: 999 })
    const m = await s.svc.speak('a', { character: 'sebastian' }, s.bg)
    expect(m).toMatchObject({
      speaker: 'sebastian',
      kind: 'line',
      text: '분부대로.',
      authorName: null,
      createdAt: 999,
    })
    const row = await env.DB.prepare('SELECT author_mb_id AS a FROM messages WHERE id = ?1')
      .bind(m.id)
      .first<{ a: string | null }>()
    expect(row?.a).toBeNull()
    expect(await updatedAtOf('a')).toBe(999)
    expect(await lockOf('a')).toBeNull()
  })

  it('SRV-T-192 speak_allows_same_character_twice_in_a_row', async () => {
    await insertRoom('a', 'A', 1, 100)
    const s = setup([{ text: '첫째 대사' }, { text: '둘째 대사' }])
    const first = await s.svc.speak('a', { character: 'ciel' }, s.bg)
    const second = await s.svc.speak('a', { character: 'ciel' }, s.bg)
    expect([first.speaker, second.speaker]).toEqual(['ciel', 'ciel'])
    expect(await countOf('a')).toBe(2)
    expect(textOf(s.fake, 1)).toContain('첫째 대사')
  })

  it('SRV-T-193 speak_sends_recent_context_with_summary_in_order', async () => {
    await insertRoom('a', 'A', 1, 100)
    await insertRoom('b', 'B', 1, 100)
    const label = (i: number): string => `L${String(i).padStart(2, '0')}`
    for (let i = 1; i <= 45; i += 1) await insertLine('a', label(i), i)
    for (let i = 1; i <= 3; i += 1) await insertLine('b', `OTHER${i}`, i)
    await env.DB.prepare(
      "INSERT INTO memory (room_id, summary, updated_at) VALUES ('a', 'SUMMARY_X', 1)",
    ).run()
    const s = setup([{ text: 'ok' }, { text: 'ok' }])
    await s.svc.speak('a', { character: 'ciel' }, s.bg)
    const text = textOf(s.fake)
    expect(text).toContain('[지난 이야기 요약] SUMMARY_X')
    expect(text).not.toContain(label(5))
    const positions = Array.from({ length: 40 }, (_, k) => text.indexOf(label(k + 6)))
    expect(positions.every(p => p >= 0)).toBe(true)
    expect([...positions].sort((x, y) => x - y)).toEqual(positions)
    expect(text).not.toContain('OTHER')
    expect(s.fake.calls[0]?.system).toBe(
      buildSpeakPrompt({ character: 'ciel', summary: null, history: [] }).system,
    )
    await s.svc.speak('b', { character: 'sebastian' }, s.bg)
    expect(textOf(s.fake, 1)).not.toContain('[지난 이야기 요약]')
  })

  it('SRV-T-194 speak_validates_character_before_llm_and_db', async () => {
    const dbCalls = { n: 0 }
    const trap = new Proxy(
      {},
      {
        get: () => {
          dbCalls.n += 1
          throw new Error('db touched')
        },
      },
    ) as unknown as Db
    const llm = vi.fn((): Llm => {
      throw new Error('llm touched')
    })
    const svc = createMessagesService({
      db: trap,
      now: () => T0,
      logger: createLogger(() => undefined),
      contextMessages: 40,
      llm: () => Promise.resolve(llm()),
    })
    const bad = { character: 'meirin' } as unknown as { character: 'ciel' }
    expect(await codeOf(svc.speak('a', bad, { waitUntil: () => undefined }))).toBe(
      'VALIDATION_ERROR',
    )
    expect(dbCalls.n).toBe(0)
    expect(llm).not.toHaveBeenCalled()
  })

  it('SRV-T-195 speak_throws_NOT_FOUND_for_unknown_room_without_llm_call', async () => {
    const s = setup([{ text: 'x' }])
    expect(await codeOf(s.svc.speak('zzz', { character: 'ciel' }, s.bg))).toBe('NOT_FOUND')
    expect(s.fake.calls).toHaveLength(0)
    expect(await countOf('zzz')).toBe(0)
  })

  it('SRV-T-196 speak_throws_SPEAK_IN_PROGRESS_when_locked_and_retakes_after_expiry', async () => {
    await insertRoom('a', 'A', 1, 100)
    const s = setup([{ text: '들어갑니다' }])
    await env.DB.prepare('UPDATE rooms SET speaking_until = ?1 WHERE id = ?2')
      .bind(T0 + 1, 'a')
      .run()
    expect(await codeOf(s.svc.speak('a', { character: 'ciel' }, s.bg))).toBe('SPEAK_IN_PROGRESS')
    expect(s.fake.calls).toHaveLength(0)
    expect(await lockOf('a')).toBe(T0 + 1)
    await env.DB.prepare('UPDATE rooms SET speaking_until = ?1 WHERE id = ?2').bind(T0, 'a').run()
    const m = await s.svc.speak('a', { character: 'ciel' }, s.bg)
    expect(m.text).toBe('들어갑니다')
  })

  it('SRV-T-197 speak_and_regenerate_throw_CONFIG_INVALID_only_when_called', async () => {
    await insertRoom('a', 'A', 1, 100)
    const targetId = await insertLine('a', 'orig', 5)
    const logger = createLogger(() => undefined)
    const build = (provider: string) =>
      createServices({
        db: createDb(env.DB),
        logger,
        now: () => T0,
        config: parseEnv({
          TOKEN_SECRET: 'test-secret-0123456789-abcdefghijklmnop',
          LLM_PROVIDER: provider,
          DB: env.DB,
          ASSETS: { fetch: () => undefined },
        }),
      }).messages
    const bg = { waitUntil: () => undefined }
    const google = build('google')
    const speakErr = await google.speak('a', { character: 'ciel' }, bg).catch((e: unknown) => e)
    const regenErr = await google.regenerate(targetId).catch((e: unknown) => e)
    for (const err of [speakErr, regenErr]) {
      expect(err).toBeInstanceOf(ConfigError)
      expect((err as ConfigError).code).toBe('CONFIG_INVALID')
      expect((err as ConfigError).keys).toEqual(['LLM_API_KEY'])
    }
    expect(await lockOf('a')).toBeNull()
    expect((await google.listMessages('a', {})).messages).toHaveLength(1)
    await google.addUserMessage('a', { text: '안녕', ooc: false }, { mbId: 'm', displayName: 'n' })
    const fake = await build('fake').speak('a', { character: 'ciel' }, bg)
    expect(fake.speaker).toBe('ciel')
  })

  it('SRV-T-198 speak_releases_lock_and_saves_nothing_on_llm_failure', async () => {
    await insertRoom('a', 'A', 1, 100)
    const cases: [FakeStep[], string][] = [
      [[{ error: new LlmError('http_5xx') }, { error: new LlmError('http_5xx') }], 'LLM_FAILED'],
      [[{ error: new LlmError('blocked') }], 'LLM_EMPTY'],
      [[{ text: '시엘: ' }], 'LLM_EMPTY'],
    ]
    for (const [steps, code] of cases) {
      const s = setup(steps)
      expect(await codeOf(s.svc.speak('a', { character: 'ciel' }, s.bg))).toBe(code)
      expect(await countOf('a')).toBe(0)
      expect(await lockOf('a')).toBeNull()
      expect(await updatedAtOf('a')).toBe(100)
    }
  })

  it('SRV-T-199 speak_concurrent_requests_allow_only_one', async () => {
    await insertRoom('a', 'A', 1, 100)
    await insertRoom('b', 'B', 1, 100)
    const gate = deferred()
    const started = deferred()
    const hold: FakeStep = async () => {
      started.resolve()
      await gate.promise
      return { text: '느린 대사' }
    }
    const s = setup([hold, { text: '세 번째' }])
    const first = s.svc.speak('a', { character: 'ciel' }, s.bg)
    await started.promise
    const second = s.svc.speak('a', { character: 'sebastian' }, s.bg)
    expect(await codeOf(second)).toBe('SPEAK_IN_PROGRESS')
    gate.resolve()
    expect((await first).text).toBe('느린 대사')
    expect((await s.svc.speak('a', { character: 'ciel' }, s.bg)).text).toBe('세 번째')

    const t = setup([{ text: 'A방' }, { text: 'B방' }])
    const results = await Promise.allSettled([
      t.svc.speak('a', { character: 'ciel' }, t.bg),
      t.svc.speak('b', { character: 'ciel' }, t.bg),
    ])
    expect(results.map(r => r.status)).toEqual(['fulfilled', 'fulfilled'])
  })

  it('SRV-T-200 speak_returns_NOT_FOUND_when_room_deleted_during_generation', async () => {
    await insertRoom('a', 'A', 1, 100)
    const releases = vi.fn()
    const s = setup(
      [
        async () => {
          await createDb(env.DB).rooms.deleteCascade('a')
          return { text: '사라질 대사' }
        },
      ],
      {
        wrapDb: db => ({
          ...db,
          rooms: {
            ...db.rooms,
            releaseSpeakLock: async (id, until) => {
              releases()
              return db.rooms.releaseSpeakLock(id, until)
            },
          },
        }),
      },
    )
    expect(await codeOf(s.svc.speak('a', { character: 'ciel' }, s.bg))).toBe('NOT_FOUND')
    expect(await countOf('a')).toBe(0)
    expect(releases).toHaveBeenCalledTimes(1)
  })

  it('SRV-T-201 speak_keeps_result_when_lock_release_fails', async () => {
    await insertRoom('a', 'A', 1, 100)
    const wrapDb = (db: Db): Db => ({
      ...db,
      rooms: {
        ...db.rooms,
        releaseSpeakLock: () => Promise.reject(new Error('d1 down')),
      },
    })
    const ok = setup([{ text: '살아남은 대사' }], { wrapDb })
    const m = await ok.svc.speak('a', { character: 'ciel' }, ok.bg)
    expect(m.text).toBe('살아남은 대사')
    expect(await countOf('a')).toBe(1)
    expect(ok.logs.filter(l => l.event === 'speak_lock_release_failed')).toHaveLength(1)
    await env.DB.prepare('UPDATE rooms SET speaking_until = NULL').run()

    const bad = setup([{ error: new LlmError('http_4xx') }], { wrapDb })
    expect(await codeOf(bad.svc.speak('a', { character: 'ciel' }, bad.bg))).toBe('LLM_FAILED')
    expect(bad.logs.filter(l => l.event === 'speak_lock_release_failed')).toHaveLength(1)
  })

  it('SRV-T-202 speak_schedules_afterSpeak_via_waitUntil_only_on_success', async () => {
    await insertRoom('a', 'A', 1, 100)
    const hook = vi.fn(async (_e: { roomId: string; messageId: number }) => undefined)
    const ok = setup([{ text: '성공' }], { afterSpeak: hook })
    const waitSpy = vi.fn(ok.bg.waitUntil)
    const m = await ok.svc.speak('a', { character: 'ciel' }, { waitUntil: waitSpy })
    expect(waitSpy).toHaveBeenCalledTimes(1)
    await ok.waits[0]
    await waitSpy.mock.calls[0]?.[0]
    expect(hook).toHaveBeenCalledTimes(1)
    expect(hook).toHaveBeenCalledWith({ roomId: 'a', messageId: m.id })

    const failHook = vi.fn(async () => undefined)
    const fail = setup([{ error: new LlmError('http_4xx') }], { afterSpeak: failHook })
    const failWait = vi.fn()
    await codeOf(fail.svc.speak('a', { character: 'ciel' }, { waitUntil: failWait }))
    expect(failWait).not.toHaveBeenCalled()

    const boom = setup([{ text: '또 성공' }], {
      afterSpeak: () => Promise.reject(new Error('hook down')),
    })
    await boom.svc.speak('a', { character: 'ciel' }, boom.bg)
    expect(boom.waits).toHaveLength(1)
    await expect(boom.waits[0]).resolves.toBeUndefined()
    expect(boom.logs.some(l => l.event === 'after_speak_failed')).toBe(true)

    const none = setup([{ text: '훅 없음' }])
    const noneWait = vi.fn()
    await none.svc.speak('a', { character: 'ciel' }, { waitUntil: noneWait })
    expect(noneWait).not.toHaveBeenCalled()
  })

  it('SRV-T-208 speak_finishes_within_70s_budget_on_repeated_timeouts', async () => {
    await insertRoom('a', 'A', 1, 100)
    const slow =
      (ms: number): FakeStep =>
      async () => {
        s.clock.t += ms
        throw new LlmError('timeout')
      }
    const acquires: { untilMs: number; nowMs: number }[] = []
    const releases: number[] = []
    const s = setup([slow(60_000), slow(5_000)], {
      wrapDb: db => ({
        ...db,
        rooms: {
          ...db.rooms,
          acquireSpeakLock: (id, untilMs, nowMs) => {
            acquires.push({ untilMs, nowMs })
            return db.rooms.acquireSpeakLock(id, untilMs, nowMs)
          },
          releaseSpeakLock: (id, untilMs) => {
            releases.push(untilMs)
            return db.rooms.releaseSpeakLock(id, untilMs)
          },
        },
      }),
    })
    const start = s.clock.t
    expect(await codeOf(s.svc.speak('a', { character: 'ciel' }, s.bg))).toBe('LLM_FAILED')
    expect(s.clock.t - start).toBeLessThanOrEqual(70_000)
    expect(acquires).toEqual([{ untilMs: start + SPEAK_LOCK_MS, nowMs: start }])
    expect(SPEAK_LOCK_MS).toBeGreaterThan(70_000)
    expect(releases).toEqual([start + SPEAK_LOCK_MS])
    expect(await lockOf('a')).toBeNull()
  })
})

describe('regenerate', () => {
  beforeEach(resetDb)

  it('SRV-T-203 regenerate_replaces_last_character_message_text', async () => {
    await insertRoom('a', 'A', 1, 100)
    await insertUser('a', 'USER_LINE', 5)
    const id = await insertLine('a', 'OLD_TEXT', 6)
    const s = setup([{ text: '세바스찬: 다시 말씀드리지요.' }], { now: 999 })
    const m = await s.svc.regenerate(id)
    expect(m).toMatchObject({
      id,
      speaker: 'sebastian',
      kind: 'line',
      createdAt: 6,
      text: '다시 말씀드리지요.',
    })
    expect(await updatedAtOf('a')).toBe(999)
    const text = textOf(s.fake)
    expect(text).toContain('USER_LINE')
    expect(text).not.toContain('OLD_TEXT')
    expect(text).toContain('다음 발화자: 세바스찬.')
    expect(await lockOf('a')).toBeNull()
  })

  it('SRV-T-204 regenerate_rejects_user_message_with_NOT_CHARACTER_MESSAGE', async () => {
    await insertRoom('a', 'A', 1, 100)
    const id = await insertUser('a', 'hi', 5)
    const s = setup([{ text: 'x' }])
    expect(await codeOf(s.svc.regenerate(id))).toBe('NOT_CHARACTER_MESSAGE')
    expect(s.fake.calls).toHaveLength(0)
    expect(await lockOf('a')).toBeNull()
  })

  it('SRV-T-205 regenerate_rejects_non_last_with_NOT_LAST_MESSAGE', async () => {
    await insertRoom('a', 'A', 1, 100)
    const id = await insertLine('a', 'KEEP_ME', 5)
    await insertUser('a', 'later', 6)
    const s = setup([{ text: 'x' }])
    expect(await codeOf(s.svc.regenerate(id))).toBe('NOT_LAST_MESSAGE')
    expect(s.fake.calls).toHaveLength(0)
    expect((await s.db.messages.getById(id))?.text).toBe('KEEP_ME')
    expect(await lockOf('a')).toBeNull()
  })

  it('SRV-T-206 regenerate_throws_NOT_FOUND_for_bad_unknown_or_deleted_target', async () => {
    await insertRoom('a', 'A', 1, 100)
    const dbCalls = { n: 0 }
    const counting = (db: Db): Db => ({
      ...db,
      messages: {
        ...db.messages,
        getById: id => {
          dbCalls.n += 1
          return db.messages.getById(id)
        },
      },
    })
    const s = setup([{ text: 'x' }], { wrapDb: counting })
    expect(await codeOf(s.svc.regenerate(0))).toBe('NOT_FOUND')
    expect(await codeOf(s.svc.regenerate(Number.NaN))).toBe('NOT_FOUND')
    expect(dbCalls.n).toBe(0)
    expect(await codeOf(s.svc.regenerate(987_654))).toBe('NOT_FOUND')

    const id = await insertLine('a', 'GONE', 5)
    const d = setup(
      [
        async () => {
          await createDb(env.DB).messages.deleteById(id, 1)
          return { text: '사라질 재작성' }
        },
      ],
      {},
    )
    expect(await codeOf(d.svc.regenerate(id))).toBe('NOT_FOUND')
    expect(await countOf('a')).toBe(0)
    expect(await lockOf('a')).toBeNull()
  })

  it('SRV-T-207 regenerate_shares_speak_lock', async () => {
    await insertRoom('a', 'A', 1, 100)
    const id = await insertLine('a', 'orig', 5)
    const locked = setup([{ text: 'x' }])
    await env.DB.prepare('UPDATE rooms SET speaking_until = ?1 WHERE id = ?2')
      .bind(T0 + 1, 'a')
      .run()
    expect(await codeOf(locked.svc.regenerate(id))).toBe('SPEAK_IN_PROGRESS')
    await env.DB.prepare('UPDATE rooms SET speaking_until = NULL').run()

    const gate = deferred()
    const started = deferred()
    const s = setup([
      async () => {
        started.resolve()
        await gate.promise
        return { text: '재작성 완료' }
      },
    ])
    const regen = s.svc.regenerate(id)
    await started.promise
    expect(await codeOf(s.svc.speak('a', { character: 'ciel' }, s.bg))).toBe('SPEAK_IN_PROGRESS')
    gate.resolve()
    expect((await regen).text).toBe('재작성 완료')
  })

  it('SRV-T-209 addUserMessage_and_edit_never_create_llm', async () => {
    await insertRoom('a', 'A', 1, 100)
    const llm = vi.fn((): Llm => {
      throw new Error('llm touched')
    })
    const svc = createMessagesService({
      db: createDb(env.DB),
      now: () => T0,
      logger: createLogger(() => undefined),
      contextMessages: 40,
      llm: () => Promise.resolve(llm()),
    })
    const m = await svc.addUserMessage(
      'a',
      { text: '안녕', ooc: false },
      { mbId: 'm', displayName: 'n' },
    )
    await svc.editMessage(m.id, { text: '수정' })
    await svc.listMessages('a', {})
    await svc.deleteMessage(m.id)
    expect(llm).not.toHaveBeenCalled()
  })
})

// ---- S3b (SRV-T-225~230) — doc/200_설계/server/messages.md §8.3 ----
describe('월 비용 게이트 (S3b)', () => {
  beforeEach(resetDb)
  const MONTH = kstMonthKey(T0)

  /** acquireSpeakLock 호출 수를 세는 Db 래퍼 */
  const spyLock = () => {
    const calls = { acquire: 0 }
    const wrapDb = (db: Db): Db => ({
      ...db,
      rooms: {
        ...db.rooms,
        acquireSpeakLock: (...args: Parameters<Db['rooms']['acquireSpeakLock']>) => {
          calls.acquire += 1
          return db.rooms.acquireSpeakLock(...args)
        },
      },
    })
    return { calls, wrapDb }
  }

  const errOf = async (p: Promise<unknown>): Promise<AppError> => {
    try {
      await p
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      return e as AppError
    }
    throw new Error('expected AppError')
  }

  it('SRV-T-225 speak_rejects_LLM_BUDGET_EXCEEDED_before_lock_and_llm', async () => {
    await insertRoom('a', 'A', 1, 100)
    await insertUsage(MONTH, 100000, 7)
    const { calls, wrapDb } = spyLock()
    const s = setup([], { meter: true, wrapDb })
    const err = await errOf(s.svc.speak('a', { character: 'ciel' }, s.bg))
    expect([err.code, err.status]).toEqual(['LLM_BUDGET_EXCEEDED', 429])
    expect(err.retryAfterSec).toBe(budgetRetryAfterSec(T0))
    expect(s.fake.calls).toHaveLength(0)
    expect(calls.acquire).toBe(0)
    expect(await lockOf('a')).toBeNull()
    expect(await countOf('a')).toBe(0)
    expect(await updatedAtOf('a')).toBe(100)
    expect(await usageRow(MONTH)).toMatchObject({ calls: 7, est_krw: 100000, updated_at: 1 })

    // 키 확인이 게이트보다 먼저: google + 키 없음 → CONFIG_INVALID
    const svc = createServices({
      db: createDb(env.DB),
      logger: createLogger(() => undefined),
      now: () => T0,
      config: parseEnv({
        TOKEN_SECRET: 'test-secret-0123456789-abcdefghijklmnop',
        LLM_PROVIDER: 'google',
        DB: env.DB,
        ASSETS: { fetch: () => undefined },
      }),
    }).messages
    const cfg = await svc.speak('a', { character: 'ciel' }, s.bg).catch((e: unknown) => e)
    expect(cfg).toBeInstanceOf(ConfigError)
  })

  it('SRV-T-226 regenerate_rejects_LLM_BUDGET_EXCEEDED_after_target_checks', async () => {
    await insertRoom('a', 'A', 1, 100)
    const userId = await insertUser('a', '유저', 1)
    const lineId = await insertLine('a', '원문', 2)
    await insertUsage(MONTH, 100000)
    const { calls, wrapDb } = spyLock()
    const s = setup([], { meter: true, wrapDb })
    const err = await errOf(s.svc.regenerate(lineId))
    expect(err.code).toBe('LLM_BUDGET_EXCEEDED')
    expect(err.retryAfterSec).toBe(budgetRetryAfterSec(T0))
    const text = await env.DB.prepare('SELECT text FROM messages WHERE id = ?1')
      .bind(lineId)
      .first<{ text: string }>()
    expect(text?.text).toBe('원문')
    expect(calls.acquire).toBe(0)
    expect(s.fake.calls).toHaveLength(0)
    expect(await codeOf(s.svc.regenerate(userId))).toBe('NOT_CHARACTER_MESSAGE')
    expect(await codeOf(s.svc.regenerate(lineId + 999))).toBe('NOT_FOUND')
    expect(calls.acquire).toBe(0)
  })

  it('SRV-T-227 speak_allows_just_below_budget_then_rejects_next', async () => {
    await insertRoom('a', 'A', 1, 100)
    await insertUsage(MONTH, 99999.95, 4)
    const s = setup([{ text: '한 번 더' }, { text: '두 번째' }], { meter: true })
    const first = await s.svc.speak('a', { character: 'ciel' }, s.bg)
    expect(first.speaker).toBe('ciel')
    const row = await usageRow(MONTH)
    expect(row?.calls).toBe(5)
    expect(row?.est_krw).toBeCloseTo(99999.95 + 0.112, 6)
    expect(await codeOf(s.svc.speak('a', { character: 'ciel' }, s.bg))).toBe('LLM_BUDGET_EXCEEDED')
    expect(s.fake.calls).toHaveLength(1)
  })

  it('SRV-T-228 speak_accumulates_per_attempt_including_failed_responses', async () => {
    await insertRoom('a', 'A', 1, 100)
    const a = setup(
      [{ error: new LlmError('http_5xx', { usage: FAKE_USAGE }) }, { text: '성공' }],
      { meter: true },
    )
    await a.svc.speak('a', { character: 'ciel' }, a.bg)
    let row = await usageRow(MONTH)
    expect(row?.calls).toBe(2)
    expect(row?.est_krw).toBeCloseTo(0.224, 9)

    await resetDb()
    await insertRoom('a', 'A', 1, 100)
    const b = setup([{ error: new LlmError('blocked', { usage: FAKE_USAGE }) }], { meter: true })
    expect(await codeOf(b.svc.speak('a', { character: 'ciel' }, b.bg))).toBe('LLM_EMPTY')
    row = await usageRow(MONTH)
    expect(row?.calls).toBe(1)

    await resetDb()
    await insertRoom('a', 'A', 1, 100)
    const c = setup([{ error: new LlmError('http_4xx') }], { meter: true })
    expect(await codeOf(c.svc.speak('a', { character: 'ciel' }, c.bg))).toBe('LLM_FAILED')
    expect(await usageRow(MONTH)).toBeNull()
  })

  it('SRV-T-229 non_generate_paths_ignore_budget', async () => {
    await insertRoom('a', 'A', 1, 100)
    await insertUsage(MONTH, 100000, 9)
    const llm = vi.fn((): Llm => {
      throw new Error('llm touched')
    })
    const svc = createMessagesService({
      db: createDb(env.DB),
      now: () => T0,
      logger: createLogger(() => undefined),
      contextMessages: 40,
      llm: () => Promise.resolve(llm()),
    })
    const m = await svc.addUserMessage(
      'a',
      { text: '안녕', ooc: false },
      { mbId: 'm', displayName: 'n' },
    )
    await svc.listMessages('a', {})
    await svc.editMessage(m.id, { text: '수정' })
    await svc.deleteMessage(m.id)
    expect(llm).not.toHaveBeenCalled()
    expect(await usageRow(MONTH)).toMatchObject({ calls: 9, est_krw: 100000 })
  })

  it('SRV-T-230 speak_resumes_in_next_kst_month', async () => {
    await insertRoom('a', 'A', 1, 100)
    await insertUsage('2026-10', 100000)
    const s = setup([{ text: '새 달' }], {
      meter: true,
      now: Date.parse('2026-10-31T15:00:00.000Z'),
    })
    const m = await s.svc.speak('a', { character: 'ciel' }, s.bg)
    expect(m.speaker).toBe('ciel')
    expect(await usageRow('2026-11')).toMatchObject({ calls: 1 })
    expect(await usageRow('2026-10')).toMatchObject({ calls: 1, est_krw: 100000 })
  })
})

// ---- S3c: 설정 읽기 (SRV-T-256~258) ----
describe('S3c 설정 읽기', () => {
  beforeEach(resetDb)
  const validBody = (marker: string): CharacterSettings => {
    const s = JSON.parse(JSON.stringify(validSettings())) as CharacterSettings
    s.characters.sebastian.persona = `PERSONA_${marker}`
    s.characters.sebastian.speech = `SPEECH_${marker}`
    return s
  }
  const OWNER = { mbId: 'owner_test', nick: 'o', chName: '', level: 5, displayName: 'o' }
  const settingsFor = (s: Setup) =>
    createSettingsService({
      db: s.db,
      logger: createLogger(() => undefined),
      now: () => T0,
      fallbackModelKey: null,
    })

  it('SRV-T-256 speak_and_regenerate_use_settings_saved_just_before', async () => {
    await insertRoom('a', 'A', 1, 100)
    const probe = setup([{ text: '하나' }, { text: '둘' }])
    const settings = settingsFor(probe)
    const s = setup([{ text: '하나' }, { text: '둘' }], {
      loadPromptSettings: settings.loadForPrompt,
    })
    await settings.put(validBody('AAA'), OWNER)
    const saved = await s.svc.speak('a', { character: 'sebastian' }, s.bg)
    expect(s.fake.calls[0]?.system).toContain('PERSONA_AAA')
    expect(s.fake.calls[0]?.system).toContain('SPEECH_AAA')
    await settings.put(validBody('BBB'), OWNER)
    await s.svc.regenerate(saved.id)
    expect(s.fake.calls[1]?.system).toContain('PERSONA_BBB')
    expect(s.fake.calls[1]?.system).not.toContain('AAA')
  })

  it('SRV-T-256 createServices 배선: 컨테이너가 loadPromptSettings 를 messages 에 넘긴다', async () => {
    await insertRoom('a', 'A', 1, 100)
    let reads = 0
    const real = createDb(env.DB)
    const db: Db = {
      ...real,
      characterSettings: {
        ...real.characterSettings,
        get: async () => {
          reads += 1
          return real.characterSettings.get()
        },
      },
    }
    const services = createServices({
      db,
      logger: createLogger(() => undefined),
      now: () => T0,
      config: parseEnv({
        TOKEN_SECRET: 'test-secret-0123456789-abcdefghijklmnop',
        LLM_PROVIDER: 'fake',
        DB: env.DB,
        ASSETS: { fetch: () => undefined },
      }),
    })
    await services.messages.speak('a', { character: 'ciel' }, { waitUntil: () => undefined })
    expect(reads).toBe(1)
  })

  it('SRV-T-257 speak_uses_seed_when_settings_row_corrupted', async () => {
    await insertRoom('a', 'A', 1, 100)
    await env.DB.prepare(
      "INSERT INTO character_settings (id, json, version, updated_at, updated_by) VALUES (1, '{{', 1, 1, 'owner_test')",
    ).run()
    const logs: Log[] = []
    const logger = createLogger((_l, line) => void logs.push(JSON.parse(line) as Log))
    const probe = setup()
    const settings = createSettingsService({
      db: probe.db,
      logger,
      now: () => T0,
      fallbackModelKey: null,
    })
    const s = setup([{ text: '시드' }], { loadPromptSettings: settings.loadForPrompt })
    const msg = await s.svc.speak('a', { character: 'ciel' }, s.bg)
    expect(msg.text).toBe('시드')
    const plain = setup([{ text: 'x' }])
    await plain.svc.speak('a', { character: 'ciel' }, plain.bg)
    expect(s.fake.calls[0]?.system).toBe(plain.fake.calls[0]?.system)
    const errs = logs.filter(l => l.event === 'character_settings_invalid')
    expect(errs).toHaveLength(1)
    expect(JSON.stringify(logs)).not.toContain('"json"')
  })

  it('SRV-T-258 settings_read_only_after_lock_acquired', async () => {
    let reads = 0
    const loadPromptSettings = async () => {
      reads += 1
      return DEFAULT_PROMPT_SETTINGS
    }
    const opts = { loadPromptSettings }
    await insertRoom('a', 'A', 1, 100)
    await insertRoom('busy', 'B', 1, 100)
    await env.DB.prepare('UPDATE rooms SET speaking_until = ?1 WHERE id = ?2')
      .bind(T0 + 50_000, 'busy')
      .run()
    const userId = await insertUser('a', 'hi', 1)

    const bad = setup([{ text: 'x' }], opts)
    expect(await codeOf(bad.svc.speak('a', { character: 'nobody' as never }, bad.bg))).toBe(
      'VALIDATION_ERROR',
    )
    expect(await codeOf(bad.svc.speak('zzz', { character: 'ciel' }, bad.bg))).toBe('NOT_FOUND')
    expect(await codeOf(bad.svc.speak('busy', { character: 'ciel' }, bad.bg))).toBe(
      'SPEAK_IN_PROGRESS',
    )
    expect(await codeOf(bad.svc.regenerate(userId))).toBe('NOT_CHARACTER_MESSAGE')
    await insertUsage(kstMonthKey(T0), 100000, 7)
    const over = setup([{ text: 'x' }], { ...opts, meter: true })
    expect(await codeOf(over.svc.speak('a', { character: 'ciel' }, over.bg))).toBe(
      'LLM_BUDGET_EXCEEDED',
    )
    expect(reads).toBe(0)

    await env.DB.prepare('DELETE FROM llm_usage').run()
    const ok = setup([{ text: '정상' }, { text: '다시' }], opts)
    const m = await ok.svc.speak('a', { character: 'ciel' }, ok.bg)
    expect(reads).toBe(1)
    await ok.svc.regenerate(m.id)
    expect(reads).toBe(2)
  })

  it('SRV-T-292 settings_read_failure_inside_lock_releases_lock_and_skips_llm', async () => {
    await insertRoom('a', 'A', 1, 100)
    const lineId = await insertLine('a', 'orig', 5)
    const loadPromptSettings = async (): Promise<PromptSettings> => {
      throw new Error('settings boom')
    }
    const s = setup([{ text: 'never' }, { text: 'never' }], { loadPromptSettings })
    for (const run of [
      () => s.svc.speak('a', { character: 'ciel' }, s.bg),
      () => s.svc.speak('a', { character: 'auto' }, s.bg),
      () => s.svc.regenerate(lineId),
    ]) {
      await expect(run()).rejects.toThrow('settings boom')
      expect(await lockOf('a')).toBeNull()
    }
    expect(s.fake.calls).toHaveLength(0)
    expect(s.waits).toHaveLength(0)
  })
})

// ---- S3d (SRV-T-270~278) — doc/200_설계/server/messages.md §12.7. 각본 0번째는 선택 호출 ----
describe("speak 'auto' (S3d)", () => {
  beforeEach(resetDb)

  const insertCiel = async (roomId: string, text: string, createdAt: number): Promise<void> => {
    await env.DB.prepare(
      "INSERT INTO messages (room_id, speaker, kind, text, created_at) VALUES (?1, 'ciel', 'line', ?2, ?3)",
    )
      .bind(roomId, text, createdAt)
      .run()
  }
  const SPEAK_SYSTEM = (character: 'sebastian' | 'ciel'): string =>
    buildSpeakPrompt({ character, summary: null, history: [] }).system
  const evt = (logs: Log[], event: string): Log[] => logs.filter(l => l.event === event)
  const timeoutAfter =
    (clock: { t: number }, ms: number): (() => Promise<never>) =>
    async () => {
      clock.t += ms
      throw new LlmError('timeout')
    }

  it('SRV-T-270 speak_auto_saves_model_choice_ciel', async () => {
    await insertRoom('a', 'A', 1, 100)
    await insertCiel('a', '시엘 발화', 1)
    await insertUser('a', '유저 발화', 2)
    const s = setup([{ text: 'ciel' }, { text: '대사' }])
    const m = await s.svc.speak('a', { character: 'auto' }, s.bg)
    expect(m).toMatchObject({ speaker: 'ciel', kind: 'line', text: '대사' })
    expect(s.fake.calls).toHaveLength(2)
    expect(s.fake.calls[0]?.timeoutMs).toBe(15_000)
    expect(s.fake.calls[1]?.system).toBe(SPEAK_SYSTEM('ciel'))
    expect(evt(s.logs, 'speak_done')[0]).toMatchObject({
      character: 'ciel',
      auto: true,
      selected: 'model',
    })
  })

  it('SRV-T-271 speak_auto_accepts_korean_choice_sebastian', async () => {
    await insertRoom('a', 'A', 1, 100)
    await insertLine('a', '세바스찬 발화', 1)
    await insertUser('a', '유저 발화', 2)
    const s = setup([{ text: '세바스찬.' }, { text: '대사' }])
    const m = await s.svc.speak('a', { character: 'auto' }, s.bg)
    expect(m.speaker).toBe('sebastian')
    expect(evt(s.logs, 'speak_done')[0]).toMatchObject({ selected: 'model' })
    expect(s.logs.filter(l => l.level === 'warn')).toHaveLength(0)
  })

  it('SRV-T-272 speak_auto_falls_back_on_unparsable_choice', async () => {
    await insertRoom('a', 'A', 1, 100)
    await insertLine('a', '세바스찬 발화', 1)
    await insertUser('a', '비밀_유저_본문', 2)
    const s = setup([{ text: '모르겠다' }, { text: '대사' }])
    const m = await s.svc.speak('a', { character: 'auto' }, s.bg)
    expect(m.speaker).toBe('ciel')
    const warns = evt(s.logs, 'speaker_select_fallback')
    expect(warns).toHaveLength(1)
    expect(warns[0]).toMatchObject({ level: 'warn', roomId: 'a', reason: 'unparsable' })
    const all = JSON.stringify(s.logs)
    expect(all).not.toContain('모르겠다')
    expect(all).not.toContain('비밀_유저_본문')
  })

  it('SRV-T-273 speak_auto_falls_back_after_select_timeout_then_speaks', async () => {
    await insertRoom('a', 'A', 1, 100)
    await insertUser('a', '유저만', 1)
    const holder: { s?: Setup } = {}
    const s = setup([
      async () => {
        if (holder.s !== undefined) holder.s.clock.t += 15_000
        throw new LlmError('timeout')
      },
      { text: '대사' },
    ])
    holder.s = s
    const m = await s.svc.speak('a', { character: 'auto' }, s.bg)
    expect(m.speaker).toBe('sebastian')
    expect(s.fake.calls).toHaveLength(2)
    expect(evt(s.logs, 'speaker_select_fallback')[0]).toMatchObject({ reason: 'timeout' })
  })

  it('SRV-T-274 speak_auto_records_usage_for_both_calls_and_gate_blocks_before_select', async () => {
    await insertRoom('a', 'A', 1, 100)
    await insertUser('a', '안녕', 1)
    const MONTH = kstMonthKey(T0)
    const s = setup([{ text: 'ciel' }, { text: '대사' }], { meter: true })
    await s.svc.speak('a', { character: 'auto' }, s.bg)
    expect(s.fake.calls).toHaveLength(2)
    expect((await usageRow(MONTH))?.calls).toBe(2)

    await env.DB.prepare('DELETE FROM llm_usage').run()
    await insertUsage(MONTH, 100000, 7)
    const over = setup([{ text: 'ciel' }, { text: 'x' }], { meter: true })
    expect(await codeOf(over.svc.speak('a', { character: 'auto' }, over.bg))).toBe(
      'LLM_BUDGET_EXCEEDED',
    )
    expect(over.fake.calls).toHaveLength(0)
    expect(await lockOf('a')).toBeNull()
  })

  it('SRV-T-275 speak_auto_shares_speak_lock', async () => {
    await insertRoom('a', 'A', 1, 100)
    await insertRoom('b', 'B', 1, 100)
    await env.DB.prepare('UPDATE rooms SET speaking_until = ?1 WHERE id = ?2')
      .bind(T0 + 50_000, 'b')
      .run()
    const locked = setup([{ text: 'ciel' }, { text: 'x' }])
    expect(await codeOf(locked.svc.speak('b', { character: 'auto' }, locked.bg))).toBe(
      'SPEAK_IN_PROGRESS',
    )
    expect(locked.fake.calls).toHaveLength(0)

    const gate = deferred()
    const started = deferred()
    const hold: FakeStep = async () => {
      started.resolve()
      await gate.promise
      return { text: 'ciel' }
    }
    const s = setup([hold, { text: '대사' }, { text: '다른 대사' }])
    const first = s.svc.speak('a', { character: 'auto' }, s.bg)
    await started.promise
    const second = s.svc.speak('a', { character: 'sebastian' }, s.bg)
    expect(await codeOf(second)).toBe('SPEAK_IN_PROGRESS')
    gate.resolve()
    expect((await first).speaker).toBe('ciel')
    expect(s.fake.calls).toHaveLength(2)
  })

  it('SRV-T-276 speak_auto_finishes_within_66s_llm_budget', async () => {
    await insertRoom('a', 'A', 1, 100)
    await insertUser('a', '안녕', 1)
    const holderA: { s?: Setup } = {}
    const clockOf = (): { t: number } => {
      if (holderA.s === undefined) throw new Error('setup missing')
      return holderA.s.clock
    }
    const a = setup([
      async () => timeoutAfter(clockOf(), 15_000)(),
      async i => timeoutAfter(clockOf(), i.timeoutMs)(),
    ])
    holderA.s = a
    expect(await codeOf(a.svc.speak('a', { character: 'auto' }, a.bg))).toBe('LLM_FAILED')
    expect(a.fake.calls).toHaveLength(2)
    expect(a.fake.calls[1]?.timeoutMs).toBe(51_000)
    expect(a.clock.t - T0).toBeLessThanOrEqual(70_000)
    expect(await lockOf('a')).toBeNull()

    const holderB: { s?: Setup } = {}
    const b = setup([
      async () => timeoutAfter(holderB.s?.clock ?? { t: 0 }, 15_000)(),
      async () => {
        if (holderB.s !== undefined) holderB.s.clock.t += 1000
        throw new LlmError('network')
      },
      { text: '대사' },
    ])
    holderB.s = b
    const m = await b.svc.speak('a', { character: 'auto' }, b.bg)
    expect(m.text).toBe('대사')
    expect(b.fake.calls[2]?.timeoutMs).toBe(49_000)
  })

  it('SRV-T-277 speak_auto_then_regenerate_keeps_character_without_select', async () => {
    await insertRoom('a', 'A', 1, 100)
    await insertUser('a', '안녕', 1)
    const s = setup([{ text: 'ciel' }, { text: '첫 대사' }, { text: '다시' }])
    const m = await s.svc.speak('a', { character: 'auto' }, s.bg)
    expect(m.speaker).toBe('ciel')
    const r = await s.svc.regenerate(m.id)
    expect(s.fake.calls).toHaveLength(3)
    expect(s.fake.calls[2]?.system).toBe(SPEAK_SYSTEM('ciel'))
    expect([r.speaker, r.text]).toEqual(['ciel', '다시'])
  })

  it('SRV-T-278 speak_rejects_invalid_targets_before_llm_and_db', async () => {
    await insertRoom('a', 'A', 1, 100)
    const s = setup([{ text: 'x' }])
    for (const bad of ['Auto', '', null, undefined, 'user', ' auto']) {
      expect(await codeOf(s.svc.speak('a', { character: bad as never }, s.bg))).toBe(
        'VALIDATION_ERROR',
      )
    }
    expect(s.fake.calls).toHaveLength(0)
    expect(await lockOf('a')).toBeNull()
  })
})

describe("speak 'auto' 이름 지목 (R-LLM-008 개정)", () => {
  beforeEach(resetDb)

  it('SRV-T-281 speak_auto_mention_skips_select_call_and_still_speaks', async () => {
    await insertRoom('a', 'A', 1, 100)
    await insertLine('a', '세바스찬 발화', 1)
    await insertUser('a', '시엘, 이쪽으로 와', 2)
    const s = setup([{ text: '대사' }], { meter: true })
    const m = await s.svc.speak('a', { character: 'auto' }, s.bg)
    expect(m.speaker).toBe('ciel')
    expect(s.fake.calls).toHaveLength(1)
    expect((await usageRow(kstMonthKey(T0)))?.calls).toBe(1)
    expect(s.logs.filter(l => l.event === 'speaker_select_fallback')).toHaveLength(0)
    expect(s.logs.find(l => l.event === 'speak_done')).toMatchObject({
      character: 'ciel',
      auto: true,
      selected: 'mention',
    })
    expect(s.logs.find(l => l.event === 'speaker_select')).toMatchObject({
      result: 'mention',
      character: 'ciel',
    })
  })
})

describe('S4 afterSpeak 등록 실패 삼킴 (messages.md §13.4)', () => {
  it('SRV-T-326 speak_survives_waitUntil_registration_failure', async () => {
    await resetDb()
    await insertRoom('a', 'A', 1, 100)
    const hook = vi.fn(async (_e: { roomId: string; messageId: number }) => undefined)
    const s = setup([{ text: '저장될 대사' }], { afterSpeak: hook })
    const m = await s.svc.speak(
      'a',
      { character: 'ciel' },
      {
        waitUntil: () => {
          throw new Error('no ctx')
        },
      },
    )
    expect(m.text).toBe('저장될 대사')
    const rows = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM messages WHERE room_id = 'a' AND speaker = 'ciel'",
    ).first<{ n: number }>()
    expect(rows?.n).toBe(1)
    expect(hook).toHaveBeenCalledTimes(1)
    const warn = s.logs.filter(l => l.event === 'after_speak_schedule_failed')
    expect(warn).toHaveLength(1)
    expect(warn[0]).toMatchObject({ level: 'warn', roomId: 'a', errName: 'Error' })
  })
})

describe('S3f 공장 D1 오류 (messages.md §14)', () => {
  beforeEach(resetDb)

  it('SRV-T-355 factory_rejection_propagates_before_lock_and_provider', async () => {
    await insertRoom('a', 'A', 1, 100)
    const targetId = await insertLine('a', '원문', 5)
    const llm = vi.fn(async (): Promise<Llm> => {
      throw new Error('d1 down')
    })
    const s = setup([{ text: '쓰이면 안 됨' }], { llm })
    await expect(s.svc.speak('a', { character: 'ciel' }, s.bg)).rejects.toThrow('d1 down')
    await expect(s.svc.regenerate(targetId)).rejects.toThrow('d1 down')
    expect(llm).toHaveBeenCalledTimes(2)
    expect(await lockOf('a')).toBeNull()
    expect(await countOf('a')).toBe(1)
    expect(s.fake.calls).toHaveLength(0)
  })
})
