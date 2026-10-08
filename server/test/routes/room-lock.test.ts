// API-T-140~163 — doc/200_설계/contract/api.md §14.22 (방 비밀번호 잠금: E17·E18·E19 · E4 password · 관문 전수)
import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test'
import { ERROR_MESSAGES, ERROR_STATUS, type ErrorCode } from '@shared/errors'
import type {
  CreateRoomResponse,
  EnterRoomResponse,
  MessagesPage,
  RoomSummary,
  SetRoomPasswordResponse,
} from '@shared/types'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app'
import type { Env } from '../../src/env'
import { apiRoutes } from '../../src/routes'
import { insertLine, insertRoom, resetDb } from '../helpers'
import { signTestToken } from '../token'

const NOW = 1_700_000_000_000
const SECRET = 'test-secret-0123456789-abcdefghijklmnop'
const OWNER = 'owner01'
const BAD_FORM = '요청 형식이 올바르지 않습니다.'
const BAD_PASSWORD = '비밀번호는 4~32자로 입력해 주세요.'
const BAD_TITLE = '방 제목은 1~60자로 입력해 주세요.'
const NO_ROOM = '방을 찾을 수 없습니다.'
const TOO_MANY = '비밀번호를 너무 자주 입력했습니다. 잠시 후 다시 시도해 주세요.'

const baseEnv = (): Env =>
  ({
    DB: env.DB,
    ASSETS: { fetch: async () => new Response('<html></html>') } as unknown as Fetcher,
    TOKEN_SECRET: SECRET,
    OWNER_MB_IDS: OWNER,
  }) as unknown as Env

const appAt = (now: number) =>
  createApp({ routes: apiRoutes, logSink: () => undefined, now: () => now })

const tokenFor = (mbId = 'writer_a', over: Record<string, unknown> = {}, secret = SECRET) =>
  signTestToken(
    { mb_id: mbId, nick: 'n', ch_name: null, level: 5, exp: NOW / 1000 + 43200, ...over },
    secret,
  )

type Opts = {
  body?: unknown
  token?: string | null
  key?: string | null
  now?: number
  headers?: Record<string, string>
}

const call = async (method: string, path: string, opts: Opts = {}): Promise<Response> => {
  const headers: Record<string, string> = { ...opts.headers }
  if (opts.token !== null && opts.token !== undefined)
    headers.Authorization = `Bearer ${opts.token}`
  if (opts.key !== null && opts.key !== undefined) headers['X-Room-Key'] = opts.key
  const init: RequestInit = { method, headers }
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    init.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)
  }
  const ctx = createExecutionContext()
  const req = new Request(`http://test${path}`, init)
  const res = await appAt(opts.now ?? NOW).fetch(req, baseEnv(), ctx)
  await waitOnExecutionContext(ctx)
  return res
}

const expectError = async (res: Response, code: ErrorCode, message?: string): Promise<void> => {
  expect(res.status).toBe(ERROR_STATUS[code])
  const body = await res.json<{ error: { code: string; message: string } }>()
  expect(body.error.code).toBe(code)
  expect(body.error.message).toBe(message ?? ERROR_MESSAGES[code])
}

/** 비밀번호를 건 방을 E4 로 만든다. 방 id · 증명 · 메시지 id · 쓰기 토큰을 돌려준다 */
const makeLocked = async (password = '1234') => {
  const token = await tokenFor()
  const res = await call('POST', '/api/rooms', { token, body: { title: '다과회', password } })
  const created = await res.json<CreateRoomResponse>()
  const messageId = await insertLine(created.id, '안녕')
  return { id: created.id, key: created.entryKey ?? '', messageId, token }
}

const countRows = async (like: string): Promise<number> => {
  const row = await env.DB.prepare(
    'SELECT COALESCE(SUM(count), 0) AS n FROM rate_limits WHERE mb_id LIKE ?1',
  )
    .bind(like)
    .first<{ n: number }>()
  return row?.n ?? 0
}

const readPage = (id: string, key: string | null) =>
  call('GET', `/api/rooms/${id}/messages`, { key })

beforeEach(async () => {
  await resetDb()
})

describe('E3·E4 locked', () => {
  it('API-T-140 list_rows_have_locked_and_no_secrets', async () => {
    await insertRoom('plain', '평범', 1, 100)
    const locked = await makeLocked()
    const text = await (await call('GET', '/api/rooms')).text()
    expect(text).not.toContain('pbkdf2-sha256$')
    expect(text).not.toContain('e1.')
    const rooms = JSON.parse(text) as RoomSummary[]
    expect(rooms).toHaveLength(2)
    for (const room of rooms) {
      expect(Object.keys(room).sort()).toEqual([
        'createdAt',
        'id',
        'locked',
        'messageCount',
        'title',
        'updatedAt',
      ])
      expect(room.locked).toBe(room.id === locked.id)
    }
  })

  it('API-T-141 create_without_password_has_null_key', async () => {
    const res = await call('POST', '/api/rooms', { token: await tokenFor(), body: { title: '방' } })
    expect(res.status).toBe(201)
    const created = await res.json<CreateRoomResponse>()
    expect(created.locked).toBe(false)
    expect(created.entryKey).toBeNull()
  })

  it('API-T-142 create_with_password_returns_entry_key', async () => {
    for (const password of ['1234', '😀😀😀😀']) {
      const token = await tokenFor()
      const res = await call('POST', '/api/rooms', { token, body: { title: '잠금', password } })
      expect(res.status).toBe(201)
      const created = await res.json<CreateRoomResponse>()
      expect(created.locked).toBe(true)
      expect(created.entryKey).toMatch(/^e1\./)
      expect(created.entryKey).toHaveLength(46)
      expect((await readPage(created.id, created.entryKey)).status).toBe(200)
    }
  })

  it('API-T-143 create_validation_order_and_no_rows', async () => {
    const token = await tokenFor()
    const post = (body: unknown) => call('POST', '/api/rooms', { token, body })
    await expectError(
      await post({ title: 'x'.repeat(61), password: 'abc' }),
      'VALIDATION_ERROR',
      BAD_TITLE,
    )
    for (const password of ['', 'abc', 'x'.repeat(33)]) {
      await expectError(await post({ title: '방', password }), 'VALIDATION_ERROR', BAD_PASSWORD)
    }
    for (const password of [123, null]) {
      await expectError(await post({ title: '방', password }), 'VALIDATION_ERROR', BAD_FORM)
    }
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM rooms').first<{ n: number }>()
    expect(row?.n).toBe(0)
  })
})

describe('E17 enter', () => {
  const enter = (id: string, opts: Opts = {}) => call('POST', `/api/rooms/${id}/enter`, opts)

  it('API-T-144 enter_unknown_room_is_404', async () => {
    await expectError(await enter('nope', { body: {} }), 'NOT_FOUND', NO_ROOM)
  })

  it('API-T-145 enter_unlocked_room_returns_null_key', async () => {
    await insertRoom('plain', '평범', 1, 100)
    for (const body of [{}, { password: 'whatever' }]) {
      const res = await enter('plain', { body })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ entryKey: null })
    }
  })

  it('API-T-146 owner_passes_without_password_and_without_counting', async () => {
    const { id } = await makeLocked()
    const token = await tokenFor(OWNER)
    for (const body of [{}, { password: 'wrong-one' }]) {
      const res = await enter(id, { token, body })
      expect(res.status).toBe(200)
      const { entryKey } = await res.json<EnterRoomResponse>()
      expect(entryKey).toMatch(/^e1\./)
      expect((await readPage(id, entryKey)).status).toBe(200)
    }
    expect(await countRows('enter:%')).toBe(0)
  })

  it('API-T-147 anonymous_without_password_is_locked_and_not_counted', async () => {
    const { id } = await makeLocked()
    await expectError(await enter(id, { body: {} }), 'ROOM_LOCKED')
    expect(await countRows('enter:%')).toBe(0)
  })

  it('API-T-148 five_wrong_then_429_then_next_window_ok', async () => {
    const { id } = await makeLocked()
    for (let i = 0; i < 5; i += 1) {
      await expectError(await enter(id, { body: { password: 'nope1' } }), 'ROOM_PASSWORD_WRONG')
    }
    const limited = await enter(id, { body: { password: '1234' } })
    expect(limited.headers.get('Retry-After')).toBe('40')
    const json = await limited.clone().json<{ error: { retryAfterSec: number } }>()
    expect(json.error.retryAfterSec).toBe(40)
    await expectError(limited, 'RATE_LIMITED', TOO_MANY)
    expect((await enter(id, { body: { password: '1234' }, now: NOW + 60_000 })).status).toBe(200)
  })

  it('API-T-149 wrong_password_is_403_default_message', async () => {
    const { id } = await makeLocked()
    await expectError(await enter(id, { body: { password: 'wrong' } }), 'ROOM_PASSWORD_WRONG')
  })

  it('API-T-150 right_password_returns_working_key', async () => {
    const { id, key } = await makeLocked()
    const res = await enter(id, { body: { password: '1234' } })
    expect(res.status).toBe(200)
    const entered = await res.json<EnterRoomResponse>()
    expect(entered.entryKey).toBe(key)
    const page = await (await readPage(id, entered.entryKey)).json<MessagesPage>()
    expect(page.messages).toHaveLength(1)
  })

  it('API-T-151 bad_token_headers_are_treated_as_anonymous', async () => {
    const { id } = await makeLocked()
    const bad = [
      await tokenFor('writer_a', {}, 'wrong-secret-0123456789-abcdefghijklmn'),
      await tokenFor('writer_a', { exp: NOW / 1000 - 10 }),
      await tokenFor('writer_a', { level: 1 }),
    ]
    for (const token of bad) {
      await expectError(await enter(id, { token, body: {} }), 'ROOM_LOCKED')
      expect((await enter(id, { token, body: { password: '1234' } })).status).toBe(200)
    }
    const headers = { Authorization: 'Basic abc' }
    await expectError(await enter(id, { headers, body: {} }), 'ROOM_LOCKED')
    expect((await enter(id, { headers, body: { password: '1234' } })).status).toBe(200)
  })

  it('API-T-152 enter_body_validation_runs_before_lookup', async () => {
    const { id } = await makeLocked()
    const cases: [string, unknown][] = [
      [id, { password: 'x'.repeat(65) }],
      [id, { password: null }],
      [id, JSON.stringify({ password: 'a'.repeat(1030) })],
      ['nope', { password: 'x'.repeat(65) }],
    ]
    for (const [target, body] of cases) {
      await expectError(await enter(target, { body }), 'VALIDATION_ERROR', BAD_FORM)
    }
  })
})

describe('E18 · E19 password', () => {
  const put = (id: string, opts: Opts = {}) => call('PUT', `/api/rooms/${id}/password`, opts)
  const del = (id: string, opts: Opts = {}) => call('DELETE', `/api/rooms/${id}/password`, opts)

  it('API-T-153 set_password_on_unlocked_room', async () => {
    await insertRoom('plain', '평범', 1, 100)
    const res = await put('plain', { token: await tokenFor(), body: { password: 'abcd' } })
    expect(res.status).toBe(200)
    const done = await res.json<SetRoomPasswordResponse>()
    expect(done.room.locked).toBe(true)
    expect(done.room.updatedAt).toBe(100)
    expect((await readPage('plain', done.entryKey)).status).toBe(200)
  })

  it('API-T-154 change_and_reset_invalidate_old_key', async () => {
    const { id, key, token } = await makeLocked()
    const changed = await put(id, { token, key, body: { password: '5678' } })
    const first = await changed.json<SetRoomPasswordResponse>()
    await expectError(await readPage(id, key), 'ROOM_LOCKED')
    expect((await readPage(id, first.entryKey)).status).toBe(200)
    const same = await put(id, { token, key: first.entryKey, body: { password: '5678' } })
    const second = await same.json<SetRoomPasswordResponse>()
    await expectError(await readPage(id, first.entryKey), 'ROOM_LOCKED')
    expect((await readPage(id, second.entryKey)).status).toBe(200)
  })

  it('API-T-155 locked_room_change_needs_key_or_owner', async () => {
    const { id, key } = await makeLocked()
    const body = { password: 'newpw' }
    await expectError(await put(id, { token: await tokenFor(), body }), 'ROOM_LOCKED')
    expect((await put(id, { token: await tokenFor(), key, body })).status).toBe(200)
    expect((await put(id, { token: await tokenFor(OWNER), body })).status).toBe(200)
  })

  it('API-T-156 put_errors', async () => {
    const { id, token } = await makeLocked()
    const owner = await tokenFor(OWNER)
    const bad = (body: unknown) => put(id, { token: owner, body })
    await expectError(await bad({ password: 'abc' }), 'VALIDATION_ERROR', BAD_PASSWORD)
    await expectError(await bad({ password: 'x'.repeat(33) }), 'VALIDATION_ERROR', BAD_PASSWORD)
    await expectError(await bad({}), 'VALIDATION_ERROR', BAD_FORM)
    await expectError(
      await put('nope', { token, body: { password: 'abcd' } }),
      'NOT_FOUND',
      NO_ROOM,
    )
    await expectError(await put(id, { body: { password: 'abcd' } }), 'TOKEN_REQUIRED')
  })

  it('API-T-157 clear_is_idempotent_and_kills_keys', async () => {
    const { id, key, token } = await makeLocked()
    const first = await del(id, { token, key })
    expect(first.status).toBe(200)
    expect(await first.json<RoomSummary>()).toMatchObject({ id, locked: false })
    expect((await del(id, { token })).status).toBe(200)
    expect((await put(id, { token, body: { password: 'abcd' } })).status).toBe(200)
    await expectError(await readPage(id, key), 'ROOM_LOCKED')
  })

  it('API-T-158 clear_needs_gate_and_room', async () => {
    const { id, token } = await makeLocked()
    await expectError(await del(id, { token }), 'ROOM_LOCKED')
    await expectError(await del('nope', { token }), 'NOT_FOUND', NO_ROOM)
  })
})

type Ids = { id: string; messageId: number }
type Case = { name: string; method: string; path: (i: Ids) => string; body?: unknown; ok: number }

const GATED: Case[] = [
  {
    name: 'E5',
    method: 'PATCH',
    path: i => `/api/rooms/${i.id}`,
    body: { title: '이름' },
    ok: 200,
  },
  { name: 'E6', method: 'DELETE', path: i => `/api/rooms/${i.id}`, ok: 204 },
  {
    name: 'E8',
    method: 'POST',
    path: i => `/api/rooms/${i.id}/user`,
    body: { text: 'a', ooc: false },
    ok: 201,
  },
  {
    name: 'E10',
    method: 'PATCH',
    path: i => `/api/messages/${i.messageId}`,
    body: { text: '고침' },
    ok: 200,
  },
  { name: 'E11', method: 'DELETE', path: i => `/api/messages/${i.messageId}`, ok: 204 },
  { name: 'E13', method: 'GET', path: i => `/api/rooms/${i.id}/memory`, ok: 200 },
  {
    name: 'E14',
    method: 'PUT',
    path: i => `/api/rooms/${i.id}/memory`,
    body: { summary: '요약' },
    ok: 200,
  },
  // E9·E12 는 LLM 키가 없어 관문 통과 뒤 CONFIG_INVALID(500). 관문을 통과했는지(≠403)만 본다
  {
    name: 'E9',
    method: 'POST',
    path: i => `/api/rooms/${i.id}/speak`,
    body: { character: 'sebastian' },
    ok: 0,
  },
  { name: 'E12', method: 'POST', path: i => `/api/messages/${i.messageId}/regenerate`, ok: 0 },
]

describe('gate', () => {
  it.each(GATED)('API-T-159 $name blocks_without_key_passes_with_key_or_owner', async c => {
    const locked = await makeLocked()
    const send = (opts: Opts) => call(c.method, c.path(locked), { body: c.body, ...opts })
    await expectError(await send({ token: locked.token }), 'ROOM_LOCKED')
    const owner = await send({ token: await tokenFor(OWNER) })
    const withKey = await send({ token: locked.token, key: locked.key })
    if (c.ok === 0) {
      expect(withKey.status).not.toBe(403)
      expect(owner.status).not.toBe(403)
    } else {
      expect(owner.status).toBe(c.ok)
      // 삭제 계열은 owner 호출로 대상이 사라져 같은 방에 두 번째 성공을 기대하지 않는다
      if (c.ok !== 204) expect(withKey.status).toBe(c.ok)
    }
  })

  it('API-T-159b delete_routes_pass_with_key', async () => {
    for (const c of GATED.filter(g => g.ok === 204)) {
      await resetDb()
      const locked = await makeLocked()
      const res = await call(c.method, c.path(locked), { token: locked.token, key: locked.key })
      expect(res.status, c.name).toBe(204)
    }
  })

  it('API-T-160 read_ignores_token_for_owner', async () => {
    const { id, key } = await makeLocked()
    const owner = await tokenFor(OWNER)
    await expectError(
      await call('GET', `/api/rooms/${id}/messages`, { token: owner }),
      'ROOM_LOCKED',
    )
    expect((await readPage(id, key)).status).toBe(200)
    await expectError(await readPage(id, null), 'ROOM_LOCKED')
  })

  it('API-T-161 gate_order_over_validation_and_counts_member_limit', async () => {
    const { id, token } = await makeLocked()
    await expectError(await call('GET', `/api/rooms/${id}/messages?limit=0`), 'ROOM_LOCKED')
    await expectError(
      await call('POST', `/api/rooms/${id}/user`, { token, body: '{broken' }),
      'ROOM_LOCKED',
    )
    const anon = await call('POST', `/api/rooms/${id}/user`, { body: { text: 'a', ooc: false } })
    await expectError(anon, 'TOKEN_REQUIRED')
    const before = await countRows('writer_a')
    await call('POST', `/api/rooms/${id}/user`, { token, body: { text: 'a', ooc: false } })
    expect(await countRows('writer_a')).toBe(before + 1)
  })

  it('API-T-162 invalid_key_shapes_are_locked_not_400', async () => {
    const a = await makeLocked()
    const other = await call('POST', '/api/rooms', {
      token: a.token,
      body: { title: '다른', password: '1234' },
    })
    const otherKey = (await other.json<CreateRoomResponse>()).entryKey ?? ''
    const tampered = `${a.key.slice(0, -1)}${a.key.endsWith('A') ? 'B' : 'A'}`
    for (const key of [otherKey, 'e'.repeat(129), tampered, 'e1.']) {
      await expectError(await readPage(a.id, key), 'ROOM_LOCKED')
    }
    await expectError(await call('GET', `/api/rooms/${a.id}/messages?k=${a.key}`), 'ROOM_LOCKED')
  })

  it('API-T-163 unlocked_room_ignores_key_and_unknown_message_is_404', async () => {
    await insertRoom('plain', '평범', 1, 100)
    expect((await readPage('plain', 'garbage')).status).toBe(200)
    const token = await tokenFor()
    for (const id of ['999999', 'abc']) {
      const res = await call('PATCH', `/api/messages/${id}`, { token, body: { text: 'x' } })
      await expectError(res, 'NOT_FOUND', '메시지를 찾을 수 없습니다.')
    }
  })
})
