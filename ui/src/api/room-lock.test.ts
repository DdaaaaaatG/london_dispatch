// API-T-UI-035~040 — doc/200_설계/contract/api.md §14.22 (방 입장 증명 헤더 · E17~E19 래퍼)
import { ERROR_MESSAGES } from '@shared/errors'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  appendUser,
  clearRoomPassword,
  configureClient,
  createRoom,
  deleteMessage,
  deleteRoom,
  editMessage,
  enterRoom,
  getMemory,
  isAuthFailure,
  listMessages,
  listRooms,
  putMemory,
  regenerate,
  renameRoom,
  setRoomPassword,
  speak,
} from './index'

const KEY = 'e1.opaque-entry-key-for-test-only'
const SUMMARY = { id: 'r1', title: 't', createdAt: 1, updatedAt: 1, messageCount: 0, locked: false }

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const stubFetch = (impl: (...args: unknown[]) => unknown) => {
  const fn = vi.fn(impl)
  vi.stubGlobal('fetch', fn)
  return fn
}

const firstCall = (fn: ReturnType<typeof stubFetch>) => {
  const [url, init] = fn.mock.calls[0] as [string, RequestInit]
  return { url, init, headers: new Headers(init.headers) }
}

const withRoomKey = (map: Record<string, string | null> = { r1: KEY }) => {
  const getRoomKey = vi.fn((roomId: string) => map[roomId] ?? null)
  configureClient({ getToken: () => 'tok', getRoomKey })
  return getRoomKey
}

beforeEach(() => configureClient({ getToken: () => null }))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('X-Room-Key 헤더', () => {
  it('API-T-UI-035 header_only_when_roomId_and_getter_value_non_empty', async () => {
    const fn = stubFetch(async () => json([]))
    withRoomKey({ r1: KEY, r2: null, r3: '' })
    await listMessages('r1')
    expect(firstCall(fn).headers.get('X-Room-Key')).toBe(KEY)
    for (const room of ['r2', 'r3']) {
      fn.mockClear()
      await listMessages(room)
      expect(firstCall(fn).headers.has('X-Room-Key')).toBe(false)
    }
    configureClient({ getToken: () => 'tok' })
    fn.mockClear()
    await listMessages('r1')
    expect(firstCall(fn).headers.has('X-Room-Key')).toBe(false)

    const getter = withRoomKey()
    for (const run of [
      () => listRooms(),
      () => createRoom({ title: 't' }),
      () => enterRoom('r1'),
    ]) {
      fn.mockClear()
      await run()
      expect(firstCall(fn).headers.has('X-Room-Key')).toBe(false)
    }
    expect(getter).not.toHaveBeenCalled()
  })

  it('API-T-UI-036 room_wrappers_attach_header_and_message_wrappers_use_roomId_arg', async () => {
    const fn = stubFetch(async () => json({}))
    const getter = withRoomKey()
    const calls: [string, () => Promise<unknown>][] = [
      ['/api/rooms/r1/messages', () => listMessages('r1')],
      ['/api/rooms/r1/user', () => appendUser('r1', { text: 'x', ooc: false })],
      ['/api/rooms/r1/speak', () => speak('r1', { character: 'sebastian' })],
      ['/api/rooms/r1', () => renameRoom('r1', { title: 'n' })],
      ['/api/rooms/r1', () => deleteRoom('r1')],
      ['/api/rooms/r1/memory', () => getMemory('r1')],
      ['/api/rooms/r1/memory', () => putMemory('r1', { summary: 's' })],
      ['/api/messages/41', () => editMessage(41, { text: 'y' }, 'r1')],
      ['/api/messages/41', () => deleteMessage(41, 'r1')],
      ['/api/messages/72/regenerate', () => regenerate(72, 'r1')],
    ]
    for (const [url, run] of calls) {
      fn.mockClear()
      await run()
      const sent = firstCall(fn)
      expect(sent.url).toBe(url)
      expect(sent.headers.get('X-Room-Key')).toBe(KEY)
    }
    expect(getter.mock.calls.every(([id]) => id === 'r1')).toBe(true)
    fn.mockClear()
    await listMessages('r1')
    expect(firstCall(fn).headers.has('Authorization')).toBe(false)
  })
})

describe('E17 · E18 · E19 래퍼', () => {
  it('API-T-UI-037 enterRoom_posts_empty_or_password_with_optional_bearer', async () => {
    withRoomKey()
    const fn = stubFetch(async () => json({ entryKey: KEY }))
    const res = await enterRoom('r1')
    const first = firstCall(fn)
    expect([first.url, first.init.method, first.init.body]).toEqual([
      '/api/rooms/r1/enter',
      'POST',
      '{}',
    ])
    expect(first.headers.get('Authorization')).toBe('Bearer tok')
    expect(first.headers.has('X-Room-Key')).toBe(false)
    expect(res).toEqual({ ok: true, value: { entryKey: KEY } })
    fn.mockClear()
    configureClient({ getToken: () => null })
    await enterRoom('r1', 'pw')
    const second = firstCall(fn)
    expect(second.init.body).toBe('{"password":"pw"}')
    expect(second.headers.has('Authorization')).toBe(false)
  })

  it('API-T-UI-038 set_and_clear_password_wrappers', async () => {
    withRoomKey()
    const fn = stubFetch(async () => json({ room: { ...SUMMARY, locked: true }, entryKey: KEY }))
    expect((await setRoomPassword('r1', 'abcd')).ok).toBe(true)
    const put = firstCall(fn)
    expect([put.url, put.init.method, put.init.body]).toEqual([
      '/api/rooms/r1/password',
      'PUT',
      '{"password":"abcd"}',
    ])
    expect(put.headers.get('Authorization')).toBe('Bearer tok')
    expect(put.headers.get('X-Room-Key')).toBe(KEY)
    fn.mockClear()
    fn.mockImplementation(async () => json(SUMMARY))
    expect(await clearRoomPassword('r1')).toEqual({ ok: true, value: SUMMARY })
    const del = firstCall(fn)
    expect([del.url, del.init.method]).toEqual(['/api/rooms/r1/password', 'DELETE'])
    expect(del.headers.get('X-Room-Key')).toBe(KEY)
  })

  it('createRoom sends password only when given', async () => {
    const fn = stubFetch(async () => json({ ...SUMMARY, entryKey: null }, 201))
    await createRoom({ title: 't' })
    expect(firstCall(fn).init.body).toBe('{"title":"t"}')
    fn.mockClear()
    await createRoom({ title: 't', password: 'abcd' })
    expect(firstCall(fn).init.body).toBe('{"title":"t","password":"abcd"}')
  })
})

describe('에러·비밀 취급', () => {
  it('API-T-UI-039 lock_errors_pass_through_and_are_not_auth_failures', async () => {
    withRoomKey()
    for (const code of ['ROOM_LOCKED', 'ROOM_PASSWORD_WRONG'] as const) {
      const error = { code, message: ERROR_MESSAGES[code] }
      stubFetch(async () => json({ error }, 403))
      const res = await enterRoom('r1', 'x')
      expect(res).toEqual({ ok: false, error })
      if (!res.ok) expect(isAuthFailure(res.error)).toBe(false)
    }
    const limit = { code: 'RATE_LIMITED', message: 'm', retryAfterSec: 40 }
    stubFetch(async () => json({ error: limit }, 429))
    const limited = await enterRoom('r1', 'x')
    expect(!limited.ok && limited.error.retryAfterSec).toBe(40)
  })

  it('API-T-UI-040 key_never_in_url_query_body_or_console', async () => {
    withRoomKey()
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(m =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    )
    const fn = stubFetch(async () => json({}))
    await listMessages('r1', { limit: 10 })
    await appendUser('r1', { text: 'x', ooc: false })
    await setRoomPassword('r1', 'abcd')
    await createRoom({ title: 't' })
    for (const [url, init] of fn.mock.calls as [string, RequestInit][]) {
      expect(url).not.toContain('e1.')
      expect(String(init.body ?? '')).not.toContain('e1.')
    }
    for (const spy of spies) expect(spy).not.toHaveBeenCalled()
  })
})
