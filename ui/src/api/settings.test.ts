// API-T-UI-024~027 · 033~034(S3f) — doc/200_설계/contract/api.md §14.16 (fetch 모킹은 이 폴더 테스트에서만)
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
  model: 'pro',
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

  it('API-T-UI-033 save_character_settings_sends_model', async () => {
    const fn = stubFetch(async () => json({ ...RESPONSE, model: 'flash' }))
    const settings = validSettings()
    const result = await saveCharacterSettings(settings, 'flash')
    const { url, init, headers } = firstCall(fn)
    expect(url).toBe(PATH)
    expect(init.method).toBe('PUT')
    expect(headers.get('Authorization')).toBe('Bearer tok')
    const sent = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(Object.keys(sent)).toEqual(['settings', 'model'])
    expect(sent.model).toBe('flash')
    expect(result.ok && result.value.model).toBe('flash')
    // @ts-expect-error null 은 LlmModelKey 가 아니다 — 컴파일 오류가 계약
    void (() => saveCharacterSettings(settings, null))
  })

  it('API-T-UI-034 settings_model_passthrough', async () => {
    // 1) model 생략 = 본문에 model 키 없음
    const fn = stubFetch(async () => json(RESPONSE))
    await saveCharacterSettings(validSettings(), undefined)
    const { init } = firstCall(fn)
    expect(String(init.body)).not.toContain('"model"')
    expect(Object.keys(JSON.parse(String(init.body)) as object)).toEqual(['settings'])

    // 2) GET 200 model null — 정규화·기본값 채우기 없음
    stubFetch(async () => json({ ...RESPONSE, model: null }))
    const got = await getCharacterSettings()
    expect(got.ok && got.value.model).toBeNull()

    // 3) PUT 400 모델 문구 — 서버 message 그대로
    const error = { code: 'VALIDATION_ERROR', message: '공통 · AI 모델 값이 올바르지 않습니다.' }
    stubFetch(async () => json({ error }, 400))
    const bad = await saveCharacterSettings(validSettings(), 'pro')
    expect(bad).toEqual({ ok: false, error })
    if (!bad.ok) expect(isAuthFailure(bad.error)).toBe(false)
  })
})
