// SRV-T-390~394 — doc/200_설계/server/auth.md §14.7 (S6 선택 토큰 · 방 입장 관문 · 입장 시도 상한)
import { env } from 'cloudflare:test'
import { ERROR_STATUS } from '@shared/errors'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../src/app-error'
import { createAuthService, isOwnerRequest, optionalToken, requireRoomEntry } from '../src/auth'
import type { AuthService } from '../src/auth'
import { createDb } from '../src/db'
import type { EntryAccess, EntryTarget } from '../src/rooms'
import type { AppEnv, Services } from '../src/services'
import { collectLogger, resetDb, TEST_SECRET } from './helpers'
import { signTestToken } from './token'

const NOW = 1_700_000_000_000
const OWNER_ID = 'owner_a'

const token = (mbId: string, level = 5): Promise<string> =>
  signTestToken(
    { mb_id: mbId, nick: '테스터', ch_name: '', level, exp: NOW / 1000 + 43200 },
    TEST_SECRET,
  )

const makeAuth = (now: () => number = () => NOW, limit?: number) => {
  const { logs, logger } = collectLogger()
  const auth = createAuthService({
    db: createDb(env.DB),
    logger,
    now,
    config: {
      tokenSecret: TEST_SECRET,
      tokenMinLevel: 5,
      rateLimitPerMin: 20,
      ownerMbIds: [OWNER_ID],
      ...(limit === undefined ? {} : { roomEnterLimitPerMin: limit }),
    },
  })
  return { auth, logs }
}

const appWith = (services: Partial<Services>) => {
  const app = new Hono<AppEnv>()
  app.use('*', async (c, next) => {
    c.set('services', services as Services)
    await next()
  })
  app.onError((e, c) => {
    if (e instanceof AppError) return c.json({ code: e.code }, ERROR_STATUS[e.code])
    return c.json({ code: 'INTERNAL' }, 500)
  })
  return app
}

const get = (app: Hono<AppEnv>, path: string, headers: Record<string, string> = {}) =>
  app.request(`http://test${path}`, { headers })

beforeEach(resetDb)

describe('optionalToken', () => {
  const run = async (authOverride?: Partial<AuthService>, handlerError?: AppError) => {
    const { auth } = makeAuth()
    const app = appWith({ auth: { ...auth, ...authOverride } })
    app.get('/t/opt', optionalToken, c => {
      if (handlerError !== undefined) throw handlerError
      return c.json({ mbId: c.get('principal')?.mbId ?? null })
    })
    return app
  }

  it('SRV-T-390 optionalToken_swallows_only_auth_failures', async () => {
    const app = await run()
    const anon = [
      {},
      { Authorization: 'Basic x' },
      {
        Authorization: `Bearer ${await signTestToken({ mb_id: 'x' }, 'other-secret-0123456789-abcdefghijklmnop')}`,
      },
      { Authorization: `Bearer ${await token('low', 1)}` },
    ]
    for (const headers of anon) {
      const res = await get(app, '/t/opt', headers)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ mbId: null })
    }
    const ok = await get(app, '/t/opt', { Authorization: `Bearer ${await token('member_x')}` })
    expect(await ok.json()).toEqual({ mbId: 'member_x' })

    const boom = await run({ authenticate: () => Promise.reject(new AppError('INTERNAL')) })
    const failed = await get(boom, '/t/opt', { Authorization: 'Bearer abc.def' })
    expect(failed.status).toBe(500)

    const downstream = await run(undefined, new AppError('NOT_FOUND'))
    const notFound = await get(downstream, '/t/opt', {
      Authorization: `Bearer ${await token('member_x')}`,
    })
    expect(notFound.status).toBe(404)
    const anonNotFound = await get(downstream, '/t/opt')
    expect(anonNotFound.status).toBe(404)
  })
})

describe('isOwnerRequest · requireRoomEntry', () => {
  it('SRV-T-391 isOwnerRequest_cases', async () => {
    const { auth } = makeAuth()
    const app = appWith({ auth })
    app.get('/t/own', optionalToken, c => c.json({ owner: isOwnerRequest(c) }))
    const owner = async (bearer: string | null) =>
      (
        (await (
          await get(app, '/t/own', bearer === null ? {} : { Authorization: `Bearer ${bearer}` })
        ).json()) as { owner: boolean }
      ).owner
    expect(await owner(null)).toBe(false)
    expect(await owner(await token(OWNER_ID))).toBe(true)
    expect(await owner(await token('member_x'))).toBe(false)

    const empty = createAuthService({
      db: createDb(env.DB),
      logger: collectLogger().logger,
      now: () => NOW,
      config: { tokenSecret: TEST_SECRET, tokenMinLevel: 5, rateLimitPerMin: 20, ownerMbIds: [] },
    })
    const app2 = appWith({ auth: empty })
    app2.get('/t/own', optionalToken, c => c.json({ owner: isOwnerRequest(c) }))
    const res = await get(app2, '/t/own', { Authorization: `Bearer ${await token(OWNER_ID)}` })
    expect(await res.json()).toEqual({ owner: false })
  })

  it('SRV-T-392 requireRoomEntry_passes_target_and_header', async () => {
    const { auth } = makeAuth()
    const calls: [EntryTarget, EntryAccess][] = []
    let verdict: AppError | null = null
    const rooms = {
      assertEntry: (t: EntryTarget, a: EntryAccess) => {
        calls.push([t, a])
        return verdict === null ? Promise.resolve() : Promise.reject(verdict)
      },
    } as unknown as Services['rooms']
    const app = appWith({ auth, rooms })
    let reached = 0
    app.get(
      '/rooms/:id/x',
      optionalToken,
      requireRoomEntry('room'),
      c => ((reached += 1), c.json({ ok: true })),
    )
    app.get(
      '/messages/:id',
      requireRoomEntry('message'),
      c => ((reached += 1), c.json({ ok: true })),
    )
    app.get('/nokey', requireRoomEntry('room'), c => c.json({ ok: true }))

    await get(app, '/rooms/abc/x', {
      'X-Room-Key': 'k',
      Authorization: `Bearer ${await token(OWNER_ID)}`,
    })
    await get(app, '/messages/7')
    await get(app, '/messages/8', { 'X-Room-Key': '' })
    expect(calls[0]).toEqual([
      { kind: 'room', roomId: 'abc' },
      { entryKey: 'k', isOwner: true },
    ])
    expect(calls[1]).toEqual([
      { kind: 'message', messageId: 7 },
      { entryKey: null, isOwner: false },
    ])
    expect(calls[2]?.[1].entryKey).toBeNull()

    reached = 0
    verdict = new AppError('ROOM_LOCKED')
    const locked = await get(app, '/rooms/abc/x')
    expect(locked.status).toBe(403)
    expect(reached).toBe(0)

    verdict = null
    expect((await get(app, '/nokey')).status).toBe(500)
    const before = calls.length
    expect((await get(app, '/messages/abc')).status).toBe(200)
    expect(calls.length).toBe(before)
  })
})

describe('hitEnterLimit', () => {
  const rateKeys = async (): Promise<string[]> =>
    (
      await env.DB.prepare('SELECT mb_id FROM rate_limits ORDER BY mb_id').all<{ mb_id: string }>()
    ).results.map(r => r.mb_id)

  it('SRV-T-393 hitEnterLimit_counts_per_room', async () => {
    let now = 60_000 * 30_000
    const { auth, logs } = makeAuth(() => now, 5)
    for (let i = 0; i < 5; i += 1) await auth.hitEnterLimit('room-a')
    let caught: AppError | null = null
    try {
      await auth.hitEnterLimit('room-a')
    } catch (e) {
      caught = e as AppError
    }
    expect(caught?.code).toBe('RATE_LIMITED')
    expect(caught?.message).toBe('비밀번호를 너무 자주 입력했습니다. 잠시 후 다시 시도해 주세요.')
    expect(caught?.retryAfterSec).toBeGreaterThanOrEqual(1)
    expect(logs.find(l => l.event === 'room_enter_limited')).toEqual({
      level: 'warn',
      event: 'room_enter_limited',
      roomId: 'room-a',
    })
    await auth.hitEnterLimit('room-b')
    await auth.hitRateLimit('room-a')
    expect(await rateKeys()).toEqual(['enter:room-a', 'enter:room-b', 'room-a'])
    now += 60_000
    await auth.hitEnterLimit('room-a')
  })

  it('SRV-T-394 hitEnterLimit_default_and_purge', async () => {
    let now = 60_000 * 30_000
    const { auth } = makeAuth(() => now)
    for (let i = 0; i < 5; i += 1) await auth.hitEnterLimit('room-a')
    await expect(auth.hitEnterLimit('room-a')).rejects.toMatchObject({ code: 'RATE_LIMITED' })
    now += 60_000
    await auth.hitEnterLimit('room-b')
    expect(await rateKeys()).toEqual(['enter:room-b'])
  })
})
