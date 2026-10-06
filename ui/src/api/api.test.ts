// API-T-UI-001~021 — doc/200_설계/contract/api.md §14.3 (fetch 모킹은 이 폴더 테스트에서만)
import { ERROR_MESSAGES } from '@shared/errors'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CreateRoomBody, SpeakBody } from '@shared/types'
import { request, type ApiError } from './client'
import {
  appendUser,
  configureClient,
  createRoom,
  deleteMessage,
  deleteRoom,
  editMessage,
  getHealth,
  isAuthFailure,
  listMessages,
  listRooms,
  regenerate,
  renameRoom,
  speak,
} from './index'

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

beforeEach(() => configureClient({ getToken: () => null }))
afterEach(() => vi.unstubAllGlobals())

describe('request', () => {
  it('API-T-UI-001 request_returns_ok_value_on_2xx_json', async () => {
    stubFetch(async () => json({ a: 1 }))
    expect(await request('/x')).toEqual({ ok: true, value: { a: 1 } })
  })

  it('API-T-UI-002 request_passes_contract_error_body_through', async () => {
    const error = { code: 'NOT_FOUND', message: '방을 찾을 수 없습니다.' }
    stubFetch(async () => json({ error }, 404))
    expect(await request('/x')).toEqual({ ok: false, error })
  })

  it('API-T-UI-003 request_maps_fetch_failure_to_NETWORK', async () => {
    const expected = {
      ok: false,
      error: { code: 'NETWORK', message: '서버에 연결할 수 없습니다.' },
    }
    stubFetch(async () => {
      throw new TypeError('offline')
    })
    expect(await request('/x')).toEqual(expected)
    stubFetch(() => {
      throw new TypeError('sync')
    })
    expect(await request('/x')).toEqual(expected)
  })

  it('API-T-UI-004 request_maps_non_contract_error_body_to_INTERNAL', async () => {
    stubFetch(async () => new Response('<html>Bad Gateway</html>', { status: 502 }))
    expect(await request('/x')).toEqual({
      ok: false,
      error: { code: 'INTERNAL', message: ERROR_MESSAGES.INTERNAL },
    })
  })

  it('API-T-UI-005 request_handles_unknown_code_and_missing_message', async () => {
    stubFetch(async () => json({ error: { code: 'WHATEVER', message: 'x' } }, 400))
    expect(await request('/x')).toMatchObject({ ok: false, error: { code: 'INTERNAL' } })
    stubFetch(async () => json({ error: { code: 'RATE_LIMITED' } }, 429))
    expect(await request('/x')).toEqual({
      ok: false,
      error: { code: 'RATE_LIMITED', message: ERROR_MESSAGES.RATE_LIMITED },
    })
  })

  it('API-T-UI-006 request_maps_non_json_success_to_INTERNAL', async () => {
    stubFetch(async () => new Response('not json', { status: 200 }))
    expect(await request('/x')).toMatchObject({ ok: false, error: { code: 'INTERNAL' } })
  })
})

describe('wrappers', () => {
  it('API-T-UI-007 listRooms_calls_GET_api_rooms_without_auth', async () => {
    const fn = stubFetch(async () => json([]))
    expect(await listRooms()).toEqual({ ok: true, value: [] })
    const { url, init, headers } = firstCall(fn)
    expect(url).toBe('/api/rooms')
    expect(init.method).toBe('GET')
    expect(headers.has('Authorization')).toBe(false)
  })

  it('API-T-UI-008 listMessages_builds_path_and_query', async () => {
    const urls: string[] = []
    stubFetch(async url => {
      urls.push(url as string)
      return json({ messages: [], hasMore: false })
    })
    await listMessages('r1')
    await listMessages('r1', { before: 41 })
    await listMessages('a b', { limit: 10 })
    expect(urls).toEqual([
      '/api/rooms/r1/messages',
      '/api/rooms/r1/messages?before=41',
      '/api/rooms/a%20b/messages?limit=10',
    ])
  })

  it('API-T-UI-009 getHealth_calls_GET_api_health', async () => {
    const fn = stubFetch(async () => json({ ok: true, version: '0.1.0' }))
    expect(await getHealth()).toEqual({ ok: true, value: { ok: true, version: '0.1.0' } })
    expect(firstCall(fn).url).toBe('/api/health')
  })

  it('API-T-UI-010 wrappers_never_reject', async () => {
    const broken: Array<() => unknown> = [
      () => {
        throw new Error('sync')
      },
      async () => {
        throw new Error('reject')
      },
      async () => ({ ok: true, status: 200, json: async () => Promise.reject(new Error('json')) }),
      async () => json({ error: { code: 'INTERNAL', message: 'x' } }, 500),
    ]
    for (const impl of broken) {
      stubFetch(impl)
      for (const call of [getHealth, listRooms, () => listMessages('r1')]) {
        const result = await call()
        expect(result.ok).toBe(false)
      }
    }
  })
})

const noContent = (): Response => new Response(null, { status: 204 })

describe('S2 쓰기 래퍼', () => {
  it('API-T-UI-011 write_wrappers_send_method_url_body_and_bearer', async () => {
    configureClient({ getToken: () => 'tok' })
    const calls: Array<[string, () => Promise<unknown>, string, string | undefined]> = [
      ['/api/rooms', () => createRoom({ title: 't' }), 'POST', '{"title":"t"}'],
      ['/api/rooms/a%20b', () => renameRoom('a b', { title: 'n' }), 'PATCH', '{"title":"n"}'],
      ['/api/rooms/r1', () => deleteRoom('r1'), 'DELETE', undefined],
      [
        '/api/rooms/r1/user',
        () => appendUser('r1', { text: 'x', ooc: true }),
        'POST',
        '{"text":"x","ooc":true}',
      ],
      ['/api/messages/41', () => editMessage(41, { text: 'y' }), 'PATCH', '{"text":"y"}'],
      ['/api/messages/41', () => deleteMessage(41), 'DELETE', undefined],
    ]
    for (const [path, call, method, body] of calls) {
      const fn = stubFetch(async () => (method === 'DELETE' ? noContent() : json({}, 200)))
      await call()
      const { url, init, headers } = firstCall(fn)
      expect(url).toBe(path)
      expect(init.method).toBe(method)
      expect(headers.get('Authorization')).toBe('Bearer tok')
      expect(init.body).toBe(body)
      expect(headers.get('Content-Type')).toBe(body === undefined ? null : 'application/json')
    }
  })

  it('API-T-UI-012 read_wrappers_never_send_authorization', async () => {
    configureClient({ getToken: () => 'tok' })
    for (const call of [getHealth, listRooms, () => listMessages('r1')]) {
      const fn = stubFetch(async () => json([]))
      await call()
      const { init, headers } = firstCall(fn)
      expect(init.method).toBe('GET')
      expect(headers.has('Authorization')).toBe(false)
      expect(headers.has('Content-Type')).toBe(false)
    }
  })

  it('API-T-UI-013 write_without_token_sends_no_authorization', async () => {
    const error = { code: 'TOKEN_REQUIRED', message: '토큰이 필요합니다.' }
    for (const token of [null, '']) {
      configureClient({ getToken: () => token })
      const fn = stubFetch(async () => json({ error }, 401))
      expect(await createRoom({ title: 't' })).toEqual({ ok: false, error })
      expect(firstCall(fn).headers.has('Authorization')).toBe(false)
    }
  })

  it('API-T-UI-014 rate_limited_carries_retryAfterSec', async () => {
    const limited = (retryAfterSec?: unknown, code = 'RATE_LIMITED') =>
      json(
        { error: { code, message: 'm', ...(retryAfterSec !== undefined && { retryAfterSec }) } },
        429,
      )
    const errorOf = async (res: Response): Promise<ApiError> => {
      stubFetch(async () => res)
      const result = await createRoom({ title: 't' })
      if (result.ok) throw new Error('expected failure')
      return result.error
    }
    expect((await errorOf(limited(40))).retryAfterSec).toBe(40)
    for (const bad of [0, '40', 1.5, undefined]) {
      expect('retryAfterSec' in (await errorOf(limited(bad)))).toBe(false)
    }
    expect('retryAfterSec' in (await errorOf(limited(40, 'NOT_FOUND')))).toBe(false)
  })

  it('API-T-UI-015 delete_wrappers_map_204_to_ok_undefined', async () => {
    const res = noContent()
    const jsonSpy = vi.spyOn(res, 'json')
    stubFetch(async () => res)
    expect(await deleteRoom('r1')).toEqual({ ok: true, value: undefined })
    expect(jsonSpy).not.toHaveBeenCalled()
    stubFetch(async () => noContent())
    expect(await deleteMessage(41)).toEqual({ ok: true, value: undefined })
    stubFetch(async () => new Response('', { status: 201 }))
    expect(await createRoom({ title: 't' })).toMatchObject({
      ok: false,
      error: { code: 'INTERNAL' },
    })
  })

  it('API-T-UI-016 isAuthFailure_matches_three_auth_codes', () => {
    const codes = ['TOKEN_REQUIRED', 'TOKEN_INVALID', 'LEVEL_TOO_LOW'] as const
    for (const code of codes) expect(isAuthFailure({ code, message: 'm' })).toBe(true)
    const others = ['RATE_LIMITED', 'VALIDATION_ERROR', 'NOT_FOUND', 'NETWORK', 'INTERNAL'] as const
    for (const code of others) expect(isAuthFailure({ code, message: 'm' })).toBe(false)
  })

  it('API-T-UI-017 write_wrappers_send_contract_keys_only_and_never_reject', async () => {
    const fn = stubFetch(async () => json({}))
    await createRoom({ title: 't', extra: 1 } as CreateRoomBody)
    await appendUser('r1', { text: 'x', ooc: false, extra: 1 } as Parameters<typeof appendUser>[1])
    expect(fn.mock.calls.map(([, init]) => (init as RequestInit).body)).toEqual([
      '{"title":"t"}',
      '{"text":"x","ooc":false}',
    ])
    const writes: Array<() => Promise<unknown>> = [
      () => createRoom({ title: 't' }),
      () => renameRoom('r1', { title: 't' }),
      () => deleteRoom('r1'),
      () => appendUser('r1', { text: 'x', ooc: false }),
      () => editMessage(1, { text: 'x' }),
      () => deleteMessage(1),
    ]
    const broken: Array<[() => unknown, string]> = [
      [() => Promise.reject(new TypeError('offline')), 'NETWORK'],
      [() => new Response('<html>oops</html>', { status: 500 }), 'INTERNAL'],
    ]
    for (const [impl, code] of broken) {
      stubFetch(async () => impl())
      for (const call of writes) {
        expect(await call()).toMatchObject({ ok: false, error: { code } })
      }
    }
  })

  it('API-T-UI-018 token_never_persisted_or_sent_in_query', () => {
    // 리뷰 grep(§14.8)이 정본. 여기서는 getter 가 읽기 요청에서 호출되지 않음만 확인한다
    const getToken = vi.fn(() => 'tok')
    configureClient({ getToken })
    stubFetch(async () => json([]))
    return listRooms().then(() => expect(getToken).not.toHaveBeenCalled())
  })
})

describe('S3 생성 래퍼', () => {
  const message = {
    id: 72,
    roomId: 'r1',
    speaker: 'ciel',
    kind: 'line',
    text: 't',
    authorName: null,
  }

  it('API-T-UI-019 generate_wrappers_send_method_url_body_and_bearer', async () => {
    configureClient({ getToken: () => 'tok' })
    const fn = stubFetch(async () => json(message, 201))
    await speak('r1', { character: 'ciel' })
    await speak('a b', { character: 'ciel', extra: 1 } as SpeakBody)
    await regenerate(72)
    const calls = fn.mock.calls.map(([url, init]) => ({
      url: url as string,
      init: init as RequestInit,
      headers: new Headers((init as RequestInit).headers),
    }))
    expect(calls.map(c => [c.init.method, c.url])).toEqual([
      ['POST', '/api/rooms/r1/speak'],
      ['POST', '/api/rooms/a%20b/speak'],
      ['POST', '/api/messages/72/regenerate'],
    ])
    expect(calls[0]?.init.body).toBe('{"character":"ciel"}')
    expect(calls[1]?.init.body).toBe('{"character":"ciel"}')
    expect(calls[0]?.headers.get('Content-Type')).toBe('application/json')
    expect(calls[2]?.init.body).toBeUndefined()
    expect(calls[2]?.headers.has('Content-Type')).toBe(false)
    for (const c of calls) expect(c.headers.get('Authorization')).toBe('Bearer tok')
  })

  it('API-T-UI-020 generate_wrappers_pass_s3_codes_and_never_reject', async () => {
    const cases = [
      ['SPEAK_IN_PROGRESS', 409],
      ['NOT_LAST_MESSAGE', 409],
      ['NOT_CHARACTER_MESSAGE', 400],
      ['LLM_FAILED', 502],
      ['LLM_EMPTY', 502],
      ['CONFIG_INVALID', 500],
    ] as const
    const calls: Array<() => Promise<unknown>> = [
      () => speak('r1', { character: 'ciel' }),
      () => regenerate(72),
    ]
    for (const [code, status] of cases) {
      const error = { code, message: ERROR_MESSAGES[code] }
      for (const call of calls) {
        stubFetch(async () => json({ error }, status))
        const result = (await call()) as { ok: false; error: ApiError }
        expect(result).toEqual({ ok: false, error })
        expect(isAuthFailure(result.error)).toBe(false)
      }
    }
    const broken: Array<[() => unknown, string]> = [
      [() => Promise.reject(new TypeError('offline')), 'NETWORK'],
      [() => new Response('<html>Bad Gateway</html>', { status: 502 }), 'INTERNAL'],
    ]
    for (const [impl, code] of broken) {
      stubFetch(async () => impl())
      for (const call of calls) expect(await call()).toMatchObject({ ok: false, error: { code } })
    }
  })

  it('API-T-UI-028 speak_auto_sends_auto_body', async () => {
    configureClient({ getToken: () => 'tok' })
    const fn = stubFetch(async () => json(message, 201))
    const result = await speak('r1', { character: 'auto' })
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit]
    expect([init.method, url]).toEqual(['POST', '/api/rooms/r1/speak'])
    expect(init.body).toBe('{"character":"auto"}')
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok')
    expect(result).toMatchObject({ ok: true, value: { speaker: 'ciel' } })
    // @ts-expect-error 'Auto' 는 SpeakTarget 이 아니다
    const bad: SpeakBody = { character: 'Auto' }
    expect(bad.character).toBe('Auto')
  })

  it('API-T-UI-029 author_name_passes_through_unchanged', async () => {
    configureClient({ getToken: () => 'tok' })
    const user = { ...message, id: 1, speaker: 'user', authorName: '어떠한 의지' }
    stubFetch(async () => json({ messages: [user, message], hasMore: false }, 200))
    const list = await listMessages('r1')
    expect(list).toMatchObject({
      ok: true,
      value: { messages: [{ authorName: '어떠한 의지' }, { authorName: null }] },
    })
    stubFetch(async () => json(user, 201))
    const appended = await appendUser('r1', { text: 'x', ooc: false })
    expect(appended).toMatchObject({ ok: true, value: { authorName: '어떠한 의지' } })
  })

  it('API-T-UI-021 generate_wrappers_set_no_timeout', async () => {
    const fn = stubFetch(async () => json(message, 201))
    await speak('r1', { character: 'sebastian' })
    await regenerate(72)
    for (const [, init] of fn.mock.calls as Array<[string, RequestInit]>) {
      expect('signal' in init).toBe(false)
    }
  })

  const budget429 = (retryAfterSec: number, code = 'LLM_BUDGET_EXCEEDED', message = 'm') =>
    json({ error: { code, message, retryAfterSec } }, 429)

  it('API-T-UI-022 budget_exceeded_passes_code_and_drops_retryAfterSec', async () => {
    const calls: Array<() => Promise<unknown>> = [
      () => speak('r1', { character: 'ciel' }),
      () => regenerate(72),
    ]
    for (const call of calls) {
      stubFetch(async () => budget429(1_356_400))
      const result = (await call()) as { ok: boolean; error: ApiError }
      expect(result.ok).toBe(false)
      expect(result.error).toEqual({ code: 'LLM_BUDGET_EXCEEDED', message: 'm' })
      expect('retryAfterSec' in result.error).toBe(false)
      expect(isAuthFailure(result.error)).toBe(false)

      stubFetch(async () => budget429(1_356_400, 'LLM_BUDGET_EXCEEDED', ''))
      const empty = (await call()) as { ok: boolean; error: ApiError }
      expect(empty.error.message).toBe(ERROR_MESSAGES.LLM_BUDGET_EXCEEDED)
    }
  })

  it('API-T-UI-023 two_429_codes_are_distinguished_by_code', async () => {
    stubFetch(async () => budget429(40, 'RATE_LIMITED'))
    const limited = (await speak('r1', { character: 'ciel' })) as { ok: false; error: ApiError }
    stubFetch(async () => budget429(40))
    const budget = (await speak('r1', { character: 'ciel' })) as { ok: false; error: ApiError }
    expect(limited.error.retryAfterSec).toBe(40)
    expect('retryAfterSec' in budget.error).toBe(false)
    expect(limited.error.code).not.toBe(budget.error.code)
  })
})
