// SRV-T-040~043·130~135 — doc/200_설계/server/rooms.md §8
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../src/app-error'
import { createDb, type Db } from '../src/db'
import { createMessagesService } from '../src/messages'
import { createRoomsService } from '../src/rooms'
import {
  IDLE_GENERATE_DEPS,
  insertLines,
  insertRoom,
  makeRooms,
  makeRoomsDeps,
  resetDb,
} from './helpers'

const NOW = 1_800_000_000_000

beforeEach(resetDb)

describe('listRooms', () => {
  const service = () => makeRooms({ now: () => NOW }).rooms

  it('SRV-T-040 listRooms_returns_empty_array_when_no_rooms', async () => {
    expect(await service().listRooms()).toEqual([])
  })

  it('SRV-T-041 listRooms_sorts_by_updatedAt_desc', async () => {
    await insertRoom('a', 'A', 1, 100)
    await insertRoom('b', 'B', 1, 300)
    await insertRoom('c', 'C', 1, 200)
    expect((await service().listRooms()).map(r => r.updatedAt)).toEqual([300, 200, 100])
  })

  it('SRV-T-042 listRooms_includes_messageCount_and_fields', async () => {
    await insertRoom('a', 'A', 1, 3)
    await insertRoom('b', 'B', 1, 2)
    await insertRoom('c', 'C', 1, 1)
    await insertLines('b', 2)
    await insertLines('c', 5)
    const list = await service().listRooms()
    expect(list.map(r => r.messageCount)).toEqual([0, 2, 5])
    for (const r of list) {
      expect(Object.keys(r).sort()).toEqual([
        'createdAt',
        'id',
        'locked',
        'messageCount',
        'title',
        'updatedAt',
      ])
      expect(typeof r.createdAt).toBe('number')
      expect(typeof r.updatedAt).toBe('number')
    }
  })

  it('SRV-T-043 listRooms_propagates_db_failure', async () => {
    const failure = new Error('D1 down')
    const db = { rooms: { listSummaries: () => Promise.reject(failure) } } as unknown as Db
    await expect(
      createRoomsService({ ...makeRoomsDeps({ now: () => NOW }).deps, db }).listRooms(),
    ).rejects.toBe(failure)
  })
})

// ---- S2 (SRV-T-130~135) — doc/200_설계/server/rooms.md §8 ----
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const codeOf = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p
  } catch (e) {
    if (e instanceof AppError) return e.code
    throw e
  }
  return 'NO_ERROR'
}

const trapDb = () => {
  const calls = { n: 0 }
  const trap = () => {
    calls.n += 1
    throw new Error('db touched')
  }
  const db = {
    rooms: { insert: trap, updateTitle: trap, deleteCascade: trap },
  } as unknown as Db
  return { calls, db }
}

describe('createRoom · renameRoom · deleteRoom', () => {
  const service = () => makeRooms({ now: () => NOW }).rooms

  it('SRV-T-130 createRoom_trims_title_and_returns_summary', async () => {
    const room = await service().createRoom({ title: '  안개 낀 런던  ' })
    expect(room.title).toBe('안개 낀 런던')
    expect(room.id).toMatch(UUID_V4)
    expect([room.createdAt, room.updatedAt, room.messageCount]).toEqual([NOW, NOW, 0])
    const { entryKey, ...summary } = room
    expect(entryKey).toBeNull()
    expect(room.locked).toBe(false)
    expect((await service().listRooms())[0]).toEqual(summary)
  })

  it('SRV-T-131 createRoom_rejects_title_out_of_range_before_db', async () => {
    const { calls, db } = trapDb()
    const guarded = createRoomsService({ ...makeRoomsDeps({ now: () => NOW }).deps, db })
    for (const title of ['', '   ', 'a'.repeat(61), '😀'.repeat(61)]) {
      expect(await codeOf(guarded.createRoom({ title }))).toBe('VALIDATION_ERROR')
    }
    expect(calls.n).toBe(0)
    for (const title of ['a', 'a'.repeat(60), '😀'.repeat(60)]) {
      const room = await service().createRoom({ title })
      expect(room.title).toBe(title)
    }
  })

  it('SRV-T-132 renameRoom_updates_title_and_keeps_updatedAt', async () => {
    await insertRoom('a', '옛 제목', 5, 100)
    await insertLines('a', 2)
    const renamed = await makeRooms({ now: () => 999 }).rooms.renameRoom('a', {
      title: ' 새 제목 ',
    })
    expect(renamed).toEqual({
      id: 'a',
      title: '새 제목',
      createdAt: 5,
      updatedAt: 100,
      messageCount: 2,
      locked: false,
    })
    const row = await env.DB.prepare('SELECT title FROM rooms WHERE id = ?1')
      .bind('a')
      .first<{ title: string }>()
    expect(row?.title).toBe('새 제목')
  })

  it('SRV-T-133 renameRoom_throws_for_invalid_title_or_unknown_room', async () => {
    const { calls, db } = trapDb()
    const guarded = createRoomsService({ ...makeRoomsDeps({ now: () => NOW }).deps, db })
    expect(await codeOf(guarded.renameRoom('a', { title: 'a'.repeat(61) }))).toBe(
      'VALIDATION_ERROR',
    )
    expect(calls.n).toBe(0)
    expect(await codeOf(service().renameRoom('nope', { title: 'ok' }))).toBe('NOT_FOUND')
  })

  it('SRV-T-134 deleteRoom_removes_room_messages_and_memory_without_orphans', async () => {
    await insertRoom('a', 'A', 1, 1)
    await insertRoom('b', 'B', 1, 1)
    await insertLines('a', 3)
    await insertLines('b', 2)
    await env.DB.prepare(
      "INSERT INTO memory (room_id, summary, source_until_id, updated_at) VALUES ('a', 's', 1, 1)",
    ).run()
    await service().deleteRoom('a')
    const n = async (sql: string): Promise<number> =>
      (await env.DB.prepare(sql).first<{ n: number }>())?.n ?? -1
    expect(await n("SELECT COUNT(*) AS n FROM rooms WHERE id = 'a'")).toBe(0)
    expect(
      await n('SELECT COUNT(*) AS n FROM messages WHERE room_id NOT IN (SELECT id FROM rooms)'),
    ).toBe(0)
    expect(await n("SELECT COUNT(*) AS n FROM memory WHERE room_id = 'a'")).toBe(0)
    expect(await n("SELECT COUNT(*) AS n FROM messages WHERE room_id = 'b'")).toBe(2)
    const messages = createMessagesService({
      ...IDLE_GENERATE_DEPS,
      db: createDb(env.DB),
      now: () => NOW,
    })
    expect(await codeOf(messages.listMessages('a', {}))).toBe('NOT_FOUND')
  })

  it('SRV-T-135 deleteRoom_throws_NOT_FOUND_for_unknown_or_already_deleted', async () => {
    expect(await codeOf(service().deleteRoom('nope'))).toBe('NOT_FOUND')
    await insertRoom('a', 'A', 1, 1)
    await service().deleteRoom('a')
    expect(await codeOf(service().deleteRoom('a'))).toBe('NOT_FOUND')
  })
})
