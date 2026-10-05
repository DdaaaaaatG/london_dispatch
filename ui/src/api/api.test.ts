// API-T-UI-001~010 — doc/200_설계/contract/api.md §14.3 (fetch 모킹은 이 폴더 테스트에서만)
import { ERROR_MESSAGES } from '@shared/errors'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { request } from './client'
import { getHealth, listMessages, listRooms } from './index'

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
    const expected = { ok: false, error: { code: 'NETWORK', message: '서버에 연결할 수 없습니다.' } }
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
    expect(await request('/x')).toEqual({ ok: false, error: { code: 'INTERNAL', message: ERROR_MESSAGES.INTERNAL } })
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
    stubFetch(async (url) => {
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
