// SRV-T-191~209 — doc/200_설계/server/messages.md §8.2 (speak·regenerate·잠금). D1 + FakeProvider + 가짜 시계
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '../src/app-error'
import { createDb, type Db } from '../src/db'
import { ConfigError, parseEnv } from '../src/env'
import { buildSpeakPrompt, createLlm, FakeProvider, type FakeStep, type Llm } from '../src/llm'
import { LlmError } from '../src/llm/provider'
import { createLogger } from '../src/logger'
import { createMessagesService, SPEAK_LOCK_MS, type MessagesService } from '../src/messages'
import { createServices } from '../src/services'
import { insertLine, insertRoom, resetDb } from './helpers'

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
  afterSpeak?: (e: { roomId: string; messageId: number }) => Promise<void>
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
    })
  const svc = createMessagesService({
    db,
    now,
    logger,
    contextMessages: opts.contextMessages ?? 40,
    llm,
    ...(opts.afterSpeak === undefined ? {} : { afterSpeak: opts.afterSpeak }),
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
      llm,
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
          TOKEN_SECRET: 'test-secret-value',
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
      llm,
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
