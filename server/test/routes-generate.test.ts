// API-T-070~084 — doc/200_설계/contract/api.md §14.9 (E9 speak · E12 regenerate 라우트)
// 성공 경로는 LLM_PROVIDER=fake, 502 경로는 google + 가짜 키 + 전역 fetch 대체(실제 네트워크 0회)
import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test'
import { CHARACTERS } from '@shared/characters'
import { ERROR_MESSAGES, ERROR_STATUS, type ErrorCode } from '@shared/errors'
import type { Message, MessagesPage } from '@shared/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app'
import type { Env } from '../src/env'
import { FAKE_DEFAULT_TEXT } from '../src/llm'
import { apiRoutes } from '../src/routes'
import { insertLine, insertRoom, insertUsage, resetDb, usageRow } from './helpers'
import { signTestToken } from './token'

const NOW = 1_700_000_000_000
const SECRET = 'test-secret-0123456789-abcdefghijklmnop'
const FAKE_KEY = 'not-a-real-key'
const ROOM = 'room-1'
const BAD_FORM = '요청 형식이 올바르지 않습니다.'
const NO_ROOM = '방을 찾을 수 없습니다.'
const NO_MESSAGE = '메시지를 찾을 수 없습니다.'

const baseEnv = (overrides: Record<string, unknown> = {}): Env =>
  ({
    DB: env.DB,
    ASSETS: { fetch: async () => new Response('<html></html>') } as unknown as Fetcher,
    TOKEN_SECRET: SECRET,
    LLM_PROVIDER: 'fake',
    ...overrides,
  }) as unknown as Env

const googleEnv = (overrides: Record<string, unknown> = {}): Env =>
  baseEnv({ LLM_PROVIDER: 'google', LLM_API_KEY: FAKE_KEY, ...overrides })

const noKeyEnv = (): Env => baseEnv({ LLM_PROVIDER: 'google' })

const app = createApp({ routes: apiRoutes, logSink: () => undefined, now: () => NOW })

const token = (): Promise<string> =>
  signTestToken(
    { mb_id: 'writer_a', nick: '테스터', ch_name: '', level: 5, exp: NOW / 1000 + 43200 },
    SECRET,
  )

type Body = unknown

const call = async (
  method: string,
  path: string,
  opts: { body?: Body; e?: Env; auth?: boolean; contentType?: string | null } = {},
): Promise<Response> => {
  const headers: Record<string, string> = {}
  if (opts.auth !== false) headers.Authorization = `Bearer ${await token()}`
  const contentType = opts.contentType === undefined ? 'application/json' : opts.contentType
  const init: RequestInit = { method, headers }
  if (opts.body !== undefined) {
    if (contentType !== null) headers['Content-Type'] = contentType
    init.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)
  }
  const ctx = createExecutionContext()
  const res = await app.fetch(new Request(`http://test${path}`, init), opts.e ?? baseEnv(), ctx)
  await waitOnExecutionContext(ctx) // S4: speak 성공이 waitUntil 로 자동 요약을 등록한다
  return res
}

const speak = (body: Body, opts: { e?: Env; room?: string; contentType?: string | null } = {}) =>
  call('POST', `/api/rooms/${opts.room ?? ROOM}/speak`, { body, ...opts })

const regenerate = (id: number | string, opts: { e?: Env; body?: Body } = {}) =>
  call('POST', `/api/messages/${id}/regenerate`, opts)

/** 429 두 코드만 retryAfterSec(+ Retry-After 헤더)를 갖는다. 값은 코드별 — NOW 기준 40 / 1356400 */
const RETRY_AFTER: Partial<Record<ErrorCode, number>> = {
  RATE_LIMITED: 40,
  LLM_BUDGET_EXCEEDED: 1_356_400,
}

/** 계약 에러 본문: code · message 두 키(429 두 코드는 retryAfterSec 포함), status 는 표대로. message 를 돌려준다 */
const expectError = async (res: Response, code: ErrorCode): Promise<string> => {
  expect(res.status).toBe(ERROR_STATUS[code])
  const body = await res.json<Record<string, Record<string, unknown>>>()
  expect(Object.keys(body)).toEqual(['error'])
  const retry = RETRY_AFTER[code]
  const keys = retry === undefined ? ['code', 'message'] : ['code', 'message', 'retryAfterSec']
  expect(Object.keys(body.error ?? {}).sort()).toEqual(keys)
  expect(body.error?.code).toBe(code)
  if (retry !== undefined) {
    expect(body.error?.retryAfterSec).toBe(retry)
    expect(res.headers.get('Retry-After')).toBe(String(retry))
  }
  return String(body.error?.message)
}

const insertMessage = async (
  speaker: 'user' | 'sebastian' | 'ciel',
  kind: 'line' | 'ooc',
  text: string,
  createdAt: number,
): Promise<number> => {
  const row = await env.DB.prepare(
    'INSERT INTO messages (room_id, speaker, kind, text, author_mb_id, author_name, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) RETURNING id',
  )
    .bind(
      ROOM,
      speaker,
      kind,
      text,
      speaker === 'user' ? 'writer_a' : null,
      speaker === 'user' ? '테스터' : null,
      createdAt,
    )
    .first<{ id: number }>()
  return (row as { id: number }).id
}

const lockRoom = async (until: number): Promise<void> => {
  await env.DB.prepare('UPDATE rooms SET speaking_until = ?1 WHERE id = ?2').bind(until, ROOM).run()
}

type RoomRow = { updated_at: number; speaking_until: number | null }
const roomRow = async (): Promise<RoomRow> =>
  (await env.DB.prepare('SELECT updated_at, speaking_until FROM rooms WHERE id = ?1')
    .bind(ROOM)
    .first<RoomRow>()) as RoomRow

const countMessages = async (): Promise<number> =>
  (await env.DB.prepare('SELECT COUNT(*) AS n FROM messages').first<{ n: number }>())?.n ?? -1

const textOf = async (id: number): Promise<string | undefined> =>
  (
    await env.DB.prepare('SELECT text FROM messages WHERE id = ?1')
      .bind(id)
      .first<{ text: string }>()
  )?.text

const history = async (): Promise<Message[]> =>
  (await (await call('GET', `/api/rooms/${ROOM}/messages`, { auth: false })).json<MessagesPage>())
    .messages

/** 전역 fetch 를 제공사 응답으로 대체한다 */
const stubProvider = (respond: () => Response) => {
  const fn = vi.fn(async () => respond())
  vi.stubGlobal('fetch', fn)
  return fn
}
const geminiText = (text: string): Response =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), {
    status: 200,
  })
const geminiBlocked = (): Response =>
  new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }), { status: 200 })
const providerHttp400 = (): Response =>
  new Response(JSON.stringify({ error: { status: 'INVALID_ARGUMENT', message: 'x' } }), {
    status: 400,
  })

const expectUntouched = async (before: number, updatedAt: number): Promise<void> => {
  expect(await countMessages()).toBe(before)
  const room = await roomRow()
  expect(room.updated_at).toBe(updatedAt)
  expect(room.speaking_until).toBeNull()
}

let firstId = 0

beforeEach(async () => {
  await resetDb()
  await insertRoom(ROOM, '방', 1, 100)
  firstId = await insertLine(ROOM, '원문', 5)
})
afterEach(() => vi.unstubAllGlobals())

describe('POST /api/rooms/:id/speak', () => {
  it('API-T-070 speak_returns_201_character_message', async () => {
    for (const body of [{ character: 'sebastian' }, { character: 'ciel', foo: 1 }]) {
      await env.DB.prepare('UPDATE rooms SET updated_at = 100').run()
      const res = await speak(body)
      expect(res.status).toBe(201)
      const msg = await res.json<Message>()
      expect(Object.keys(msg).sort()).toEqual([
        'authorName',
        'createdAt',
        'id',
        'kind',
        'roomId',
        'speaker',
        'text',
      ])
      expect(msg).toMatchObject({
        roomId: ROOM,
        speaker: body.character,
        kind: 'line',
        authorName: null,
        text: FAKE_DEFAULT_TEXT,
        createdAt: NOW,
      })
      expect(msg.text).not.toBe('')
      expect(await roomRow()).toEqual({ updated_at: NOW, speaking_until: null })
      const row = await env.DB.prepare('SELECT author_mb_id AS a FROM messages WHERE id = ?1')
        .bind(msg.id)
        .first<{ a: string | null }>()
      expect(row?.a).toBeNull()
    }
  })

  it('API-T-071 speak_allows_same_character_twice', async () => {
    const a = await (await speak({ character: 'ciel' })).json<Message>()
    const bRes = await speak({ character: 'ciel' })
    expect(bRes.status).toBe(201)
    const b = await bRes.json<Message>()
    expect(b.id).toBeGreaterThan(a.id)
    const last = (await history()).slice(-2)
    expect(last.map(m => m.speaker)).toEqual(['ciel', 'ciel'])
  })

  it('API-T-072 speak_rejects_bad_character', async () => {
    const before = await countMessages()
    const bodies: Body[] = [
      {},
      { character: 'meirin' },
      { character: 'Sebastian' },
      { character: '' },
      { character: 1 },
      { character: null },
      { character: 'auto ' },
      '{broken',
    ]
    for (const body of bodies) {
      expect(await expectError(await speak(body), 'VALIDATION_ERROR')).toBe(BAD_FORM)
    }
    const noType = await speak('{"character":"ciel"}', { contentType: null })
    expect(await expectError(noType, 'VALIDATION_ERROR')).toBe(BAD_FORM)
    expect(await countMessages()).toBe(before)
  })

  it('API-T-073 speak_checks_validation_then_config_then_room', async () => {
    const first = await speak({ character: 'meirin' }, { room: 'nope' })
    await expectError(first, 'VALIDATION_ERROR')
    const second = await speak({ character: 'ciel' }, { room: 'nope', e: noKeyEnv() })
    const message = await expectError(second, 'CONFIG_INVALID')
    expect(message).not.toContain('LLM_API_KEY')
    const third = await speak({ character: 'ciel' }, { room: 'nope' })
    expect(await expectError(third, 'NOT_FOUND')).toBe(NO_ROOM)
  })
})

describe('생성 공통', () => {
  it('API-T-074 config_invalid_only_on_generate_paths', async () => {
    const e = noKeyEnv()
    expect((await call('GET', '/api/rooms', { e, auth: false })).status).toBe(200)
    const user = await call('POST', `/api/rooms/${ROOM}/user`, {
      e,
      body: { text: '안녕', ooc: false },
    })
    expect(user.status).toBe(201)
    await expectError(await speak({ character: 'ciel' }, { e }), 'CONFIG_INVALID')
    await expectError(await regenerate(firstId, { e }), 'CONFIG_INVALID')
  })

  it('API-T-075 generate_returns_409_while_locked', async () => {
    const lastId = await insertMessage('ciel', 'line', '뒤', 6)
    await lockRoom(NOW + 1)
    const before = await countMessages()
    await expectError(await speak({ character: 'ciel' }), 'SPEAK_IN_PROGRESS')
    await expectError(await regenerate(lastId), 'SPEAK_IN_PROGRESS')
    await expectError(await regenerate(firstId), 'SPEAK_IN_PROGRESS')
    expect(await countMessages()).toBe(before)
    expect(await textOf(lastId)).toBe('뒤')
    await lockRoom(NOW)
    expect((await speak({ character: 'ciel' })).status).toBe(201)
  })

  it('API-T-076 speak_maps_provider_failures_to_502', async () => {
    const cases: Array<[() => Response, ErrorCode]> = [
      [providerHttp400, 'LLM_FAILED'],
      [geminiBlocked, 'LLM_EMPTY'],
      [() => geminiText(`${CHARACTERS.sebastian.shortName}:`), 'LLM_EMPTY'],
    ]
    for (const [respond, code] of cases) {
      stubProvider(respond)
      const res = await speak({ character: 'sebastian' }, { e: googleEnv() })
      const message = await expectError(res, code)
      expect(message).toBe(ERROR_MESSAGES[code])
      expect(message).not.toMatch(/gemini|google|400|SAFETY|blockReason/i)
      await expectUntouched(1, 100)
    }
  })

  it('API-T-077 failed_generates_count_toward_rate_limit', async () => {
    const e = googleEnv({ RATE_LIMIT_PER_MIN: '2' })
    stubProvider(providerHttp400)
    await expectError(await speak({ character: 'ciel' }, { e }), 'LLM_FAILED')
    await lockRoom(NOW + 1)
    await expectError(await speak({ character: 'ciel' }, { e }), 'SPEAK_IN_PROGRESS')
    await lockRoom(NOW)
    await expectError(await speak({ character: 'ciel' }, { e }), 'RATE_LIMITED')
  })

  it('API-T-084 generate_paths_reject_other_methods', async () => {
    const calls: Array<[string, string]> = [
      ['GET', `/api/rooms/${ROOM}/speak`],
      ['PUT', `/api/rooms/${ROOM}/speak`],
      ['GET', `/api/messages/${firstId}/regenerate`],
    ]
    for (const [method, path] of calls) {
      await expectError(await call(method, path), 'NOT_FOUND')
    }
  })
})

describe('POST /api/messages/:id/regenerate', () => {
  it('API-T-078 regenerate_returns_200_and_keeps_meta', async () => {
    await insertMessage('user', 'line', '유저', 400)
    const id = await insertMessage('sebastian', 'line', '옛 대사', 500)
    const bodies: Array<Body | undefined> = [undefined, { x: 1 }, '{broken']
    for (const body of bodies) {
      await env.DB.prepare('UPDATE rooms SET updated_at = 100').run()
      await env.DB.prepare('UPDATE messages SET text = ?1 WHERE id = ?2').bind('옛 대사', id).run()
      const before = await countMessages()
      const res = await regenerate(id, { body })
      expect(res.status).toBe(200)
      expect(await res.json<Message>()).toEqual({
        id,
        roomId: ROOM,
        speaker: 'sebastian',
        kind: 'line',
        text: FAKE_DEFAULT_TEXT,
        authorName: null,
        createdAt: 500,
      })
      expect((await roomRow()).updated_at).toBe(NOW)
      expect(await countMessages()).toBe(before)
    }
  })

  it('API-T-079 regenerate_rejects_user_message', async () => {
    const line = await insertMessage('user', 'line', '유저', 6)
    const message = await expectError(await regenerate(line), 'NOT_CHARACTER_MESSAGE')
    expect(message).toBe(ERROR_MESSAGES.NOT_CHARACTER_MESSAGE)
    const ooc = await insertMessage('user', 'ooc', '지시', 7)
    await expectError(await regenerate(ooc), 'NOT_CHARACTER_MESSAGE')
    await expectError(await regenerate(line), 'NOT_CHARACTER_MESSAGE')
  })

  it('API-T-080 regenerate_rejects_non_last_character_message', async () => {
    await insertMessage('user', 'line', '뒤', 6)
    const message = await expectError(await regenerate(firstId), 'NOT_LAST_MESSAGE')
    expect(message).toBe(ERROR_MESSAGES.NOT_LAST_MESSAGE)
    expect(await textOf(firstId)).toBe('원문')
    expect((await roomRow()).speaking_until).toBeNull()
  })

  it('API-T-081 regenerate_checks_target_then_config', async () => {
    const e = noKeyEnv()
    const userId = await insertMessage('user', 'line', '유저', 6)
    await expectError(await regenerate(userId, { e }), 'NOT_CHARACTER_MESSAGE')
    await expectError(await regenerate(999_999, { e }), 'NOT_FOUND')
    const lastId = await insertMessage('ciel', 'line', '마지막', 7)
    await expectError(await regenerate(lastId, { e }), 'CONFIG_INVALID')
  })

  it('API-T-082 regenerate_message_id_errors', async () => {
    for (const id of ['abc', '0', '1.5', '0x10', '1e1', '999999999']) {
      const message = await expectError(await regenerate(id), 'NOT_FOUND')
      expect(message, id).toBe(NO_MESSAGE)
    }
  })

  it('API-T-083 regenerate_failure_keeps_text', async () => {
    stubProvider(providerHttp400)
    const res = await regenerate(firstId, { e: googleEnv() })
    await expectError(res, 'LLM_FAILED')
    expect(await textOf(firstId)).toBe('원문')
    await expectUntouched(1, 100)
  })
})

describe('S4 자동 요약은 speak 응답을 막지 않는다 (R-MEM-002)', () => {
  const MEMORY_ENV = { CONTEXT_MESSAGES: '1', MEMORY_SUMMARY_THRESHOLD: '2' }
  type MemoryBody = { summary: string; sourceUntilId: number; updatedAt: number | null }
  const readMemory = async (): Promise<MemoryBody> =>
    (await call('GET', `/api/rooms/${ROOM}/memory`)).json<MemoryBody>()

  const expectCielLine = async (res: Response): Promise<void> => {
    expect(res.status).toBe(201)
    const body = await res.json<Message>()
    expect(body).toMatchObject({ speaker: 'ciel', kind: 'line', authorName: null })
    expect(Object.keys(body)).not.toContain('summary')
    expect(JSON.stringify(body)).not.toMatch(/summary|sourceUntilId/)
  }

  it('API-T-123 speak_ok_even_if_summary_fails', async () => {
    const secondId = await insertMessage('user', 'line', '둘째', 6)

    const ok = await speak({ character: 'ciel' }, { e: baseEnv(MEMORY_ENV) })
    await expectCielLine(ok)
    const done = await readMemory()
    expect(done.sourceUntilId).toBe(secondId)
    expect(done.summary).not.toBe('')

    await resetDb()
    await insertRoom(ROOM, '방', 1, 100)
    await insertLine(ROOM, '원문', 5)
    await insertMessage('user', 'line', '둘째', 6)
    let calls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => (++calls === 1 ? geminiText('생성 대사') : providerHttp400())),
    )
    const failed = await speak({ character: 'ciel' }, { e: googleEnv(MEMORY_ENV) })
    await expectCielLine(failed)
    expect(calls).toBe(2)
    expect(await readMemory()).toEqual({ summary: '', sourceUntilId: 0, updatedAt: null })
    expect(await countMessages()).toBe(3)
  })
})

describe('S3b 월 예산 게이트 (R-LLM-007)', () => {
  const MONTH = '2023-11'
  const OVER = 100_000
  const BUDGET_TEXT = '이번 달 AI 사용 한도에 닿았습니다. 다음 달에 다시 시도해 주세요.'

  it('API-T-085 speak_returns_429_budget_exceeded_with_retry_after', async () => {
    await insertUsage(MONTH, OVER)
    const res = await speak({ character: 'sebastian' })
    expect(res.headers.get('Content-Security-Policy')).toContain('frame-ancestors')
    const raw = await res.clone().text()
    expect(raw).not.toMatch(/estKrw|est_krw|monthlyBudget|"100000"/i)
    const message = await expectError(res, 'LLM_BUDGET_EXCEEDED')
    expect(message).toBe(BUDGET_TEXT)
    expect(message).toBe(ERROR_MESSAGES.LLM_BUDGET_EXCEEDED)
    await expectUntouched(1, 100)
    expect((await usageRow(MONTH))?.calls).toBe(1)

    await resetDb()
    await insertRoom(ROOM, '방', 1, 100)
    await insertLine(ROOM, '원문', 5)
    await insertUsage(MONTH, 99_999.9)
    expect((await speak({ character: 'sebastian' })).status).toBe(201)
  })

  it('API-T-086 speak_budget_gate_order', async () => {
    await insertUsage(MONTH, OVER)
    await expectError(await speak({ character: 'meirin' }), 'VALIDATION_ERROR')
    await expectError(await speak({ character: 'ciel' }, { e: noKeyEnv() }), 'CONFIG_INVALID')
    await expectError(await speak({ character: 'ciel' }, { room: 'nope' }), 'LLM_BUDGET_EXCEEDED')
    await lockRoom(NOW + 1)
    await expectError(await speak({ character: 'ciel' }), 'LLM_BUDGET_EXCEEDED')
  })

  it('API-T-087 regenerate_budget_gate_order_and_keeps_text', async () => {
    await insertUsage(MONTH, OVER)
    await expectError(await regenerate(999_999), 'NOT_FOUND')
    const userId = await insertMessage('user', 'line', '유저', 6)
    await expectError(await regenerate(userId), 'NOT_CHARACTER_MESSAGE')
    // firstId 는 이제 마지막이 아니다 — 그래도 예산이 먼저
    await expectError(await regenerate(firstId), 'LLM_BUDGET_EXCEEDED')
    const lastId = await insertMessage('ciel', 'line', '마지막', 7)
    await expectError(await regenerate(lastId), 'LLM_BUDGET_EXCEEDED')
    expect(await textOf(lastId)).toBe('마지막')
    expect(await textOf(firstId)).toBe('원문')
    expect(await roomRow()).toEqual({ updated_at: 100, speaking_until: null })
    await expectError(await regenerate(lastId, { e: noKeyEnv() }), 'CONFIG_INVALID')
  })

  it('API-T-088 budget_exceeded_only_on_generate_paths', async () => {
    await insertUsage(MONTH, OVER)
    const health = await call('GET', '/api/health', { auth: false })
    expect(health.status).toBe(200)
    expect(JSON.stringify(await health.json())).not.toMatch(/usage|budget|estKrw/i)
    expect((await call('GET', '/api/rooms', { auth: false })).status).toBe(200)
    expect((await call('GET', `/api/rooms/${ROOM}/messages`, { auth: false })).status).toBe(200)
    expect((await call('POST', '/api/rooms', { body: { title: '새 방' } })).status).toBe(201)
    const user = { text: '안녕', ooc: false }
    expect((await call('POST', `/api/rooms/${ROOM}/user`, { body: user })).status).toBe(201)
    const edit = await call('PATCH', `/api/messages/${firstId}`, { body: { text: '고침' } })
    expect(edit.status).toBe(200)
    expect((await call('DELETE', `/api/messages/${firstId}`)).status).toBe(204)
  })

  it('API-T-089 budget_rejections_count_toward_rate_limit', async () => {
    await insertUsage(MONTH, OVER)
    const e = baseEnv({ RATE_LIMIT_PER_MIN: '2' })
    await expectError(await speak({ character: 'ciel' }, { e }), 'LLM_BUDGET_EXCEEDED')
    await expectError(await speak({ character: 'ciel' }, { e }), 'LLM_BUDGET_EXCEEDED')
    await expectError(await speak({ character: 'ciel' }, { e }), 'RATE_LIMITED')
  })

  it('API-T-090 budget_uses_current_kst_month_only', async () => {
    await insertUsage('2023-10', OVER)
    expect((await speak({ character: 'sebastian' })).status).toBe(201)
  })
})

describe('S3d speak 대상 auto (R-MSG-009 · R-MSG-003)', () => {
  const MONTH = '2023-11'
  const USER_LINE = { text: '안녕', ooc: false }

  it('API-T-109 speak_auto_returns_201_with_character_speaker', async () => {
    const before = await countMessages()
    const res = await speak({ character: 'auto' })
    expect(res.status).toBe(201)
    const raw = await res.clone().text()
    expect(raw).not.toContain('"auto"')
    const msg = await res.json<Message>()
    expect(['sebastian', 'ciel']).toContain(msg.speaker)
    expect(msg).toMatchObject({ kind: 'line', authorName: null })
    expect(await countMessages()).toBe(before + 1)
    const row = await env.DB.prepare('SELECT speaker AS s FROM messages WHERE id = ?1')
      .bind(msg.id)
      .first<{ s: string }>()
    expect(row?.s).toBe(msg.speaker)
  })

  it('API-T-110 speak_rejects_invalid_targets', async () => {
    const before = await countMessages()
    const bad: Body[] = [
      { character: 'Auto' },
      { character: 'AUTO' },
      { character: ' auto' },
      { character: '' },
      { character: null },
      { character: true },
      {},
    ]
    for (const body of bad) {
      expect(await expectError(await speak(body), 'VALIDATION_ERROR')).toBe(BAD_FORM)
    }
    expect(await countMessages()).toBe(before)
    for (const character of ['sebastian', 'ciel', 'auto']) {
      expect((await speak({ character })).status, character).toBe(201)
    }
  })

  it('API-T-111 speak_auto_shares_lock_budget_rate_limit', async () => {
    await lockRoom(NOW + 1)
    await expectError(await speak({ character: 'auto' }), 'SPEAK_IN_PROGRESS')
    await lockRoom(NOW)

    await insertUsage(MONTH, 100_000)
    await expectError(await speak({ character: 'auto' }), 'LLM_BUDGET_EXCEEDED')
    expect((await usageRow(MONTH))?.calls).toBe(1)
    await env.DB.prepare('DELETE FROM llm_usage').run()
    await env.DB.prepare('DELETE FROM rate_limits').run()

    const e = baseEnv({ RATE_LIMIT_PER_MIN: '2' })
    const user = (): Promise<Response> =>
      call('POST', `/api/rooms/${ROOM}/user`, { body: USER_LINE, e })
    expect((await user()).status).toBe(201)
    expect((await speak({ character: 'auto' }, { e })).status).toBe(201)
    await expectError(await user(), 'RATE_LIMITED')
  })
})
