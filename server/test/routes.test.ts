// API-T-001~034 — doc/200_설계/contract/api.md §14.1
import { createExecutionContext, env } from 'cloudflare:test'
import { ERROR_STATUS, type ErrorCode } from '@shared/errors'
import type { MessagesPage, RoomSummary } from '@shared/types'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import type { Env } from '../src/env'
import { apiRoutes } from '../src/routes'
import { insertLine, insertLines, insertRoom, resetDb } from './helpers'

const ANCESTORS = 'http://london-gossip.my https://london-gossip.my'
const NOW = 1_700_000_000_000
const ROOM = 'room-1'

const fakeAssets = () => {
  const requested: string[] = []
  const fetcher = {
    fetch: async (input: string | Request | URL) => {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
      requested.push(url.pathname + url.search)
      return new Response('<html></html>')
    },
  }
  return { requested, fetcher: fetcher as unknown as Fetcher }
}

const baseEnv = (overrides: Record<string, unknown> = {}): Env =>
  ({
    DB: env.DB,
    ASSETS: fakeAssets().fetcher,
    TOKEN_SECRET: 'test-secret',
    ...overrides,
  }) as unknown as Env

const app = createApp({ routes: apiRoutes, logSink: () => undefined, now: () => NOW })

const get = (path: string, init?: RequestInit, e: Env = baseEnv()): Promise<Response> =>
  Promise.resolve(app.fetch(new Request(`http://test${path}`, init), e, createExecutionContext()))

/** R-API-002: 에러 본문은 { error: { code, message } } 한 가지뿐 */
const expectContractError = async (res: Response, code: ErrorCode): Promise<string> => {
  expect(res.status).toBe(ERROR_STATUS[code])
  const body = await res.json<Record<string, Record<string, unknown>>>()
  expect(Object.keys(body)).toEqual(['error'])
  expect(Object.keys(body.error ?? {}).sort()).toEqual(['code', 'message'])
  expect(body.error?.code).toBe(code)
  expect(String(body.error?.message)).not.toBe('')
  return String(body.error?.message)
}

const throwingDb = (message: string) =>
  ({
    prepare: () => {
      throw new Error(message)
    },
    batch: () => {
      throw new Error(message)
    },
  }) as unknown

const messagesPath = (id: string, query = ''): string => `/api/rooms/${id}/messages${query}`

beforeEach(resetDb)

describe('health · 공통', () => {
  it('API-T-001 health_returns_ok_and_version', async () => {
    const res = await get('/api/health')
    expect(res.status).toBe(200)
    const body = await res.json<Record<string, unknown>>()
    expect(Object.keys(body).sort()).toEqual(['ok', 'version'])
    expect(body.ok).toBe(true)
    expect(typeof body.version === 'string' && body.version !== '').toBe(true)
  })

  it('API-T-002 health_ok_even_if_db_unusable', async () => {
    const res = await get('/api/health', undefined, baseEnv({ DB: throwingDb('SENTINEL_DB') }))
    expect(res.status).toBe(200)
  })

  it('API-T-003 health_returns_CONFIG_INVALID_when_secret_missing', async () => {
    const res = await get('/api/health', undefined, baseEnv({ TOKEN_SECRET: undefined }))
    const text = await res.clone().text()
    await expectContractError(res, 'CONFIG_INVALID')
    expect(text).not.toContain('TOKEN_SECRET')
  })

  it('API-T-004 api_responses_carry_csp_without_x_frame_options', async () => {
    const res = await get('/api/rooms')
    expect(res.headers.get('Content-Security-Policy')).toBe(`frame-ancestors ${ANCESTORS}`)
    expect(res.headers.get('X-Frame-Options')).toBeNull()
  })

  it('API-T-005 embed_is_not_shadowed_by_api_routes', async () => {
    const assets = fakeAssets()
    const res = await get('/embed?t=x', undefined, baseEnv({ ASSETS: assets.fetcher }))
    expect(res.status).toBe(200)
    expect(assets.requested).toEqual(['/'])
  })
})

describe('GET /api/rooms', () => {
  it('API-T-010 rooms_returns_empty_array', async () => {
    const res = await get('/api/rooms')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  const seedThree = async () => {
    await insertRoom('a', 'A방', 1, 100)
    await insertRoom('b', 'B방', 2, 300)
    await insertRoom('c', 'C방', 3, 200)
    await insertLines('c', 2)
    await insertLines('a', 5)
  }

  it('API-T-011 rooms_sorted_desc_with_contract_fields', async () => {
    await seedThree()
    const rooms = await (await get('/api/rooms')).json<RoomSummary[]>()
    expect(rooms.map(r => r.id)).toEqual(['b', 'c', 'a'])
    expect(rooms.map(r => r.messageCount)).toEqual([0, 2, 5])
    for (const room of rooms) {
      expect(Object.keys(room).sort()).toEqual([
        'createdAt',
        'id',
        'messageCount',
        'title',
        'updatedAt',
      ])
      expect(typeof room.createdAt).toBe('number')
      expect(typeof room.updatedAt).toBe('number')
      expect(typeof room.messageCount).toBe('number')
    }
  })

  it('API-T-012 rooms_ignores_authorization_header', async () => {
    await seedThree()
    const plain = await (await get('/api/rooms')).json()
    const res = await get('/api/rooms', { headers: { Authorization: 'Bearer garbage' } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(plain)
  })

  it('API-T-013 single_room_get_does_not_exist', async () => {
    await insertRoom('a', 'A방', 1, 100)
    await expectContractError(await get('/api/rooms/a'), 'NOT_FOUND')
  })

  it('API-T-014 rooms_hides_db_failure_as_INTERNAL', async () => {
    const res = await get('/api/rooms', undefined, baseEnv({ DB: throwingDb('SENTINEL_DB') }))
    const text = await res.clone().text()
    await expectContractError(res, 'INTERNAL')
    expect(text).not.toContain('SENTINEL_DB')
    expect(text).not.toContain('stack')
  })
})

describe('GET /api/rooms/:id/messages — 정상', () => {
  beforeEach(async () => {
    await insertRoom(ROOM, '방', 1, 1)
  })

  it('API-T-020 messages_first_page_defaults_to_30_ascending', async () => {
    const ids = await insertLines(ROOM, 70)
    const res = await get(messagesPath(ROOM))
    expect(res.status).toBe(200)
    const page = await res.json<MessagesPage>()
    expect(page.messages.map(m => m.id)).toEqual(ids.slice(40))
    expect(page.hasMore).toBe(true)
  })

  it('API-T-021 messages_three_pages_via_before_cursor', async () => {
    const ids = await insertLines(ROOM, 70)
    const first = await (await get(messagesPath(ROOM))).json<MessagesPage>()
    const second = await (
      await get(messagesPath(ROOM, `?before=${first.messages[0]?.id}`))
    ).json<MessagesPage>()
    const third = await (
      await get(messagesPath(ROOM, `?before=${second.messages[0]?.id}`))
    ).json<MessagesPage>()
    expect([first, second, third].map(p => p.messages.length)).toEqual([30, 30, 10])
    expect([first, second, third].map(p => p.hasMore)).toEqual([true, true, false])
    const all = [...third.messages, ...second.messages, ...first.messages].map(m => m.id)
    expect(all).toEqual(ids)
  })

  it('API-T-022 messages_accepts_limit_bounds_and_empty_values', async () => {
    await insertLines(ROOM, 70)
    const one = await (await get(messagesPath(ROOM, '?limit=1'))).json<MessagesPage>()
    const max = await (await get(messagesPath(ROOM, '?limit=100'))).json<MessagesPage>()
    const plain = await (await get(messagesPath(ROOM))).json()
    const empty = await get(messagesPath(ROOM, '?before=&limit='))
    expect(one.messages).toHaveLength(1)
    expect(max.messages).toHaveLength(70)
    expect(empty.status).toBe(200)
    expect(await empty.json()).toEqual(plain)
  })

  it('API-T-023 messages_item_shape_has_no_authorMbId', async () => {
    await insertLine(ROOM, '캐릭터', 1)
    const insertUser = (kind: string, text: string, at: number) =>
      env.DB.prepare(
        "INSERT INTO messages (room_id, speaker, kind, text, author_mb_id, author_name, created_at) VALUES (?1, 'user', ?2, ?3, 'secret_id', '닉', ?4)",
      )
        .bind(ROOM, kind, text, at)
        .run()
    await insertUser('line', '발화', 2)
    await insertUser('ooc', '지시', 3)
    const res = await get(messagesPath(ROOM))
    expect(await res.clone().text()).not.toContain('secret_id')
    const { messages } = await res.json<MessagesPage>()
    expect(messages).toHaveLength(3)
    for (const m of messages) {
      expect(Object.keys(m).sort()).toEqual([
        'authorName',
        'createdAt',
        'id',
        'kind',
        'roomId',
        'speaker',
        'text',
      ])
      expect(typeof m.id).toBe('number')
      expect(typeof m.createdAt).toBe('number')
    }
    expect(messages[0]?.authorName).toBeNull()
    expect(messages[2]?.kind).toBe('ooc')
  })

  it('API-T-024 messages_ignores_authorization_header', async () => {
    await insertLines(ROOM, 3)
    const res = await get(messagesPath(ROOM), { headers: { Authorization: 'Bearer garbage' } })
    expect(res.status).toBe(200)
  })
})

describe('GET /api/rooms/:id/messages — 에러', () => {
  beforeEach(async () => {
    await insertRoom(ROOM, '방', 1, 1)
    await insertLines(ROOM, 3)
  })

  it('API-T-030 messages_rejects_invalid_limit', async () => {
    for (const limit of ['0', '101', '1.5', 'abc']) {
      const message = await expectContractError(
        await get(messagesPath(ROOM, `?limit=${limit}`)),
        'VALIDATION_ERROR',
      )
      expect(message, limit).toBe('불러올 개수(limit)는 1~100 사이의 정수여야 합니다.')
    }
  })

  it('API-T-031 messages_rejects_invalid_before', async () => {
    for (const before of ['0', '-1', 'abc', '9007199254740992']) {
      const message = await expectContractError(
        await get(messagesPath(ROOM, `?before=${before}`)),
        'VALIDATION_ERROR',
      )
      expect(message, before).toBe('기준 메시지 번호(before)가 올바르지 않습니다.')
    }
  })

  it('API-T-032 messages_rejects_repeated_query_key', async () => {
    const message = await expectContractError(
      await get(messagesPath(ROOM, '?limit=1&limit=2')),
      'VALIDATION_ERROR',
    )
    expect(message).toBe('요청 형식이 올바르지 않습니다.')
  })

  it('API-T-033 messages_unknown_room_returns_NOT_FOUND', async () => {
    for (const query of ['', '?before=5']) {
      const message = await expectContractError(await get(messagesPath('nope', query)), 'NOT_FOUND')
      expect(message).toBe('방을 찾을 수 없습니다.')
    }
  })

  it('API-T-034 messages_validates_before_room_lookup', async () => {
    await expectContractError(await get(messagesPath('nope', '?limit=0')), 'VALIDATION_ERROR')
  })
})
