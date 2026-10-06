// API-T-091~103 — doc/200_설계/contract/api.md §14.14 (E15·E16: 토큰 → 주인 → 레이트리밋 → 본문 상한 → 검증). 자리표시 ID 만 쓴다
import { createExecutionContext, env } from 'cloudflare:test'
import { ERROR_MESSAGES, ERROR_STATUS, type ErrorCode } from '@shared/errors'
import { checkCharacterSettings } from '@shared/settings'
import type { CharacterSettings, CharacterSettingsResponse } from '@shared/types'
import { beforeEach, describe, expect, it } from 'vitest'
import { validSettings } from '../../shared/test/settings-vectors'
import { createApp } from '../src/app'
import type { Env } from '../src/env'
import { apiRoutes } from '../src/routes'
import { resetDb } from './helpers'
import { signTestToken } from './token'

const NOW = 1_700_000_000_000
const SECRET = 'test-secret'
const PATH = '/api/settings/characters'
const MIN_LEVEL = 5

const baseEnv = (overrides: Record<string, unknown> = {}): Env =>
  ({
    DB: env.DB,
    ASSETS: { fetch: async () => new Response('<html></html>') } as unknown as Fetcher,
    TOKEN_SECRET: SECRET,
    OWNER_MB_IDS: 'owner01',
    ...overrides,
  }) as unknown as Env

const makeApp = (now: number) =>
  createApp({ routes: apiRoutes, logSink: () => undefined, now: () => now })
const app = makeApp(NOW)

const tokenFor = (mbId: string, level = MIN_LEVEL): Promise<string> =>
  signTestToken(
    { mb_id: mbId, nick: '테스터', ch_name: '', level, exp: NOW / 1000 + 43200 },
    SECRET,
  )
const ownerToken = (): Promise<string> => tokenFor('owner01')
const memberToken = (): Promise<string> => tokenFor('member01')
const lowOwnerToken = (): Promise<string> => tokenFor('owner01', MIN_LEVEL - 1)

type Opts = {
  token?: string | null
  body?: unknown
  contentType?: string | null
  env?: Env
  path?: string
  app?: typeof app
}

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
  return (opts.app ?? app).fetch(
    new Request(`http://test${opts.path ?? PATH}`, init),
    opts.env ?? baseEnv(),
    createExecutionContext(),
  )
}

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

const rowCount = async (): Promise<number> =>
  (await env.DB.prepare('SELECT COUNT(*) AS n FROM character_settings').first<{ n: number }>())
    ?.n ?? -1

const putAs = async (body: unknown, e?: Env): Promise<Response> =>
  send('PUT', { token: await ownerToken(), body, ...(e !== undefined && { env: e }) })

/** validSettings() 를 고쳐 { settings } 봉투로 만든다 */
const withSettings = (edit: (s: CharacterSettings) => void): { settings: CharacterSettings } => {
  const settings = validSettings()
  edit(settings)
  return { settings }
}
const BAD_FORM = '공통 · 설정 형식이 올바르지 않습니다.'

beforeEach(resetDb)

describe('E15·E16 인증 · 주인', () => {
  it('API-T-091 settings_require_token', async () => {
    const owner = await ownerToken()
    for (const method of ['GET', 'PUT']) {
      const base = method === 'PUT' ? { body: { settings: validSettings() } } : {}
      await expectContractError(await send(method, { ...base }), 'TOKEN_REQUIRED')
      await expectContractError(await send(method, { ...base, token: 'garbage' }), 'TOKEN_INVALID')
      await expectContractError(
        await send(method, { ...base, path: `${PATH}?t=${owner}` }),
        'TOKEN_REQUIRED',
      )
    }
    expect((await send('PUT', { body: '{broken' })).status).toBe(401)
    expect(await rowCount()).toBe(0)
  })

  it('API-T-092 settings_level_checked_before_owner', async () => {
    const low = await lowOwnerToken()
    await expectContractError(await send('GET', { token: low }), 'LEVEL_TOO_LOW')
    await expectContractError(
      await send('PUT', { token: low, body: { settings: validSettings() } }),
      'LEVEL_TOO_LOW',
    )
  })

  it('API-T-093 settings_non_owner_gets_owner_only', async () => {
    const member = await memberToken()
    const get = await send('GET', { token: member })
    expect(await expectContractError(get.clone(), 'OWNER_ONLY')).toBe(ERROR_MESSAGES.OWNER_ONLY)
    const text = await get.text()
    expect(text).not.toContain('owner01')
    expect(text).not.toContain('member01')
    const put = await send('PUT', { token: member, body: { settings: validSettings() } })
    expect(await expectContractError(put, 'OWNER_ONLY')).toBe(ERROR_MESSAGES.OWNER_ONLY)

    await expectContractError(
      await send('GET', { token: await ownerToken(), env: baseEnv({ OWNER_MB_IDS: '' }) }),
      'OWNER_ONLY',
    )

    const limited = baseEnv({ RATE_LIMIT_PER_MIN: '1' })
    for (let i = 0; i < 3; i += 1) {
      const res = await send('PUT', {
        token: member,
        body: { settings: validSettings() },
        env: limited,
      })
      await expectContractError(res, 'OWNER_ONLY')
    }
    expect(await rowCount()).toBe(0)
  })
})

describe('E15 읽기 · E16 저장', () => {
  it('API-T-094 settings_get_returns_seed_when_never_saved', async () => {
    const res = await send('GET', { token: await ownerToken() })
    expect(res.status).toBe(200)
    const text = await res.text()
    const body = JSON.parse(text) as CharacterSettingsResponse
    expect(Object.keys(body).sort()).toEqual(['isDefault', 'settings', 'updatedAt', 'version'])
    expect(body).toMatchObject({ isDefault: true, version: 0, updatedAt: null })
    expect(checkCharacterSettings(body.settings).ok).toBe(true)
    expect(Object.keys(body.settings.characters).sort()).toEqual(['ciel', 'sebastian'])
    for (const character of Object.values(body.settings.characters)) {
      expect(Object.keys(character)).toHaveLength(11)
    }
    for (const leak of ['owner01', 'updatedBy', 'mbId', 'outputRules']) {
      expect(text).not.toContain(leak)
    }
  })

  it('API-T-095 settings_put_replaces_and_normalizes', async () => {
    const input = withSettings(s => {
      s.world = '  19세기 말 런던.  '
      s.characters.sebastian.sampleDialogue = ['  a ', '', '   ']
    })
    const first = await putAs(input)
    expect(first.status).toBe(200)
    const firstBody = await first.json<CharacterSettingsResponse>()
    const checked = checkCharacterSettings(input.settings)
    expect(checked.ok).toBe(true)
    expect(firstBody.settings).toEqual(checked.ok ? checked.value : null)
    expect(firstBody).toMatchObject({ version: 1, updatedAt: NOW, isDefault: false })
    expect(firstBody.settings.characters.sebastian.sampleDialogue).toEqual(['a'])

    const got = await send('GET', { token: await ownerToken() })
    expect(await got.json()).toEqual(firstBody)

    const second = await (await putAs(input)).json<CharacterSettingsResponse>()
    expect(second.version).toBe(2)
  })

  it('API-T-096 settings_put_rejects_unknown_keys', async () => {
    const cases: Array<[string, unknown, string]> = [
      [
        'character key',
        withSettings(s => Object.assign(s.characters.sebastian, { apiKey: 'x' })),
        '세바스찬 · 알 수 없는 항목이 있습니다.',
      ],
      [
        'third character',
        withSettings(s => Object.assign(s.characters, { meirin: s.characters.ciel })),
        '공통 · 알 수 없는 캐릭터가 있습니다.',
      ],
      [
        'settings key',
        withSettings(s => Object.assign(s, { outputRules: 'x' })),
        '공통 · 알 수 없는 항목이 있습니다.',
      ],
    ]
    for (const [name, body, message] of cases) {
      const got = await expectContractError(await putAs(body), 'VALIDATION_ERROR')
      expect(got, name).toBe(message)
      expect(got).not.toContain('apiKey')
    }
    expect(await rowCount()).toBe(0)
    const envelope = { settings: validSettings(), extra: 1 }
    expect((await putAs(envelope)).status).toBe(200)
  })

  it('API-T-097 settings_put_limits_by_code_points', async () => {
    type Edit = (s: CharacterSettings, n: number) => void
    const edits: Array<[string, Edit, number, string]> = [
      [
        'speech',
        (s, n) => {
          s.characters.ciel.speech = 'a'.repeat(n)
        },
        800,
        '시엘 · 말투는 1~800자여야 합니다.',
      ],
      [
        'dialogue count',
        (s, n) => {
          s.characters.sebastian.sampleDialogue = Array.from({ length: n }, () => 'a')
        },
        10,
        '세바스찬 · 샘플 대사는 10개 이하여야 합니다.',
      ],
      [
        'rule item',
        (s, n) => {
          s.characters.ciel.rules = ['a'.repeat(n)]
        },
        200,
        '시엘 · 규칙·금기는 한 줄에 200자 이하여야 합니다.',
      ],
      [
        'world',
        (s, n) => {
          s.world = 'a'.repeat(n)
        },
        2000,
        '공통 · 세계관은 1~2000자여야 합니다.',
      ],
    ]
    for (const [name, edit, max, message] of edits) {
      expect((await putAs(withSettings(s => edit(s, max)))).status, `${name} max`).toBe(200)
      const res = await putAs(withSettings(s => edit(s, max + 1)))
      expect(await expectContractError(res, 'VALIDATION_ERROR'), name).toBe(message)
    }
    const emoji = withSettings(s => {
      s.characters.ciel.speech = '😀'.repeat(800)
    })
    expect((await putAs(emoji)).status).toBe(200)
  })

  it('API-T-098 settings_put_rejects_empty_required_and_bad_types', async () => {
    const cases: Array<[unknown, string]> = [
      [
        withSettings(s => {
          s.world = '   '
        }),
        '공통 · 세계관은 1~2000자여야 합니다.',
      ],
      [
        withSettings(s => {
          s.characters.sebastian.persona = ''
        }),
        '세바스찬 · 성격·배경은 1~1500자여야 합니다.',
      ],
      [
        withSettings(s => Reflect.deleteProperty(s.characters.ciel, 'speech')),
        '시엘 · 말투 값의 형식이 올바르지 않습니다.',
      ],
      [
        withSettings(s => Object.assign(s.characters.ciel, { rules: 'a' })),
        '시엘 · 규칙·금기 값의 형식이 올바르지 않습니다.',
      ],
      [
        withSettings(s => Reflect.deleteProperty(s.characters, 'ciel')),
        '시엘 · 설정 형식이 올바르지 않습니다.',
      ],
    ]
    for (const [body, message] of cases) {
      expect(await expectContractError(await putAs(body), 'VALIDATION_ERROR')).toBe(message)
    }
    expect(await rowCount()).toBe(0)
  })

  it('API-T-099 settings_put_reports_first_violation_only', async () => {
    const body = withSettings(s => {
      s.world = ''
      s.characters.ciel.speech = 'a'.repeat(801)
      Object.assign(s.characters.ciel, { apiKey: 'x' })
    })
    const message = await expectContractError(await putAs(body), 'VALIDATION_ERROR')
    expect(message).toBe('공통 · 세계관은 1~2000자여야 합니다.')
  })

  it('API-T-100 settings_put_body_over_128kb', async () => {
    const sized = (bytes: number): string => {
      const json = JSON.stringify({ settings: validSettings() })
      return json + ' '.repeat(bytes - new TextEncoder().encode(json).length)
    }
    const owner = await ownerToken()
    const limited = baseEnv({ RATE_LIMIT_PER_MIN: '1' })
    const big = await send('PUT', { token: owner, body: sized(131073), env: limited })
    expect(await expectContractError(big, 'VALIDATION_ERROR')).toBe(
      '공통 · 설정 본문은 128KB 이하여야 합니다.',
    )
    expect(await rowCount()).toBe(0)
    await expectContractError(
      await send('PUT', { token: owner, body: sized(1000), env: limited }),
      'RATE_LIMITED',
    )
    await resetDb()
    expect((await send('PUT', { token: owner, body: sized(131072) })).status).toBe(200)
  })

  it('API-T-101 settings_put_malformed_body', async () => {
    const owner = await ownerToken()
    const broken = await send('PUT', { token: owner, body: '{broken' })
    expect(await expectContractError(broken, 'VALIDATION_ERROR')).toBe(
      ERROR_MESSAGES.VALIDATION_ERROR,
    )
    const cases: Array<Opts> = [
      { body: JSON.stringify({ settings: validSettings() }), contentType: 'text/plain' },
      { body: {} },
      { body: { settings: null } },
    ]
    for (const opts of cases) {
      const res = await send('PUT', { token: owner, ...opts })
      expect(await expectContractError(res, 'VALIDATION_ERROR')).toBe(BAD_FORM)
    }
  })
})

describe('E15·E16 레이트리밋 · 미등록', () => {
  it('API-T-102 settings_put_rate_limited_get_not', async () => {
    const owner = await ownerToken()
    const e = baseEnv({ RATE_LIMIT_PER_MIN: '2' })
    const put = (a = app): Promise<Response> =>
      send('PUT', { token: owner, body: { settings: validSettings() }, env: e, app: a })
    expect((await put()).status).toBe(200)
    expect((await put()).status).toBe(200)
    await expectContractError(await put(), 'RATE_LIMITED')
    for (let i = 0; i < 3; i += 1) {
      expect((await send('GET', { token: owner, env: e })).status).toBe(200)
    }

    // 새 분 창: 쓰기 공용 한도(PUT · POST /api/rooms 가 같은 2회를 나눠 쓴다)
    const later = makeApp(NOW + 60_000)
    expect((await put(later)).status).toBe(200)
    const room = await send('POST', {
      token: owner,
      body: { title: 'r' },
      env: e,
      path: '/api/rooms',
      app: later,
    })
    expect(room.status).toBe(201)
    await expectContractError(await put(later), 'RATE_LIMITED')
  })

  it('API-T-103 settings_unregistered_routes_404', async () => {
    const owner = await ownerToken()
    for (const method of ['POST', 'PATCH', 'DELETE']) {
      await expectContractError(await send(method, { token: owner }), 'NOT_FOUND')
    }
    await expectContractError(
      await send('GET', { token: owner, path: '/api/settings' }),
      'NOT_FOUND',
    )
    await expectContractError(
      await send('GET', { token: owner, path: `${PATH}/sebastian` }),
      'NOT_FOUND',
    )
  })
})
