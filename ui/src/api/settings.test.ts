// API-T-UI-024~027 — doc/200_설계/contract/api.md §14.16 (fetch 모킹은 이 폴더 테스트에서만)
import { ERROR_MESSAGES } from '@shared/errors'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { validSettings } from '../../../shared/test/settings-vectors'
import {
  configureClient,
  getCharacterSettings,
  isAuthFailure,
  saveCharacterSettings,
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

const RESPONSE = {
  settings: validSettings(),
  version: 3,
  updatedAt: 1_767_231_000_000,
  isDefault: false,
}
const PATH = '/api/settings/characters'

beforeEach(() => configureClient({ getToken: () => 'tok' }))
afterEach(() => vi.unstubAllGlobals())

describe('S3c 설정 래퍼', () => {
  it('API-T-UI-024 get_character_settings_sends_token_get', async () => {
    const fn = stubFetch(async () => json(RESPONSE))
    const result = await getCharacterSettings()
    const { url, init, headers } = firstCall(fn)
    expect(url).toBe(PATH)
    expect(init.method).toBe('GET')
    expect(headers.get('Authorization')).toBe('Bearer tok')
    expect(init.body).toBeUndefined()
    expect(headers.has('Content-Type')).toBe(false)
    expect(result).toEqual({ ok: true, value: RESPONSE })
  })

  it('API-T-UI-025 save_character_settings_sends_put_body', async () => {
    const fn = stubFetch(async () => json(RESPONSE))
    const settings = validSettings()
    const result = await saveCharacterSettings(settings)
    const { url, init, headers } = firstCall(fn)
    expect(url).toBe(PATH)
    expect(init.method).toBe('PUT')
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('Authorization')).toBe('Bearer tok')
    const sent = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(Object.keys(sent)).toEqual(['settings'])
    expect(sent.settings).toEqual(settings)
    expect(result).toEqual({ ok: true, value: RESPONSE })
  })

  it('API-T-UI-026 owner_only_is_not_auth_failure', async () => {
    const calls = [() => getCharacterSettings(), () => saveCharacterSettings(validSettings())]
    for (const call of calls) {
      const error = { code: 'OWNER_ONLY', message: '권한이 없습니다.' }
      stubFetch(async () => json({ error }, 403))
      const owner = await call()
      expect(owner).toEqual({ ok: false, error })
      if (!owner.ok) expect(isAuthFailure(owner.error)).toBe(false)

      stubFetch(async () => json({ error: { code: 'OWNER_ONLY', message: '' } }, 403))
      const empty = await call()
      expect(empty).toEqual({
        ok: false,
        error: { code: 'OWNER_ONLY', message: ERROR_MESSAGES.OWNER_ONLY },
      })

      stubFetch(async () => json({ error: { code: 'TOKEN_INVALID', message: 'm' } }, 401))
      const invalid = await call()
      expect(invalid.ok).toBe(false)
      if (!invalid.ok) expect(isAuthFailure(invalid.error)).toBe(true)
    }
  })

  it('API-T-UI-027 settings_wrappers_without_token', async () => {
    configureClient({ getToken: () => null })
    const error = { code: 'TOKEN_REQUIRED', message: 'm' }
    for (const call of [
      () => getCharacterSettings(),
      () => saveCharacterSettings(validSettings()),
    ]) {
      const fn = stubFetch(async () => json({ error }, 401))
      const result = await call()
      expect(firstCall(fn).headers.has('Authorization')).toBe(false)
      expect(result).toEqual({ ok: false, error })
    }
  })
})
