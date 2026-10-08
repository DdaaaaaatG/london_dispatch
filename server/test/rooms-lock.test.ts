// SRV-T-368~389 — doc/200_설계/server/rooms.md §12.10 (방 비밀번호 잠금 서비스, workers pool D1)
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '../src/app-error'
import type { Db } from '../src/db'
import { createRoomsService } from '../src/rooms'
import { deriveEntrySecret, issueEntryKey } from '../src/rooms/entry-key'
import { insertLines, insertRoom, makeRooms, makeRoomsDeps, resetDb, TEST_SECRET } from './helpers'

const NOW = 1_800_000_000_000
const OWNER = { isOwner: true }
const NOT_OWNER = { isOwner: false }

type AppErrorInfo = { code: string; message: string; retryAfterSec?: number | undefined }

const errOf = async (p: Promise<unknown>): Promise<AppErrorInfo | null> => {
  try {
    await p
  } catch (e) {
    if (e instanceof AppError) {
      return { code: e.code, message: e.message, retryAfterSec: e.retryAfterSec }
    }
    throw e
  }
  return null
}
const codeOf = async (p: Promise<unknown>): Promise<string> => (await errOf(p))?.code ?? 'NO_ERROR'

const passHashOf = async (id: string): Promise<string | null> =>
  (
    await env.DB.prepare('SELECT pass_hash FROM rooms WHERE id = ?1')
      .bind(id)
      .first<{ pass_hash: string | null }>()
  )?.pass_hash ?? null

const rateRows = async (): Promise<number> =>
  (await env.DB.prepare('SELECT COUNT(*) AS n FROM rate_limits').first<{ n: number }>())?.n ?? -1

const roomTarget = (roomId: string) => ({ kind: 'room', roomId }) as const

let deriveSpy: ReturnType<typeof vi.spyOn>

beforeEach(async () => {
  await resetDb()
  deriveSpy = vi.spyOn(crypto.subtle, 'deriveBits')
})
afterEach(() => deriveSpy.mockRestore())

/** 비밀번호 'abcd' 로 잠긴 방을 만들고 증명·해시를 돌려준다 */
const lockedRoom = async (made: ReturnType<typeof makeRooms>, password = 'abcd') => {
  const room = await made.rooms.createRoom({ title: '밀실', password })
  const hash = await passHashOf(room.id)
  if (hash === null || room.entryKey === null) throw new Error('not locked')
  return { id: room.id, hash, entryKey: room.entryKey }
}

describe('createRoom + password', () => {
  it('SRV-T-368 createRoom_with_password', async () => {
    const made = makeRooms({ now: () => NOW })
    const room = await made.rooms.createRoom({ title: '밀실', password: 'abcd' })
    const hash = await passHashOf(room.id)
    expect(hash).toMatch(/^pbkdf2-sha256\$[1-9][0-9]*\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/)
    expect(room.locked).toBe(true)
    expect(room.entryKey).not.toBeNull()
    await made.rooms.assertEntry(roomTarget(room.id), { entryKey: room.entryKey, isOwner: false })
    expect((await made.rooms.listRooms()).find(r => r.id === room.id)?.locked).toBe(true)
    expect(JSON.stringify(room)).not.toContain(hash ?? 'x')
  })

  it('SRV-T-369 createRoom_validation_order_before_db', async () => {
    const trap = (): never => {
      throw new Error('db touched')
    }
    const db = { rooms: { insert: trap } } as unknown as Db
    const guarded = createRoomsService({ ...makeRoomsDeps({ now: () => NOW }).deps, db })
    const cases: [string, string, string][] = [
      ['a'.repeat(61), 'abc', '방 제목은 1~60자로 입력해 주세요.'],
      ['제목', 'abc', '비밀번호는 4~32자로 입력해 주세요.'],
      ['제목', '', '비밀번호는 4~32자로 입력해 주세요.'],
    ]
    for (const [title, password, message] of cases) {
      expect(await errOf(guarded.createRoom({ title, password }))).toMatchObject({
        code: 'VALIDATION_ERROR',
        message,
      })
    }
    expect(deriveSpy).not.toHaveBeenCalled()
  })

  it('SRV-T-370 createRoom_without_password_unchanged', async () => {
    const room = await makeRooms({ now: () => NOW }).rooms.createRoom({ title: '열린 방' })
    expect(room.entryKey).toBeNull()
    expect(room.locked).toBe(false)
    expect(Object.keys(room).sort()).toEqual(
      ['id', 'title', 'createdAt', 'updatedAt', 'messageCount', 'locked', 'entryKey'].sort(),
    )
    expect(await passHashOf(room.id)).toBeNull()
  })
})

describe('enter', () => {
  it('SRV-T-371 enter_1_not_found', async () => {
    const { rooms } = makeRooms()
    expect(await codeOf(rooms.enter('nope', { password: 'abcd', ...NOT_OWNER }))).toBe('NOT_FOUND')
    expect(await rateRows()).toBe(0)
  })

  it('SRV-T-372 enter_2_unlocked_returns_null', async () => {
    await insertRoom('open', '열림', 1, 1)
    const { rooms } = makeRooms()
    expect(await rooms.enter('open', { password: 'whatever', ...NOT_OWNER })).toEqual({
      entryKey: null,
    })
    expect(await rateRows()).toBe(0)
    expect(deriveSpy).not.toHaveBeenCalled()
  })

  it('SRV-T-373 enter_3_owner_free_pass', async () => {
    const made = makeRooms()
    const locked = await lockedRoom(made)
    deriveSpy.mockClear()
    for (const input of [{ password: 'wrong!', ...OWNER }, { ...OWNER }]) {
      const { entryKey } = await made.rooms.enter(locked.id, input)
      await made.rooms.assertEntry(roomTarget(locked.id), { entryKey, isOwner: false })
    }
    expect(await rateRows()).toBe(0)
    expect(deriveSpy).not.toHaveBeenCalled()
  })

  it('SRV-T-374 enter_4_no_password_locked', async () => {
    const made = makeRooms()
    const locked = await lockedRoom(made)
    expect(await codeOf(made.rooms.enter(locked.id, { ...NOT_OWNER }))).toBe('ROOM_LOCKED')
    expect(await rateRows()).toBe(0)
  })

  it('SRV-T-375 enter_5_limit_before_hash', async () => {
    const made = makeRooms({ limit: 5 })
    const locked = await lockedRoom(made)
    for (let i = 0; i < 5; i += 1) {
      expect(await codeOf(made.rooms.enter(locked.id, { password: 'nope', ...NOT_OWNER }))).toBe(
        'ROOM_PASSWORD_WRONG',
      )
    }
    deriveSpy.mockClear()
    const err = await errOf(made.rooms.enter(locked.id, { password: 'abcd', ...NOT_OWNER }))
    expect(err?.code).toBe('RATE_LIMITED')
    expect(err?.message).toBe('비밀번호를 너무 자주 입력했습니다. 잠시 후 다시 시도해 주세요.')
    expect(err?.retryAfterSec).toBeGreaterThanOrEqual(1)
    expect(deriveSpy).not.toHaveBeenCalled()
    const warn = made.logs.find(l => l.event === 'room_enter_limited')
    expect(warn).toEqual({ level: 'warn', event: 'room_enter_limited', roomId: locked.id })
  })

  it('SRV-T-376 enter_5_recovers_next_window', async () => {
    let now = 60_000 * 30_000
    const made = makeRooms({ now: () => now, limit: 5 })
    const locked = await lockedRoom(made)
    for (let i = 0; i < 5; i += 1) {
      await errOf(made.rooms.enter(locked.id, { password: 'nope', ...NOT_OWNER }))
    }
    expect(await codeOf(made.rooms.enter(locked.id, { password: 'abcd', ...NOT_OWNER }))).toBe(
      'RATE_LIMITED',
    )
    now += 60_000
    const { entryKey } = await made.rooms.enter(locked.id, { password: 'abcd', ...NOT_OWNER })
    expect(entryKey).toBe(locked.entryKey)
  })

  it('SRV-T-377 enter_5_limit_is_per_room', async () => {
    const made = makeRooms({ limit: 5 })
    const a = await lockedRoom(made)
    const b = await lockedRoom(made)
    for (let i = 0; i < 5; i += 1) {
      await errOf(made.rooms.enter(a.id, { password: 'nope', ...NOT_OWNER }))
    }
    expect(await codeOf(made.rooms.enter(a.id, { password: 'abcd', ...NOT_OWNER }))).toBe(
      'RATE_LIMITED',
    )
    expect((await made.rooms.enter(b.id, { password: 'abcd', ...NOT_OWNER })).entryKey).toBe(
      b.entryKey,
    )
  })

  it('SRV-T-378 enter_6_wrong_password', async () => {
    const made = makeRooms()
    const locked = await lockedRoom(made)
    expect(await codeOf(made.rooms.enter(locked.id, { password: 'nope', ...NOT_OWNER }))).toBe(
      'ROOM_PASSWORD_WRONG',
    )
    const info = made.logs.find(l => l.event === 'room_enter_failed')
    expect(info?.level).toBe('info')
    expect(Object.keys(info ?? {}).filter(k => k !== 'level' && k !== 'event')).toEqual(['roomId'])
  })

  it('SRV-T-379 enter_6_broken_hash_closed', async () => {
    const made = makeRooms()
    await insertRoom('broken', '깨짐', 1, 1)
    await env.DB.prepare("UPDATE rooms SET pass_hash = ?1 WHERE id = 'broken'")
      .bind('x'.repeat(30))
      .run()
    expect(await codeOf(made.rooms.enter('broken', { password: 'abcd', ...NOT_OWNER }))).toBe(
      'ROOM_PASSWORD_WRONG',
    )
    expect(made.logs.find(l => l.event === 'room_pass_hash_invalid')).toEqual({
      level: 'error',
      event: 'room_pass_hash_invalid',
      roomId: 'broken',
    })
    const { entryKey } = await made.rooms.enter('broken', { ...OWNER })
    await made.rooms.assertEntry(roomTarget('broken'), { entryKey, isOwner: false })
  })

  it('SRV-T-380 enter_7_correct_password', async () => {
    const made = makeRooms()
    const locked = await lockedRoom(made)
    const { entryKey } = await made.rooms.enter(locked.id, { password: 'abcd', ...NOT_OWNER })
    expect(entryKey).toBe(
      await issueEntryKey(await deriveEntrySecret(TEST_SECRET), locked.id, locked.hash),
    )
    await made.rooms.assertEntry(roomTarget(locked.id), { entryKey, isOwner: false })
  })

  it('D-ROOM-14 enter_empty_password_counts_as_attempt', async () => {
    const made = makeRooms()
    const locked = await lockedRoom(made)
    expect(await codeOf(made.rooms.enter(locked.id, { password: '', ...NOT_OWNER }))).toBe(
      'ROOM_PASSWORD_WRONG',
    )
    expect(await rateRows()).toBe(1)
  })
})

describe('setPassword · clearPassword', () => {
  it('SRV-T-381 setPassword_locks_unlocked_room', async () => {
    await insertRoom('r', '방', 5, 100)
    const made = makeRooms({ now: () => 999 })
    const result = await made.rooms.setPassword('r', 'abcd', { mbId: 'm1' })
    expect(result.room.locked).toBe(true)
    expect(result.room.updatedAt).toBe(100)
    await made.rooms.assertEntry(roomTarget('r'), { entryKey: result.entryKey, isOwner: false })
    expect(made.logs.find(l => l.event === 'room_password_set')).toEqual({
      level: 'info',
      event: 'room_password_set',
      roomId: 'r',
      mbId: 'm1',
      wasLocked: false,
    })
  })

  it('SRV-T-382 setPassword_change_invalidates_old_key', async () => {
    const made = makeRooms()
    const locked = await lockedRoom(made)
    const k1 = locked.entryKey
    const k2 = (await made.rooms.setPassword(locked.id, 'efgh', { mbId: 'm1' })).entryKey
    await expect(
      made.rooms.assertEntry(roomTarget(locked.id), { entryKey: k1, isOwner: false }),
    ).rejects.toMatchObject({ code: 'ROOM_LOCKED' })
    await made.rooms.assertEntry(roomTarget(locked.id), { entryKey: k2, isOwner: false })
    const k3 = (await made.rooms.setPassword(locked.id, 'efgh', { mbId: 'm1' })).entryKey
    await expect(
      made.rooms.assertEntry(roomTarget(locked.id), { entryKey: k2, isOwner: false }),
    ).rejects.toMatchObject({ code: 'ROOM_LOCKED' })
    await made.rooms.assertEntry(roomTarget(locked.id), { entryKey: k3, isOwner: false })
    const sets = made.logs.filter(l => l.event === 'room_password_set')
    expect(sets.map(l => l.wasLocked)).toEqual([true, true])
  })

  it('SRV-T-383 setPassword_errors', async () => {
    await insertRoom('r', '방', 1, 1)
    const trap = (): never => {
      throw new Error('db touched')
    }
    const guarded = createRoomsService({
      ...makeRoomsDeps().deps,
      db: { rooms: { setPassHash: trap } } as unknown as Db,
    })
    expect(await codeOf(guarded.setPassword('r', 'abc', { mbId: 'm' }))).toBe('VALIDATION_ERROR')
    expect(deriveSpy).not.toHaveBeenCalled()
    expect(await codeOf(makeRooms().rooms.setPassword('nope', 'abcd', { mbId: 'm' }))).toBe(
      'NOT_FOUND',
    )
  })

  it('SRV-T-384 clearPassword_idempotent_and_reset_invalidates', async () => {
    const made = makeRooms()
    const locked = await lockedRoom(made)
    await insertLines(locked.id, 1)
    const before = (await made.rooms.listRooms()).find(r => r.id === locked.id)
    const first = await made.rooms.clearPassword(locked.id, { mbId: 'm1' })
    const second = await made.rooms.clearPassword(locked.id, { mbId: 'm1' })
    expect([first.locked, second.locked]).toEqual([false, false])
    expect([first.updatedAt, second.updatedAt]).toEqual([before?.updatedAt, before?.updatedAt])
    const cleared = made.logs.filter(l => l.event === 'room_password_cleared')
    expect(cleared.map(l => l.wasLocked)).toEqual([true, false])
    await made.rooms.setPassword(locked.id, 'abcd', { mbId: 'm1' })
    await expect(
      made.rooms.assertEntry(roomTarget(locked.id), { entryKey: locked.entryKey, isOwner: false }),
    ).rejects.toMatchObject({ code: 'ROOM_LOCKED' })
    expect(await codeOf(made.rooms.clearPassword('nope', { mbId: 'm1' }))).toBe('NOT_FOUND')
  })
})

describe('assertEntry', () => {
  it('SRV-T-385 assertEntry_room_target', async () => {
    const made = makeRooms()
    const a = await lockedRoom(made)
    const b = await lockedRoom(made)
    await insertRoom('open', '열림', 1, 1)
    const run = (roomId: string, entryKey: string | null, isOwner: boolean) =>
      codeOf(made.rooms.assertEntry(roomTarget(roomId), { entryKey, isOwner }))
    expect(await run('nope', null, false)).toBe('NO_ERROR')
    expect(await run('open', 'e1.junk', false)).toBe('NO_ERROR')
    expect(await run(a.id, null, true)).toBe('NO_ERROR')
    expect(await run(a.id, a.entryKey, false)).toBe('NO_ERROR')
    expect(await run(a.id, null, false)).toBe('ROOM_LOCKED')
    expect(await run(a.id, b.entryKey, false)).toBe('ROOM_LOCKED')
  })

  it('SRV-T-386 assertEntry_message_target', async () => {
    const made = makeRooms()
    const a = await lockedRoom(made)
    const b = await lockedRoom(made)
    await insertRoom('open', '열림', 1, 1)
    const [lockedMsg] = await insertLines(a.id, 1)
    const [openMsg] = await insertLines('open', 1)
    const run = (messageId: number, entryKey: string | null, isOwner: boolean) =>
      codeOf(made.rooms.assertEntry({ kind: 'message', messageId }, { entryKey, isOwner }))
    expect(await run(999_999, null, false)).toBe('NO_ERROR')
    expect(await run(openMsg!, null, false)).toBe('NO_ERROR')
    expect(await run(lockedMsg!, null, true)).toBe('NO_ERROR')
    expect(await run(lockedMsg!, a.entryKey, false)).toBe('NO_ERROR')
    expect(await run(lockedMsg!, b.entryKey, false)).toBe('ROOM_LOCKED')
    expect(await run(lockedMsg!, null, false)).toBe('ROOM_LOCKED')
  })

  it('SRV-T-387 assertEntry_skips_crypto_when_unneeded', async () => {
    const deps = makeRoomsDeps()
    const entrySecret = vi.fn(deps.deps.entrySecret)
    const rooms = createRoomsService({ ...deps.deps, entrySecret })
    const made = makeRooms()
    const locked = await lockedRoom(made)
    await insertRoom('open', '열림', 1, 1)
    await rooms.assertEntry(roomTarget('open'), { entryKey: 'e1.whatever', isOwner: false })
    await expect(
      rooms.assertEntry(roomTarget(locked.id), { entryKey: null, isOwner: false }),
    ).rejects.toMatchObject({ code: 'ROOM_LOCKED' })
    await expect(
      rooms.assertEntry(roomTarget(locked.id), { entryKey: 'A'.repeat(129), isOwner: false }),
    ).rejects.toMatchObject({ code: 'ROOM_LOCKED' })
    await rooms.assertEntry(roomTarget(locked.id), { entryKey: null, isOwner: true })
    expect(entrySecret).not.toHaveBeenCalled()
  })
})

describe('log hygiene · 0005', () => {
  it('SRV-T-388 logs_never_contain_secrets', async () => {
    const made = makeRooms({ limit: 2 })
    const password = 'S3cretPw!zz'
    const locked = await lockedRoom(made, password)
    await errOf(made.rooms.enter(locked.id, { password: 'wrongPw!!x', ...NOT_OWNER }))
    await made.rooms.enter(locked.id, { password, ...NOT_OWNER })
    await errOf(made.rooms.enter(locked.id, { password, ...NOT_OWNER }))
    const set = await made.rooms.setPassword(locked.id, 'NewPw!!!9999', { mbId: 'm1' })
    await made.rooms.clearPassword(locked.id, { mbId: 'm1' })
    const dump = JSON.stringify(made.logs)
    expect(made.logs.length).toBeGreaterThan(3)
    for (const secret of [
      password,
      'wrongPw!!x',
      'NewPw!!!9999',
      locked.hash,
      locked.entryKey,
      set.entryKey,
    ]) {
      expect(dump).not.toContain(secret)
    }
    expect(dump).not.toContain('pbkdf2-sha256')
    expect(dump).not.toContain('e1.')
  })

  it('SRV-T-389 existing_rooms_unlocked_after_0005', async () => {
    await env.DB.prepare(
      "INSERT INTO rooms (id, title, created_at, updated_at) VALUES ('old', '옛 방', 1, 1)",
    ).run()
    const { rooms } = makeRooms()
    expect((await rooms.listRooms()).find(r => r.id === 'old')?.locked).toBe(false)
    await rooms.assertEntry(roomTarget('old'), { entryKey: null, isOwner: false })
  })
})
