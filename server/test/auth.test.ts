// SRV-T-100~120 — doc/200_설계/server/auth.md §8 (교차 벡터 V1~V8 포함)
import { createExecutionContext, env } from 'cloudflare:test'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../src/app-error'
import { createApp } from '../src/app'
import {
  createAuthService,
  getPrincipal,
  rateLimitWrites,
  readBearer,
  requireToken,
  retryAfterSecOf,
  TOKEN_MAX_LENGTH,
  verifyToken,
  windowStartOf,
  type VerifyResult,
} from '../src/auth'
import { decodeBase64Url, encodeBase64Url } from '../src/auth/base64url'
import { createDb, type Db } from '../src/db'
import type { Env } from '../src/env'
import { createLogger, type LogLevel } from '../src/logger'
import type { AppEnv } from '../src/services'
import { resetDb } from './helpers'
import { signTestToken } from './token'
import {
  TOKEN_V5,
  TOKEN_V5B,
  TOKEN_VECTORS,
  VECTOR_EXP_SEC,
  VECTOR_MIN_LEVEL,
  VECTOR_NOW_MS,
  VECTOR_SECRET,
} from './token-vectors'

beforeEach(resetDb)

const OPTS = { secret: VECTOR_SECRET, minLevel: VECTOR_MIN_LEVEL, nowMs: VECTOR_NOW_MS }
const V1_PRINCIPAL = {
  mbId: 'tester01',
  nick: '테스터',
  chName: '시엘 팬텀하이브',
  level: 5,
  displayName: '시엘 팬텀하이브',
}
const BASE_PAYLOAD = {
  mb_id: 'tester01',
  nick: '테스터',
  ch_name: '시엘',
  level: 5,
  exp: VECTOR_EXP_SEC,
}

const failureOf = (r: VerifyResult): string => (r.ok ? 'OK' : `${r.error.code}/${r.error.reason}`)

const sign = (payload: Record<string, unknown> | string | Uint8Array) =>
  signTestToken(payload, VECTOR_SECRET)

describe('verifyToken', () => {
  it('SRV-T-100 verifyToken_accepts_vector_V1_and_builds_principal', async () => {
    const r = await verifyToken(TOKEN_VECTORS.V1, OPTS)
    expect(r).toEqual({ ok: true, value: V1_PRINCIPAL })
  })

  it('SRV-T-101 verifyToken_uses_nick_when_ch_name_blank', async () => {
    const v2 = await verifyToken(TOKEN_VECTORS.V2, OPTS)
    expect(v2).toEqual({
      ok: true,
      value: { mbId: 'tester02', nick: '닉네임', chName: null, level: 10, displayName: '닉네임' },
    })
    for (const chName of [null, '   ']) {
      const token = await sign({ ...BASE_PAYLOAD, ch_name: chName })
      const r = await verifyToken(token, OPTS)
      expect(r.ok && r.value.chName).toBeNull()
      expect(r.ok && r.value.displayName).toBe('테스터')
    }
  })

  it('SRV-T-102 verifyToken_accepts_php_default_escaped_payload', async () => {
    const v7 = await verifyToken(TOKEN_VECTORS.V7, OPTS)
    expect(v7).toEqual({ ok: true, value: V1_PRINCIPAL })
    const v4 = await verifyToken(TOKEN_VECTORS.V4, OPTS)
    expect(v4.ok && v4.value.displayName).toBe('Ciel')
    expect(v4.ok && v4.value.mbId).toBe('ascii_only')
  })

  it('SRV-T-103 verifyToken_rejects_signature_mismatch', async () => {
    const [, seg2] = TOKEN_VECTORS.V4.split('.')
    const tampered = encodeBase64Url(
      new TextEncoder().encode(
        '{"mb_id":"ascii_only","nick":"Tester","ch_name":"Ciel","level":9,"exp":1767268800}',
      ),
    )
    for (const token of [TOKEN_V5, TOKEN_VECTORS.V6, `${tampered}.${seg2}`]) {
      expect(failureOf(await verifyToken(token, OPTS))).toBe('TOKEN_INVALID/signature')
    }
  })

  it('SRV-T-104 verifyToken_rejects_malformed_format', async () => {
    const [seg1, seg2] = TOKEN_VECTORS.V1.split('.') as [string, string]
    const short = encodeBase64Url(new Uint8Array(31).fill(7))
    const cases = [
      '',
      'abc',
      'a.b.c',
      '.x',
      'x.',
      '@@.##',
      `${seg1}=.${seg2}`,
      `${seg1}.${short}`,
      'a'.repeat(TOKEN_MAX_LENGTH + 1),
      TOKEN_V5B,
    ]
    for (const raw of cases) {
      expect(failureOf(await verifyToken(raw, OPTS))).toBe('TOKEN_INVALID/format')
    }
    expect(decodeBase64Url('A')).toBeNull()
    expect(decodeBase64Url('QQ')).toEqual(new Uint8Array([0x41]))
    expect(decodeBase64Url('QR')).toBeNull()
  })

  it('SRV-T-105 verifyToken_rejects_signed_but_invalid_payload', async () => {
    const { ch_name: _omitted, ...withoutChName } = BASE_PAYLOAD
    const { mb_id: _mb, ...withoutMbId } = BASE_PAYLOAD
    const payloads: (Record<string, unknown> | string | Uint8Array)[] = [
      'not json',
      new Uint8Array([0xff, 0xfe, 0xfd]),
      '[]',
      withoutMbId,
      { ...BASE_PAYLOAD, mb_id: '' },
      { ...BASE_PAYLOAD, level: '5' },
      { ...BASE_PAYLOAD, level: 5.5 },
      { ...BASE_PAYLOAD, level: 0 },
      { ...BASE_PAYLOAD, level: 11 },
      { ...BASE_PAYLOAD, exp: '1767268800' },
      { ...BASE_PAYLOAD, nick: ' ' },
      withoutChName,
    ]
    for (const p of payloads) {
      expect(failureOf(await verifyToken(await sign(p), OPTS))).toBe('TOKEN_INVALID/payload')
    }
  })

  it('SRV-T-106 verifyToken_rejects_expired_at_boundary', async () => {
    const at = VECTOR_EXP_SEC * 1000
    expect(failureOf(await verifyToken(TOKEN_VECTORS.V1, { ...OPTS, nowMs: at }))).toBe(
      'TOKEN_INVALID/expired',
    )
    expect(failureOf(await verifyToken(TOKEN_VECTORS.V1, { ...OPTS, nowMs: at - 1 }))).toBe('OK')
  })

  it('SRV-T-107 verifyToken_rejects_low_level_after_signature_and_exp', async () => {
    expect(failureOf(await verifyToken(TOKEN_VECTORS.V3, OPTS))).toBe('LEVEL_TOO_LOW/level')
    expect(failureOf(await verifyToken(TOKEN_VECTORS.V3, { ...OPTS, minLevel: 4 }))).toBe('OK')
    expect(
      failureOf(await verifyToken(TOKEN_VECTORS.V3, { ...OPTS, secret: 'wrong-secret' })),
    ).toBe('TOKEN_INVALID/signature')
    const expired = { ...OPTS, nowMs: VECTOR_EXP_SEC * 1000 + 1 }
    expect(failureOf(await verifyToken(TOKEN_VECTORS.V3, expired))).toBe('TOKEN_INVALID/expired')
  })

  it('SRV-T-108 verifyToken_ignores_unknown_payload_keys', async () => {
    const token = await sign({ ...BASE_PAYLOAD, ch_name: '시엘', iat: 1, foo: 'bar' })
    const r = await verifyToken(token, OPTS)
    expect(r).toEqual({
      ok: true,
      value: { mbId: 'tester01', nick: '테스터', chName: '시엘', level: 5, displayName: '시엘' },
    })
  })
})

describe('readBearer', () => {
  it('SRV-T-109 readBearer_extracts_only_bearer_scheme', () => {
    for (const h of [undefined, '', '   ', 'Bearer', 'Bearer   ', 'Basic abc']) {
      expect(readBearer(h)).toBeNull()
    }
    for (const h of ['Bearer t', 'bearer t', 'Bearer   t  ']) expect(readBearer(h)).toBe('t')
  })
})

describe('rate limit window', () => {
  it('SRV-T-110 windowStartOf_and_retryAfterSecOf_compute_minute_window', () => {
    const w = Math.floor(VECTOR_NOW_MS / 60_000) * 60_000
    expect([w, w + 15_000, w + 59_999].map(windowStartOf)).toEqual([w, w, w])
    expect([w, w + 15_000, w + 59_999].map(retryAfterSecOf)).toEqual([60, 45, 1])
  })
})

type LogLine = { level: LogLevel; line: string }
const collector = () => {
  const lines: LogLine[] = []
  return { lines, sink: (level: LogLevel, line: string) => void lines.push({ level, line }) }
}
const parsed = (lines: LogLine[]) => lines.map(l => JSON.parse(l.line) as Record<string, unknown>)

const W = Math.floor(VECTOR_NOW_MS / 60_000) * 60_000
const serviceAt = (nowMs: number, limit = 20, db: Db = createDb(env.DB)) => {
  const log = collector()
  const service = createAuthService({
    db,
    logger: createLogger(log.sink),
    now: () => nowMs,
    config: { tokenSecret: VECTOR_SECRET, tokenMinLevel: VECTOR_MIN_LEVEL, rateLimitPerMin: limit },
  })
  return { log, service }
}
const countRows = async (where = '1 = 1', ...binds: unknown[]): Promise<number> =>
  (
    await env.DB.prepare(`SELECT COUNT(*) AS n FROM rate_limits WHERE ${where}`)
      .bind(...binds)
      .first<{ n: number }>()
  )?.n ?? -1

const rejection = async (p: Promise<unknown>): Promise<AppError> => {
  try {
    await p
  } catch (e) {
    if (e instanceof AppError) return e
    throw e
  }
  throw new Error('NO_ERROR')
}

describe('hitRateLimit', () => {
  it('SRV-T-111 hitRateLimit_allows_limit_then_throws_RATE_LIMITED', async () => {
    const { service, log } = serviceAt(W + 15_000)
    for (let i = 0; i < 20; i += 1) await service.hitRateLimit('mb_a')
    const err = await rejection(service.hitRateLimit('mb_a'))
    expect([err.code, err.status, err.retryAfterSec]).toEqual(['RATE_LIMITED', 429, 45])
    expect(
      (
        await env.DB.prepare('SELECT count FROM rate_limits WHERE mb_id = ?1').bind('mb_a').first<{
          count: number
        }>()
      )?.count,
    ).toBe(20)
    const warn = parsed(log.lines).find(l => l.event === 'rate_limited')
    expect(warn?.mbId).toBe('mb_a')
  })

  it('SRV-T-112 hitRateLimit_resets_next_window_and_purges_old_rows', async () => {
    const first = serviceAt(W + 1000).service
    for (let i = 0; i < 20; i += 1) await first.hitRateLimit('mb_a')
    await first.hitRateLimit('mb_b')
    const next = serviceAt(W + 60_000 + 1000).service
    await next.hitRateLimit('mb_a')
    expect(await countRows('mb_id = ?1 AND window_start = ?2', 'mb_a', W + 60_000)).toBe(1)
    expect(await countRows('window_start < ?1', W + 60_000)).toBe(0)
  })

  it('SRV-T-113 hitRateLimit_counts_each_mbId_independently', async () => {
    const { service } = serviceAt(W + 1000)
    for (let i = 0; i < 20; i += 1) await service.hitRateLimit('mb_a')
    await expect(service.hitRateLimit('mb_b')).resolves.toBeUndefined()
  })

  it('SRV-T-114 hitRateLimit_concurrent_hits_never_exceed_limit', async () => {
    const { service } = serviceAt(W + 1000)
    const results = await Promise.allSettled(
      Array.from({ length: 25 }, () => service.hitRateLimit('mb_a')),
    )
    const rejected = results.filter(r => r.status === 'rejected')
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(20)
    expect(rejected).toHaveLength(5)
    for (const r of rejected) expect((r.reason as AppError).code).toBe('RATE_LIMITED')
    expect(
      (await env.DB.prepare('SELECT count FROM rate_limits').first<{ count: number }>())?.count,
    ).toBe(20)
  })

  it('SRV-T-115 hitRateLimit_ignores_purge_failure', async () => {
    const db = {
      rateLimits: {
        hit: async () => 1,
        purgeBefore: () => Promise.reject(new Error('purge down')),
      },
    } as unknown as Db
    const { service, log } = serviceAt(W + 1000, 20, db)
    await expect(service.hitRateLimit('mb_a')).resolves.toBeUndefined()
    expect(parsed(log.lines).some(l => l.event === 'rate_limit_purge_failed')).toBe(true)
  })
})

// ---- 미들웨어 (시험용 라우트를 createApp 에 주입) ----
const NOT_RUN = { count: 0 }
const testRoutes = new Hono<AppEnv>()
testRoutes.post('/t/w', requireToken, rateLimitWrites, c => {
  NOT_RUN.count += 1
  const p = getPrincipal(c)
  return c.json({ mbId: p.mbId, displayName: p.displayName })
})
testRoutes.post('/t/quiet', requireToken, c => c.json({ ok: true }))
testRoutes.post('/t/limit-only', rateLimitWrites, c => {
  NOT_RUN.count += 1
  return c.json({ ok: true })
})

/** parseEnv 가 32자 미만을 거절하므로(SEC-001) HTTP 계층 시험은 긴 SECRET 으로 벡터 payload 를 다시 서명해 쓴다. 벡터(VECTOR_SECRET)는 교차 언어 기준이라 바꾸지 않는다 */
const APP_SECRET = 'london-dispatch-app-test-secret-0123456789'
const resign = async (vectorToken: string): Promise<string> => {
  const payload = decodeBase64Url(vectorToken.split('.')[0] ?? '')
  if (payload === null) throw new Error('bad vector')
  return signTestToken(payload, APP_SECRET)
}

const appEnv = (overrides: Record<string, unknown> = {}): Env =>
  ({
    DB: env.DB,
    ASSETS: { fetch: async () => new Response('x') },
    TOKEN_SECRET: APP_SECRET,
    ...overrides,
  }) as unknown as Env

const makeApp = (nowMs = VECTOR_NOW_MS) => {
  const log = collector()
  return { log, app: createApp({ routes: testRoutes, logSink: log.sink, now: () => nowMs }) }
}

const post = (
  app: ReturnType<typeof createApp>,
  path: string,
  init: { headers?: Record<string, string> } = {},
  e: Env = appEnv(),
): Promise<Response> =>
  Promise.resolve(
    app.fetch(
      new Request(`http://test${path}`, { method: 'POST', ...init }),
      e,
      createExecutionContext(),
    ),
  )

const bearer = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } })
type ErrBody = { error: { code: string; retryAfterSec?: number } }

describe('requireToken · rateLimitWrites', () => {
  beforeEach(() => {
    NOT_RUN.count = 0
  })

  it('SRV-T-116 requireToken_rejects_missing_or_non_header_token', async () => {
    const { app } = makeApp()
    const v1 = await resign(TOKEN_VECTORS.V1)
    const cases: [string, { headers?: Record<string, string> }][] = [
      ['/t/w', {}],
      [`/t/w?t=${v1}`, {}],
      ['/t/w', { headers: { Cookie: `t=${v1}` } }],
      ['/t/w', { headers: { Authorization: 'Basic x' } }],
    ]
    for (const [path, init] of cases) {
      const res = await post(app, path, init)
      expect(res.status).toBe(401)
      expect(((await res.json()) as ErrBody).error.code).toBe('TOKEN_REQUIRED')
    }
    expect(NOT_RUN.count).toBe(0)
  })

  it('SRV-T-117 requireToken_maps_failures_and_sets_principal', async () => {
    const { app } = makeApp()
    const forged = await post(app, '/t/w', bearer(TOKEN_V5))
    expect([forged.status, ((await forged.json()) as ErrBody).error.code]).toEqual([
      401,
      'TOKEN_INVALID',
    ])
    const low = await post(app, '/t/w', bearer(await resign(TOKEN_VECTORS.V3)))
    expect([low.status, ((await low.json()) as ErrBody).error.code]).toEqual([403, 'LEVEL_TOO_LOW'])
    const ok = await post(app, '/t/w', bearer(await resign(TOKEN_VECTORS.V1)))
    expect(ok.status).toBe(200)
    expect(await ok.json()).toEqual({ mbId: 'tester01', displayName: '시엘 팬텀하이브' })
  })

  it('SRV-T-118 rateLimitWrites_returns_429_with_retryAfterSec', async () => {
    const { app } = makeApp()
    const e = appEnv({ RATE_LIMIT_PER_MIN: '2' })
    const v1 = await resign(TOKEN_VECTORS.V1)
    for (let i = 0; i < 2; i += 1) {
      expect((await post(app, '/t/w', bearer(v1), e)).status).toBe(200)
    }
    const res = await post(app, '/t/w', bearer(v1), e)
    const body = (await res.json()) as ErrBody
    expect(res.status).toBe(429)
    expect(body.error.code).toBe('RATE_LIMITED')
    expect(Number.isInteger(body.error.retryAfterSec)).toBe(true)
    expect(body.error.retryAfterSec).toBeGreaterThanOrEqual(1)
    expect(res.headers.get('Retry-After')).toBe(String(body.error.retryAfterSec))
  })

  it('SRV-T-119 getPrincipal_without_requireToken_fails_closed', async () => {
    const { app } = makeApp()
    const res = await post(app, '/t/limit-only', bearer(await resign(TOKEN_VECTORS.V1)))
    expect(res.status).toBe(401)
    expect(((await res.json()) as ErrBody).error.code).toBe('TOKEN_REQUIRED')
    expect(NOT_RUN.count).toBe(0)
    expect(await countRows()).toBe(0)
  })

  it('SRV-T-120 auth_logs_and_bodies_never_contain_token_or_payload', async () => {
    const sentinelNick = await signTestToken(
      { ...BASE_PAYLOAD, mb_id: 'mb_sentinel', nick: 'SENTINEL_NICK', ch_name: '' },
      APP_SECRET,
    )
    const sentinelSecretToken = await signTestToken(BASE_PAYLOAD, 'other-secret')
    const expiredAt = VECTOR_EXP_SEC * 1000 + 1000
    const seen: string[] = []
    const run = async (nowMs: number, token: string, e: Env = appEnv()) => {
      const { app, log } = makeApp(nowMs)
      const res = await post(app, '/t/quiet', bearer(token), e)
      seen.push(await res.text(), ...log.lines.map(l => l.line))
      return log
    }
    const v1 = await resign(TOKEN_VECTORS.V1)
    const expiredLog = await run(expiredAt, v1)
    await run(VECTOR_NOW_MS, TOKEN_V5)
    await run(VECTOR_NOW_MS, sentinelNick)
    await run(
      VECTOR_NOW_MS,
      sentinelSecretToken,
      appEnv({ TOKEN_SECRET: 'SENTINEL_SECRET_0123456789abcdefghijklmn' }),
    )
    const all = seen.join('\n')
    const seg1s = [v1, TOKEN_V5, sentinelNick, sentinelSecretToken].map(t => t.split('.')[0] ?? '')
    for (const t of [v1, TOKEN_V5, sentinelNick, sentinelSecretToken, ...seg1s]) {
      expect(all).not.toContain(t)
    }
    for (const s of ['SENTINEL_NICK', 'SENTINEL_SECRET']) expect(all).not.toContain(s)
    const rejected = parsed(expiredLog.lines).find(l => l.event === 'auth_rejected')
    expect(rejected).toMatchObject({ code: 'TOKEN_INVALID', reason: 'expired' })
  })
})
