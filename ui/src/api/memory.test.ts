// API-T-UI-030~032 — doc/200_설계/contract/api.md §14.20 (fetch 모킹은 이 폴더 테스트에서만)
import { ERROR_MESSAGES } from '@shared/errors'
import type { MemoryResponse, PutMemoryBody } from '@shared/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configureClient, getMemory, isAuthFailure, putMemory } from './index'

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

const errorBody = (code: string, message: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message, ...extra },
})

beforeEach(() => configureClient({ getToken: () => 'tok' }))
afterEach(() => vi.unstubAllGlobals())

describe('S4 장기기억 래퍼', () => {
  it('API-T-UI-030 get_memory_sends_bearer', async () => {
    const response: MemoryResponse = { summary: '', sourceUntilId: 0, updatedAt: null }
    const fn = stubFetch(async () => json(response))
    const result = await getMemory('r 1')
    const { url, init, headers } = firstCall(fn)
    expect(url).toBe('/api/rooms/r%201/memory')
    expect(init.method).toBe('GET')
    expect(headers.get('Authorization')).toBe('Bearer tok')
    expect(init.body).toBeUndefined()
    expect(headers.has('Content-Type')).toBe(false)
    expect(result).toEqual({ ok: true, value: response })
  })

  it('API-T-UI-031 put_memory_sends_summary_only', async () => {
    const response: MemoryResponse = { summary: 'a', sourceUntilId: 7, updatedAt: 1 }
    const fn = stubFetch(async () => json(response))
    const result = await putMemory('r1', { summary: '  a  ', extra: 1 } as PutMemoryBody)
    const { url, init, headers } = firstCall(fn)
    expect(url).toBe('/api/rooms/r1/memory')
    expect(init.method).toBe('PUT')
    expect(init.body).toBe('{"summary":"  a  "}')
    expect(headers.get('Authorization')).toBe('Bearer tok')
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(result).toEqual({ ok: true, value: response })
    // @ts-expect-error summary 는 문자열이어야 한다
    void putMemory('r1', { summary: 1 })
  })

  it('API-T-UI-032 memory_errors_normalized', async () => {
    stubFetch(async () => json(errorBody('TOKEN_INVALID', ERROR_MESSAGES.TOKEN_INVALID), 401))
    const auth = await getMemory('r1')
    expect(auth.ok).toBe(false)
    if (!auth.ok) {
      expect(auth.error.code).toBe('TOKEN_INVALID')
      expect(isAuthFailure(auth.error)).toBe(true)
    }

    const length = '장기기억은 0~4000자로 입력해 주세요.'
    stubFetch(async () => json(errorBody('VALIDATION_ERROR', length), 400))
    const tooLong = await putMemory('r1', { summary: 'x' })
    expect(tooLong.ok).toBe(false)
    if (!tooLong.ok) expect(tooLong.error.message).toBe(length)

    stubFetch(async () =>
      json(errorBody('RATE_LIMITED', ERROR_MESSAGES.RATE_LIMITED, { retryAfterSec: 40 }), 429),
    )
    const limited = await putMemory('r1', { summary: 'x' })
    expect(limited.ok).toBe(false)
    if (!limited.ok) expect(limited.error.retryAfterSec).toBe(40)

    stubFetch(async () => json(errorBody('NOT_FOUND', '방을 찾을 수 없습니다.'), 404))
    const missing = await getMemory('nope')
    expect(missing.ok).toBe(false)
    if (!missing.ok) expect(missing.error.code).toBe('NOT_FOUND')

    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    const network = await putMemory('r1', { summary: 'x' })
    expect(network.ok).toBe(false)
    if (!network.ok) expect(network.error.code).toBe('NETWORK')
  })
})
