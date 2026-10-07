// API-T-113~122 — doc/200_설계/contract/api.md §14.19 (E13·E14: 토큰 → 레이트리밋 → 본문 상한 → 형식 → 길이 → 방 존재)
import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test'
import { ERROR_STATUS, type ErrorCode } from '@shared/errors'
import { MEMORY_SUMMARY_MAX } from '@shared/limits'
import type { MemoryResponse, RoomSummary } from '@shared/types'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import type { Env } from '../src/env'
import { apiRoutes } from '../src/routes'
import { MEMORY_BODY_MAX_BYTES } from '../src/routes/schemas'
import { insertRoom, resetDb } from './helpers'
import { signTestToken } from './token'

const NOW = 1_700_000_000_000
const SECRET = 'test-secret-0123456789-abcdefghijklmnop'
const MIN_LEVEL = 5
const ROOM = 'room-1'
const BAD_FORM = '요청 형식이 올바르지 않습니다.'
const BAD_LENGTH = '장기기억은 0~4000자로 입력해 주세요.'
const NO_ROOM = '방을 찾을 수 없습니다.'

const baseEnv = (overrides: Record<string, unknown> = {}): Env =>
  ({
    DB: env.DB,
    ASSETS: { fetch: async () => new Response('<html></html>') } as unknown as Fetcher,
    TOKEN_SECRET: SECRET,
    LLM_PROVIDER: 'fake',
    ...overrides,
  }) as unknown as Env

const makeApp = (now: number) =>
  createApp({ routes: apiRoutes, logSink: () => undefined, now: () => now })
const app = makeApp(NOW)

const tokenFor = (level = MIN_LEVEL): Promise<string> =>
  signTestToken(
    { mb_id: 'writer_a', nick: '테스터', ch_name: '', level, exp: NOW / 1000 + 43200 },
    SECRET,
  )

type Opts = {
  token?: string | null
  body?: unknown
  contentType?: string | null
  env?: Env
  path?: string
  app?: typeof app
}

const pathOf = (id = ROOM): string => `/api/rooms/${id}/memory`

const send = async (method: string, opts: Opts = {}): Promise<Response> => {
  const headers: Record<string, string> = {}
  if (opts.token !== undefined && opts.token !== null)
    headers.Authorization = `Bearer ${opts.token}`
  const init: RequestInit = { method, headers }
  if (opts.body !== undefined) {
    const contentType = opts.contentType === undefined ? 'application/json' : opts.contentType
    if (contentType !== null) headers['Content-Type'] = contentType
    init.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)
  }
  const ctx = createExecutionContext()
  const res = await (opts.app ?? app).fetch(
    new Request(`http://test${opts.path ?? pathOf()}`, init),
    opts.env ?? baseEnv(),
    ctx,
  )
  await waitOnExecutionContext(ctx)
  return res
}

const get = async (opts: Opts = {}): Promise<Response> =>
  send('GET', { token: await tokenFor(), ...opts })
/** summary 를 { summary } 본문으로 보낸다. opts.body 가 있으면 그것이 우선 */
const put = async (summary: unknown, opts: Opts = {}): Promise<Response> =>
  send('PUT', { token: await tokenFor(), body: { summary }, ...opts })

const RETRY_AFTER: Partial<Record<ErrorCode, number>> = { RATE_LIMITED: 40 }
const expectContractError = async (res: Response, code: ErrorCode): Promise<string> => {
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

type MemoryRow = { summary: string; source_until_id: number; updated_at: number }
const memoryRow = async (room = ROOM): Promise<MemoryRow | null> =>
  env.DB.prepare('SELECT summary, source_until_id, updated_at FROM memory WHERE room_id = ?1')
    .bind(room)
    .first<MemoryRow>()
const memoryCount = async (): Promise<number> =>
  (await env.DB.prepare('SELECT COUNT(*) AS n FROM memory').first<{ n: number }>())?.n ?? -1
const insertMemory = async (
  summary: string,
  sourceUntilId: number,
  updatedAt: number,
  room = ROOM,
): Promise<void> => {
  await env.DB.prepare(
    'INSERT INTO memory (room_id, summary, source_until_id, updated_at) VALUES (?1, ?2, ?3, ?4)',
  )
    .bind(room, summary, sourceUntilId, updatedAt)
    .run()
}
const roomUpdatedAt = async (): Promise<number | undefined> =>
  (
    await env.DB.prepare('SELECT updated_at AS u FROM rooms WHERE id = ?1')
      .bind(ROOM)
      .first<{ u: number }>()
  )?.u
const listIds = async (): Promise<string[]> =>
  (await (await get({ path: '/api/rooms' })).json<RoomSummary[]>()).map(r => r.id)

/** 공백 패딩으로 JSON 본문 바이트 수를 맞춘다 (유효 JSON 유지) */
const bodyOfBytes = (bytes: number): string => {
  const base = JSON.stringify({ summary: 'a' })
  return base + ' '.repeat(bytes - new TextEncoder().encode(base).length)
}

beforeEach(async () => {
  await resetDb()
  await insertRoom(ROOM, '방', 1, 100)
})

describe('E13·E14 인증', () => {
  it('API-T-113 memory_require_token', async () => {
    await insertMemory('원본', 3, 50)
    const valid = await tokenFor()
    const low = await tokenFor(MIN_LEVEL - 1)
    for (const method of ['GET', 'PUT']) {
      const base = method === 'PUT' ? { body: { summary: 'x' } } : {}
      await expectContractError(await send(method, { ...base }), 'TOKEN_REQUIRED')
      await expectContractError(await send(method, { ...base, token: 'garbage' }), 'TOKEN_INVALID')
      await expectContractError(
        await send(method, { ...base, path: `${pathOf()}?t=${valid}` }),
        'TOKEN_REQUIRED',
      )
      await expectContractError(await send(method, { ...base, token: low }), 'LEVEL_TOO_LOW')
    }
    expect((await send('PUT', { body: '{broken' })).status).toBe(401)
    expect(await memoryRow()).toEqual({ summary: '원본', source_until_id: 3, updated_at: 50 })
  })
})

describe('E13 GET', () => {
  it('API-T-114 memory_get_default_without_row', async () => {
    const res = await get()
    expect(res.status).toBe(200)
    const body = await res.json<Record<string, unknown>>()
    expect(Object.keys(body)).toEqual(['summary', 'sourceUntilId', 'updatedAt'])
    expect(body).toEqual({ summary: '', sourceUntilId: 0, updatedAt: null })
    expect(await memoryCount()).toBe(0)
  })

  it('API-T-115 memory_get_returns_row', async () => {
    await insertMemory('지난 요약\n둘째 줄', 21, NOW - 1000)
    const res = await get()
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(JSON.parse(text)).toEqual({
      summary: '지난 요약\n둘째 줄',
      sourceUntilId: 21,
      updatedAt: NOW - 1000,
    })
    expect(text).not.toContain('writer_a')
    expect(text).not.toContain('roomId')
    expect(text).not.toContain(ROOM)
  })
})

describe('E13·E14 방 존재', () => {
  it('API-T-116 memory_404_for_missing_room', async () => {
    expect(await expectContractError(await get({ path: pathOf('nope') }), 'NOT_FOUND')).toBe(
      NO_ROOM,
    )
    expect(await expectContractError(await put('a', { path: pathOf('nope') }), 'NOT_FOUND')).toBe(
      NO_ROOM,
    )
    const token = await tokenFor()
    expect((await send('DELETE', { token, path: `/api/rooms/${ROOM}` })).status).toBe(204)
    expect(await expectContractError(await get(), 'NOT_FOUND')).toBe(NO_ROOM)
    expect(await memoryCount()).toBe(0)
    const tooLong = await put('a'.repeat(MEMORY_SUMMARY_MAX + 1), { path: pathOf('nope') })
    expect(await expectContractError(tooLong, 'VALIDATION_ERROR')).toBe(BAD_LENGTH)
  })
})

describe('E14 PUT 저장', () => {
  it('API-T-117 memory_put_replaces_and_keeps_source', async () => {
    await insertRoom('room-2', '둘째', 2, 200)
    await insertMemory('old', 7, 10)
    const before = await roomUpdatedAt()
    const order = await listIds()

    const res = await put('  새 요약\n둘째 줄  ')
    expect(res.status).toBe(200)
    const expected = { summary: '새 요약\n둘째 줄', sourceUntilId: 7, updatedAt: NOW }
    expect(await res.json<MemoryResponse>()).toEqual(expected)
    expect(await (await get()).json<MemoryResponse>()).toEqual(expected)
    expect((await memoryRow())?.source_until_id).toBe(7)

    const fresh = await put('a', { path: pathOf('room-2') })
    expect(fresh.status).toBe(200)
    expect((await fresh.json<MemoryResponse>()).sourceUntilId).toBe(0)
    expect((await memoryRow('room-2'))?.summary).toBe('a')

    expect(await roomUpdatedAt()).toBe(before)
    expect(await listIds()).toEqual(order)
  })

  it('API-T-118 memory_put_length_by_code_points', async () => {
    const emoji = '😀'
    const accepted: Array<[string, string]> = [
      ['', ''],
      ['   ', ''],
      ['a'.repeat(4000), 'a'.repeat(4000)],
      [emoji.repeat(4000), emoji.repeat(4000)],
      [`  ${'a'.repeat(4000)}  `, 'a'.repeat(4000)],
    ]
    for (const [input, saved] of accepted) {
      const res = await put(input)
      expect(res.status).toBe(200)
      expect((await res.json<MemoryResponse>()).summary).toBe(saved)
    }
    const stored = await memoryRow()
    for (const input of ['a'.repeat(4001), emoji.repeat(4001)]) {
      expect(await expectContractError(await put(input), 'VALIDATION_ERROR')).toBe(BAD_LENGTH)
    }
    expect(await memoryRow()).toEqual(stored)
  })

  it('API-T-119 memory_put_rejects_bad_body', async () => {
    await insertMemory('원본', 3, 50)
    const raw = (body: unknown, contentType?: string | null) =>
      put(undefined, { body, ...(contentType !== undefined && { contentType }) })
    const bad = [
      await raw({ summary: 1 }),
      await raw({ summary: null }),
      await raw({}),
      await raw([]),
      await raw('{broken'),
      await raw('{"summary":"x"}', 'text/plain'),
    ]
    for (const res of bad) {
      expect(await expectContractError(res, 'VALIDATION_ERROR')).toBe(BAD_FORM)
    }
    expect(await memoryRow()).toEqual({ summary: '원본', source_until_id: 3, updated_at: 50 })

    const extra = await raw({ summary: 'x', extra: 1 })
    expect(extra.status).toBe(200)
    expect(Object.keys(await extra.json<Record<string, unknown>>()).sort()).toEqual([
      'sourceUntilId',
      'summary',
      'updatedAt',
    ])
  })

  it('API-T-120 memory_put_body_over_32kib', async () => {
    expect(MEMORY_BODY_MAX_BYTES).toBe(32_768)
    await insertMemory('원본', 3, 50)
    const over = await put(undefined, { body: bodyOfBytes(MEMORY_BODY_MAX_BYTES + 1) })
    expect(await expectContractError(over, 'VALIDATION_ERROR')).toBe(BAD_FORM)
    expect(await memoryRow()).toEqual({ summary: '원본', source_until_id: 3, updated_at: 50 })

    const exact = await put(undefined, { body: bodyOfBytes(MEMORY_BODY_MAX_BYTES) })
    expect(exact.status).toBe(200)

    const controlBody = JSON.stringify({ summary: '\u0001'.repeat(4000) })
    expect(controlBody).toHaveLength(24_014)
    expect((await put(undefined, { body: controlBody })).status).toBe(200)

    await resetDb()
    await insertRoom(ROOM, '방', 1, 100)
    const limited = baseEnv({ RATE_LIMIT_PER_MIN: '1' })
    const first = await put(undefined, {
      body: bodyOfBytes(MEMORY_BODY_MAX_BYTES + 1),
      env: limited,
    })
    expect(first.status).toBe(400)
    await expectContractError(await put('b', { env: limited }), 'RATE_LIMITED')
  })
})

describe('E14 레이트리밋 · 메서드', () => {
  it('API-T-121 memory_put_rate_limited_get_not', async () => {
    const limited = baseEnv({ RATE_LIMIT_PER_MIN: '2' })
    expect((await put('a', { env: limited })).status).toBe(200)
    expect((await put('a', { env: limited })).status).toBe(200)
    await expectContractError(await put('a', { env: limited }), 'RATE_LIMITED')
    for (let i = 0; i < 3; i += 1) expect((await get({ env: limited })).status).toBe(200)

    const next = makeApp(NOW + 60_000)
    expect((await put('a', { env: limited, app: next })).status).toBe(200)
    const created = await send('POST', {
      token: await tokenFor(),
      body: { title: '새 방' },
      path: '/api/rooms',
      env: limited,
      app: next,
    })
    expect(created.status).toBe(201)
    expect((await put('a', { env: limited, app: next })).status).toBe(429)

    const later = makeApp(NOW + 120_000)
    for (let i = 0; i < 3; i += 1) {
      const res = await send('PUT', { body: { summary: 'a' }, env: limited, app: later })
      expect(res.status).toBe(401)
    }
    expect((await put('a', { env: limited, app: later })).status).toBe(200)
    expect((await put('a', { env: limited, app: later })).status).toBe(200)
  })

  it('API-T-122 memory_unregistered_methods_404', async () => {
    const token = await tokenFor()
    for (const method of ['POST', 'PATCH', 'DELETE']) {
      await expectContractError(await send(method, { token }), 'NOT_FOUND')
    }
    await expectContractError(await send('GET', { token, path: `${pathOf()}/x` }), 'NOT_FOUND')
  })
})
