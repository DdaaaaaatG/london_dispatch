// API-T-050~066 — doc/200_설계/contract/api.md §14.5 · §14.9 (쓰기 8종: 토큰 · 레이트리밋 · 검증 · 정상)
import { createExecutionContext, env } from 'cloudflare:test'
import { USER_DISPLAY_NAME } from '@shared/characters'
import { ERROR_MESSAGES, ERROR_STATUS, type ErrorCode } from '@shared/errors'
import type { Message, MessagesPage, RoomSummary } from '@shared/types'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import type { Env } from '../src/env'
import { apiRoutes } from '../src/routes'
import { insertLine, insertLines, insertRoom, resetDb } from './helpers'
import { signTestToken } from './token'

const NOW = 1_700_000_000_000
const SECRET = 'test-secret'
const ROOM = 'room-1'
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const baseEnv = (overrides: Record<string, unknown> = {}): Env =>
  ({
    DB: env.DB,
    ASSETS: { fetch: async () => new Response('<html></html>') } as unknown as Fetcher,
    TOKEN_SECRET: SECRET,
    ...overrides,
  }) as unknown as Env

const app = createApp({ routes: apiRoutes, logSink: () => undefined, now: () => NOW })

const payload = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  mb_id: 'writer_a',
  nick: '테스터',
  ch_name: '시엘 팬텀하이브',
  level: 5,
  exp: NOW / 1000 + 43200,
  ...over,
})

const tokenFor = (over: Record<string, unknown> = {}, secret = SECRET): Promise<string> =>
  signTestToken(payload(over), secret)

type Call = { method: string; path: string; body?: unknown }

const send = (
  call: Call,
  token: string | null,
  e: Env = baseEnv(),
  extraHeaders: Record<string, string> = {},
  contentType: string | null = 'application/json',
): Promise<Response> => {
  const headers: Record<string, string> = { ...extraHeaders }
  if (token !== null) headers.Authorization = `Bearer ${token}`
  if (call.body !== undefined && contentType !== null) headers['Content-Type'] = contentType
  const init: RequestInit = { method: call.method, headers }
  if (call.body !== undefined) {
    init.body = typeof call.body === 'string' ? call.body : JSON.stringify(call.body)
  }
  return Promise.resolve(
    app.fetch(new Request(`http://test${call.path}`, init), e, createExecutionContext()),
  )
}

/** 유효 토큰(기본 payload, over 로 일부 변경)으로 호출 */
const ok = async (call: Call, over: Record<string, unknown> = {}, e?: Env): Promise<Response> =>
  send(call, await tokenFor(over), e)

const read = (path: string): Promise<Response> => send({ method: 'GET', path }, null)

/** 429 두 코드(RATE_LIMITED · LLM_BUDGET_EXCEEDED)만 retryAfterSec 를 갖는다. 나머지는 code · message 두 키 (api.md §3.1) */
const RETRY_AFTER: Partial<Record<ErrorCode, number>> = {
  RATE_LIMITED: 40,
  LLM_BUDGET_EXCEEDED: 1_356_400,
}
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
  expect(String(body.error?.message)).not.toBe('')
  return String(body.error?.message)
}

const BAD_TITLE = '방 제목은 1~60자로 입력해 주세요.'
const BAD_TEXT = '메시지는 1~2000자로 입력해 주세요.'
const BAD_FORM = '요청 형식이 올바르지 않습니다.'
const NO_ROOM = '방을 찾을 수 없습니다.'
const NO_MESSAGE = '메시지를 찾을 수 없습니다.'

/** 시드 방 ROOM 과 메시지 1건(마지막 캐릭터 메시지)을 기준으로 한 8개 쓰기 호출 (S2 6 + S3 speak·regenerate) */
const writes = (messageId: number): Call[] => [
  { method: 'POST', path: '/api/rooms', body: { title: '새 방' } },
  { method: 'PATCH', path: `/api/rooms/${ROOM}`, body: { title: '이름' } },
  { method: 'DELETE', path: `/api/rooms/${ROOM}` },
  { method: 'POST', path: `/api/rooms/${ROOM}/user`, body: { text: '안녕', ooc: false } },
  { method: 'PATCH', path: `/api/messages/${messageId}`, body: { text: '고침' } },
  { method: 'DELETE', path: `/api/messages/${messageId}` },
  { method: 'POST', path: `/api/rooms/${ROOM}/speak`, body: { character: 'sebastian' } },
  { method: 'POST', path: `/api/messages/${messageId}/regenerate` },
]

const countRows = async (table: 'rooms' | 'messages'): Promise<number> =>
  (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())?.n ?? -1

const roomUpdatedAt = async (id: string): Promise<number | undefined> =>
  (
    await env.DB.prepare('SELECT updated_at AS u FROM rooms WHERE id = ?1')
      .bind(id)
      .first<{ u: number }>()
  )?.u

let firstMessageId = 0

beforeEach(async () => {
  await resetDb()
  await insertRoom(ROOM, '방', 1, 100)
  firstMessageId = await insertLine(ROOM, '원문', 5)
})

describe('쓰기 인증 · 레이트리밋', () => {
  it('API-T-050 writes_require_token_on_all_endpoints', async () => {
    for (const call of writes(firstMessageId)) {
      await expectContractError(await send(call, null), 'TOKEN_REQUIRED')
    }
    expect(await countRows('rooms')).toBe(1)
    expect(await countRows('messages')).toBe(1)
  })

  it('API-T-051 writes_ignore_query_cookie_and_non_bearer_token', async () => {
    const token = await tokenFor()
    const body = { title: 'x' }
    const attempts: Array<[string, Record<string, string>]> = [
      [`/api/rooms?t=${token}`, {}],
      ['/api/rooms', { Cookie: `t=${token}` }],
      ['/api/rooms', { Authorization: `Basic ${token}` }],
      ['/api/rooms', { Authorization: 'Bearer ' }],
    ]
    for (const [path, headers] of attempts) {
      const res = await send({ method: 'POST', path, body }, null, baseEnv(), headers)
      await expectContractError(res, 'TOKEN_REQUIRED')
    }
  })

  it('API-T-052 writes_reject_forged_or_expired_token', async () => {
    const bad = [
      await tokenFor({}, 'wrong-secret'),
      await tokenFor({ exp: NOW / 1000 }),
      await tokenFor({ level: '5' }),
    ]
    for (const token of bad) {
      for (const call of writes(firstMessageId)) {
        const message = await expectContractError(await send(call, token), 'TOKEN_INVALID')
        expect(message).toBe(ERROR_MESSAGES.TOKEN_INVALID)
      }
    }
  })

  it('API-T-053 writes_reject_low_level_with_LEVEL_TOO_LOW', async () => {
    const low = await tokenFor({ level: 4 })
    for (const call of writes(firstMessageId)) {
      await expectContractError(await send(call, low), 'LEVEL_TOO_LOW')
    }
    const expiredLow = await tokenFor({ level: 4, exp: NOW / 1000 })
    await expectContractError(await send(writes(1)[0] as Call, expiredLow), 'TOKEN_INVALID')
  })

  it('API-T-054 writes_rate_limited_on_21st_request', async () => {
    const token = await tokenFor()
    const call: Call = { method: 'POST', path: '/api/rooms', body: { title: 'r' } }
    for (let i = 1; i <= 20; i += 1) expect((await send(call, token)).status, `#${i}`).toBe(201)
    await expectContractError(await send(call, token), 'RATE_LIMITED')
    expect(await countRows('rooms')).toBe(21)
    expect((await ok(call, { mb_id: 'writer_b' })).status).toBe(201)
  })

  it('API-T-055 auth_precedes_validation_and_failed_writes_are_counted', async () => {
    const e = baseEnv({ RATE_LIMIT_PER_MIN: '2' })
    const call: Call = { method: 'POST', path: '/api/rooms', body: {} }
    await expectContractError(await send(call, null, e), 'TOKEN_REQUIRED')
    const forged = await tokenFor({}, 'wrong-secret')
    for (let i = 0; i < 3; i += 1) {
      await expectContractError(await send(call, forged, e), 'TOKEN_INVALID')
    }
    const token = await tokenFor()
    for (let i = 0; i < 2; i += 1) {
      await expectContractError(await send(call, token, e), 'VALIDATION_ERROR')
    }
    const good: Call = { method: 'POST', path: '/api/rooms', body: { title: 'ok' } }
    await expectContractError(await send(good, token, e), 'RATE_LIMITED')
  })

  it('API-T-056 reads_stay_open_and_do_not_count', async () => {
    const e = baseEnv({ RATE_LIMIT_PER_MIN: '1' })
    const token = await tokenFor()
    const first = await send({ method: 'POST', path: '/api/rooms', body: { title: 'a' } }, token, e)
    expect(first.status).toBe(201)
    const forged = await tokenFor({}, 'wrong-secret')
    for (const t of [null, forged, token]) {
      for (const path of ['/api/rooms', `/api/rooms/${ROOM}/messages`]) {
        expect((await send({ method: 'GET', path }, t, e)).status).toBe(200)
      }
    }
    const row = await env.DB.prepare('SELECT count FROM rate_limits').first<{ count: number }>()
    expect(row?.count).toBe(1)
  })
})

describe('POST /api/rooms', () => {
  it('API-T-057 create_room_returns_201_summary', async () => {
    const res = await ok({
      method: 'POST',
      path: '/api/rooms',
      body: { title: '  안개 낀 런던  ', foo: 1 },
    })
    expect(res.status).toBe(201)
    const room = await res.json<RoomSummary>()
    expect(Object.keys(room).sort()).toEqual([
      'createdAt',
      'id',
      'messageCount',
      'title',
      'updatedAt',
    ])
    expect(room.title).toBe('안개 낀 런던')
    expect(room.id).toMatch(UUID_V4)
    expect(room.createdAt).toBe(NOW)
    expect(room.updatedAt).toBe(NOW)
    expect(room.messageCount).toBe(0)
    const list = await (await read('/api/rooms')).json<RoomSummary[]>()
    expect(list[0]).toEqual(room)
  })

  it('API-T-058 create_room_rejects_bad_title_or_body', async () => {
    const token = await tokenFor()
    const post = (body: unknown, contentType: string | null = 'application/json') =>
      send({ method: 'POST', path: '/api/rooms', body }, token, baseEnv(), {}, contentType)
    for (const title of ['', '   ', 'a'.repeat(61), '😀'.repeat(61)]) {
      const res = await post({ title })
      expect(await expectContractError(res, 'VALIDATION_ERROR')).toBe(BAD_TITLE)
    }
    for (const title of ['a'.repeat(60), '😀'.repeat(60)]) {
      expect((await post({ title })).status).toBe(201)
    }
    for (const body of [{}, { title: 1 }, '{broken']) {
      const res = await post(body)
      expect(await expectContractError(res, 'VALIDATION_ERROR')).toBe(BAD_FORM)
    }
    const noType = await post({ title: 'x' }, null)
    expect(await expectContractError(noType, 'VALIDATION_ERROR')).toBe(BAD_FORM)
  })
})

describe('PATCH · DELETE /api/rooms/:id', () => {
  it('API-T-059 rename_room_keeps_updatedAt_and_validates', async () => {
    await insertLine(ROOM, '둘째', 6)
    const patch = (id: string, title: string) =>
      ok({ method: 'PATCH', path: `/api/rooms/${id}`, body: { title } })
    const res = await patch(ROOM, '새 이름')
    expect(res.status).toBe(200)
    expect(await res.json<RoomSummary>()).toMatchObject({
      id: ROOM,
      title: '새 이름',
      updatedAt: 100,
      messageCount: 2,
    })
    const long = 'a'.repeat(61)
    expect(await expectContractError(await patch(ROOM, long), 'VALIDATION_ERROR')).toBe(BAD_TITLE)
    expect(await expectContractError(await patch('nope', '이름'), 'NOT_FOUND')).toBe(NO_ROOM)
    expect(await expectContractError(await patch('nope', long), 'VALIDATION_ERROR')).toBe(BAD_TITLE)
    expect(await roomUpdatedAt(ROOM)).toBe(100)
  })

  it('API-T-060 delete_room_returns_204_and_cascades', async () => {
    await insertLines(ROOM, 2)
    const del = () => ok({ method: 'DELETE', path: `/api/rooms/${ROOM}` })
    const res = await del()
    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
    await expectContractError(await read(`/api/rooms/${ROOM}/messages`), 'NOT_FOUND')
    expect(await (await read('/api/rooms')).json()).toEqual([])
    expect(await countRows('messages')).toBe(0)
    expect(await expectContractError(await del(), 'NOT_FOUND')).toBe(NO_ROOM)
  })
})

describe('POST /api/rooms/:id/user', () => {
  const userCall = (body: unknown, id = ROOM): Call => ({
    method: 'POST',
    path: `/api/rooms/${id}/user`,
    body,
  })

  it('API-T-061 append_user_returns_201_message', async () => {
    const res = await ok(userCall({ text: ' 안녕 ', ooc: false }))
    expect(res.status).toBe(201)
    const line = await res.json<Message>()
    expect(Object.keys(line).sort()).toEqual([
      'authorName',
      'createdAt',
      'id',
      'kind',
      'roomId',
      'speaker',
      'text',
    ])
    expect(line).toMatchObject({
      roomId: ROOM,
      speaker: 'user',
      kind: 'line',
      text: '안녕',
      authorName: USER_DISPLAY_NAME,
      createdAt: NOW,
    })
    const ooc = await (await ok(userCall({ text: '지시', ooc: true }))).json<Message>()
    expect(ooc.kind).toBe('ooc')
    const nick = await (
      await ok(userCall({ text: 'x', ooc: false }), { ch_name: '' })
    ).json<Message>()
    expect(nick.authorName).toBe(USER_DISPLAY_NAME)
    const nickRow = await env.DB.prepare('SELECT author_name AS n FROM messages WHERE id = ?1')
      .bind(nick.id)
      .first<{ n: string }>()
    expect(nickRow?.n).toBe('테스터')
    const rawNick = JSON.stringify(nick)
    const rawLine = JSON.stringify(line)
    expect(rawLine + rawNick).not.toContain('시엘 팬텀하이브')
    expect(rawLine + rawNick).not.toContain('테스터')
    expect(await roomUpdatedAt(ROOM)).toBe(NOW)
    const row = await env.DB.prepare('SELECT author_mb_id AS a FROM messages WHERE id = ?1')
      .bind(line.id)
      .first<{ a: string }>()
    expect(row?.a).toBe('writer_a')
  })

  it('API-T-062 append_user_rejects_bad_body_or_room', async () => {
    const before = await countRows('messages')
    for (const text of ['', '  \n ', 'a'.repeat(2001)]) {
      const res = await ok(userCall({ text, ooc: false }))
      expect(await expectContractError(res, 'VALIDATION_ERROR')).toBe(BAD_TEXT)
    }
    for (const body of [{ text: 'x' }, { text: 'x', ooc: 'true' }, { text: 1, ooc: false }]) {
      const res = await ok(userCall(body))
      expect(await expectContractError(res, 'VALIDATION_ERROR')).toBe(BAD_FORM)
    }
    const missing = await ok(userCall({ text: 'x', ooc: false }, 'nope'))
    expect(await expectContractError(missing, 'NOT_FOUND')).toBe(NO_ROOM)
    expect(await countRows('messages')).toBe(before)
  })
})

describe('PATCH · DELETE /api/messages/:id', () => {
  it('API-T-063 edit_message_returns_200_and_keeps_meta', async () => {
    const userMessage = await (
      await ok({
        method: 'POST',
        path: `/api/rooms/${ROOM}/user`,
        body: { text: '유저', ooc: true },
      })
    ).json<Message>()
    const page = await (await read(`/api/rooms/${ROOM}/messages`)).json<MessagesPage>()
    const character = page.messages.find(m => m.id === firstMessageId) as Message
    for (const target of [userMessage, character]) {
      await env.DB.prepare('UPDATE rooms SET updated_at = 100').run()
      const res = await ok({
        method: 'PATCH',
        path: `/api/messages/${target.id}`,
        body: { text: ' 고침 ' },
      })
      expect(res.status).toBe(200)
      expect(await res.json<Message>()).toEqual({ ...target, text: '고침' })
      expect(await roomUpdatedAt(ROOM)).toBe(NOW)
    }
  })

  it('API-T-064 message_id_and_text_errors', async () => {
    for (const id of ['abc', '0', '1.5', '0x10', '1e1', '999999999']) {
      const patch: Call = { method: 'PATCH', path: `/api/messages/${id}`, body: { text: 'x' } }
      const del: Call = { method: 'DELETE', path: `/api/messages/${id}` }
      for (const call of [patch, del]) {
        const message = await expectContractError(await ok(call), 'NOT_FOUND')
        expect(message, `${call.method} ${id}`).toBe(NO_MESSAGE)
      }
    }
    const tooLong: Call = {
      method: 'PATCH',
      path: `/api/messages/${firstMessageId}`,
      body: { text: 'a'.repeat(2001) },
    }
    expect(await expectContractError(await ok(tooLong), 'VALIDATION_ERROR')).toBe(BAD_TEXT)
    const emptyOnBadId: Call = { method: 'PATCH', path: '/api/messages/abc', body: { text: '' } }
    await expectContractError(await ok(emptyOnBadId), 'NOT_FOUND')
  })

  it('API-T-065 delete_message_returns_204', async () => {
    const ids = await insertLines(ROOM, 2)
    const middle = ids[0] as number
    const del = () => ok({ method: 'DELETE', path: `/api/messages/${middle}` })
    const res = await del()
    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
    const page = await (await read(`/api/rooms/${ROOM}/messages`)).json<MessagesPage>()
    expect(page.messages).toHaveLength(2)
    expect(await roomUpdatedAt(ROOM)).toBe(NOW)
    expect(await expectContractError(await del(), 'NOT_FOUND')).toBe(NO_MESSAGE)
  })

  it('API-T-108 user_author_name_is_projected_everywhere', async () => {
    const seed = async (kind: 'line' | 'ooc'): Promise<number> => {
      const row = await env.DB.prepare(
        "INSERT INTO messages (room_id, speaker, kind, text, author_mb_id, author_name, created_at) VALUES (?1, 'user', ?2, ?3, 'seed_a', '시드 유저', 9) RETURNING id",
      )
        .bind(ROOM, kind, `시드 ${kind}`)
        .first<{ id: number }>()
      return (row as { id: number }).id
    }
    const lineId = await seed('line')
    const oocId = await seed('ooc')
    const listRes = await read(`/api/rooms/${ROOM}/messages`)
    const raw = await listRes.clone().text()
    expect(raw).not.toContain('시드 유저')
    const page = await listRes.json<MessagesPage>()
    for (const m of page.messages) {
      expect(m.authorName).toBe(m.speaker === 'user' ? USER_DISPLAY_NAME : null)
    }
    expect(page.messages.filter(m => m.speaker === 'user')).toHaveLength(2)
    expect(page.messages.some(m => m.speaker !== 'user')).toBe(true)
    const patch = await ok({ method: 'PATCH', path: `/api/messages/${oocId}`, body: { text: '수정' } })
    expect(patch.status).toBe(200)
    expect(await patch.clone().text()).not.toContain('시드 유저')
    expect((await patch.json<Message>()).authorName).toBe(USER_DISPLAY_NAME)
    const rows = await env.DB.prepare('SELECT author_name AS n FROM messages WHERE id IN (?1, ?2)')
      .bind(lineId, oocId)
      .all<{ n: string }>()
    expect(rows.results.map(r => r.n)).toEqual(['시드 유저', '시드 유저'])
  })
})

describe('다른 mb_id', () => {
  it('API-T-066 other_mb_id_can_modify_rooms_and_messages', async () => {
    const room = await (
      await ok({ method: 'POST', path: '/api/rooms', body: { title: 'A의 방' } })
    ).json<RoomSummary>()
    const msg = await (
      await ok({
        method: 'POST',
        path: `/api/rooms/${room.id}/user`,
        body: { text: 'A의 말', ooc: false },
      })
    ).json<Message>()
    const b = { mb_id: 'writer_b', nick: '비' }
    const steps: Array<[Call, number]> = [
      [{ method: 'PATCH', path: `/api/rooms/${room.id}`, body: { title: 'B가 바꿈' } }, 200],
      [{ method: 'PATCH', path: `/api/messages/${msg.id}`, body: { text: 'B가 고침' } }, 200],
      [{ method: 'DELETE', path: `/api/messages/${msg.id}` }, 204],
      [{ method: 'DELETE', path: `/api/rooms/${room.id}` }, 204],
    ]
    for (const [call, status] of steps) expect((await ok(call, b)).status).toBe(status)
  })
})
