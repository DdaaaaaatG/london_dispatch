// SRV-T-236~238 — doc/200_설계/server/auth.md §12.5 (S3c 주인 판정). 자리표시 ID 만 쓴다
import { createExecutionContext, env } from 'cloudflare:test'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { createAuthService, rateLimitWrites, requireOwner, requireToken } from '../src/auth'
import { createDb } from '../src/db'
import type { Env } from '../src/env'
import { createLogger } from '../src/logger'
import type { AppEnv } from '../src/services'
import { resetDb } from './helpers'
import { signTestToken } from './token'

const NOW = 1_700_000_000_000
const SECRET = 'test-secret-0123456789-abcdefghijklmnop'

type Log = { level: string; event: string; [k: string]: unknown }

const principal = (mbId: string) => ({
  mbId,
  nick: '테스터',
  chName: '',
  level: 5,
  displayName: '테스터',
})

const token = (mbId: string, level = 5): Promise<string> =>
  signTestToken(
    { mb_id: mbId, nick: '테스터', ch_name: '', level, exp: NOW / 1000 + 43200 },
    SECRET,
  )

const routes = new Hono<AppEnv>()
let handlerRuns = 0
routes.get('/t/owner', requireToken, requireOwner, c => {
  handlerRuns += 1
  return c.json({ ok: true })
})
routes.get('/t/owner-only-middleware', requireOwner, c => c.json({ ok: true }))
routes.get('/t/owner-limited', requireToken, requireOwner, rateLimitWrites, c =>
  c.json({ ok: true }),
)

const baseEnv = (overrides: Record<string, unknown> = {}): Env =>
  ({
    DB: env.DB,
    ASSETS: { fetch: async () => new Response('x') },
    TOKEN_SECRET: SECRET,
    ...overrides,
  }) as unknown as Env

const makeApp = () => {
  const logs: Log[] = []
  const app = createApp({
    routes,
    logSink: (_level, line) => void logs.push(JSON.parse(line) as Log),
    now: () => NOW,
  })
  return { app, logs }
}

const callWith = async (
  app: ReturnType<typeof createApp>,
  path: string,
  e: Env,
  bearer: string | null,
): Promise<Response> =>
  app.fetch(
    new Request(`http://test${path}`, {
      headers: bearer === null ? {} : { Authorization: `Bearer ${bearer}` },
    }),
    e,
    createExecutionContext(),
  )

const codeOf = async (res: Response): Promise<string | undefined> =>
  ((await res.json()) as { error?: { code?: string } }).error?.code

beforeEach(async () => {
  await resetDb()
  handlerRuns = 0
})

describe('주인 판정 (S3c)', () => {
  it('SRV-T-236 isOwner_matches_exact_mbId_only', () => {
    const logs: string[] = []
    const mk = (ownerMbIds?: readonly string[]) =>
      createAuthService({
        db: createDb(env.DB),
        logger: createLogger((_l, line) => void logs.push(line)),
        now: () => NOW,
        config: {
          tokenSecret: SECRET,
          tokenMinLevel: 5,
          rateLimitPerMin: 20,
          ...(ownerMbIds === undefined ? {} : { ownerMbIds }),
        },
      })
    const auth = mk(['owner_a', 'owner_b'])
    expect(
      ['owner_a', 'owner_b', 'OWNER_A', 'owner_a ', 'member_x'].map(id =>
        auth.isOwner(principal(id)),
      ),
    ).toEqual([true, true, false, false, false])
    expect(mk([]).isOwner(principal('owner_a'))).toBe(false)
    expect(mk().isOwner(principal('owner_a'))).toBe(false)
    expect(logs).toEqual([])
  })

  it('SRV-T-237 requireOwner_four_paths_via_app', async () => {
    const { app, logs } = makeApp()
    const ok = await callWith(
      app,
      '/t/owner',
      baseEnv({ OWNER_MB_IDS: 'owner_a' }),
      await token('owner_a'),
    )
    expect(ok.status).toBe(200)
    expect(handlerRuns).toBe(1)

    const denied = await callWith(
      app,
      '/t/owner',
      baseEnv({ OWNER_MB_IDS: 'owner_a' }),
      await token('member_x'),
    )
    expect(denied.status).toBe(403)
    const deniedBody = await denied.text()
    expect(JSON.parse(deniedBody).error.code).toBe('OWNER_ONLY')
    expect(deniedBody).not.toContain('member_x')
    expect(deniedBody).not.toContain('owner_a')
    expect(logs.filter(l => l.event === 'owner_denied')).toEqual([
      expect.objectContaining({ level: 'info', event: 'owner_denied', mbId: 'member_x' }),
    ])

    const empty = await callWith(
      app,
      '/t/owner',
      baseEnv({ OWNER_MB_IDS: '' }),
      await token('owner_a'),
    )
    expect(empty.status).toBe(403)
    expect(await codeOf(empty)).toBe('OWNER_ONLY')

    const invalid = await callWith(
      app,
      '/t/owner',
      baseEnv({ OWNER_MB_IDS: 'x'.repeat(21) }),
      await token('owner_a'),
    )
    expect(invalid.status).toBe(500)
    expect(await codeOf(invalid)).toBe('CONFIG_INVALID')

    const e = baseEnv({ OWNER_MB_IDS: 'owner_a' })
    const noToken = await callWith(app, '/t/owner', e, null)
    expect([noToken.status, await codeOf(noToken)]).toEqual([401, 'TOKEN_REQUIRED'])
    const lowLevel = await callWith(app, '/t/owner', e, await token('owner_a', 2))
    expect([lowLevel.status, await codeOf(lowLevel)]).toEqual([403, 'LEVEL_TOO_LOW'])
    expect(handlerRuns).toBe(1)
  })

  it('SRV-T-237 변형 비주인 요청은 레이트리밋을 쓰지 않는다', async () => {
    const { app } = makeApp()
    const e = baseEnv({ OWNER_MB_IDS: 'owner_a', RATE_LIMIT_PER_MIN: '2' })
    for (let i = 0; i < 3; i += 1) {
      const res = await callWith(app, '/t/owner-limited', e, await token('member_x'))
      expect([res.status, await codeOf(res)]).toEqual([403, 'OWNER_ONLY'])
    }
    const rows = await env.DB.prepare('SELECT COUNT(*) AS n FROM rate_limits').first<{
      n: number
    }>()
    expect(rows?.n).toBe(0)
  })

  it('SRV-T-238 requireOwner_without_requireToken_fails_closed', async () => {
    const { app, logs } = makeApp()
    const res = await callWith(
      app,
      '/t/owner-only-middleware',
      baseEnv({ OWNER_MB_IDS: 'owner_a' }),
      await token('owner_a'),
    )
    expect([res.status, await codeOf(res)]).toEqual([401, 'TOKEN_REQUIRED'])
    expect(logs.some(l => l.event === 'owner_denied')).toBe(false)
  })
})
