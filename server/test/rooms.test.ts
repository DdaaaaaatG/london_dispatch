// SRV-T-040~043 — doc/200_설계/server/rooms.md §8
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDb, type Db } from '../src/db'
import { createRoomsService } from '../src/rooms'
import { insertLines, insertRoom, resetDb } from './helpers'

beforeEach(resetDb)

describe('listRooms', () => {
  const service = () => createRoomsService({ db: createDb(env.DB) })

  it('SRV-T-040 listRooms_returns_empty_array_when_no_rooms', async () => {
    expect(await service().listRooms()).toEqual([])
  })

  it('SRV-T-041 listRooms_sorts_by_updatedAt_desc', async () => {
    await insertRoom('a', 'A', 1, 100)
    await insertRoom('b', 'B', 1, 300)
    await insertRoom('c', 'C', 1, 200)
    expect((await service().listRooms()).map((r) => r.updatedAt)).toEqual([300, 200, 100])
  })

  it('SRV-T-042 listRooms_includes_messageCount_and_fields', async () => {
    await insertRoom('a', 'A', 1, 3)
    await insertRoom('b', 'B', 1, 2)
    await insertRoom('c', 'C', 1, 1)
    await insertLines('b', 2)
    await insertLines('c', 5)
    const list = await service().listRooms()
    expect(list.map((r) => r.messageCount)).toEqual([0, 2, 5])
    for (const r of list) {
      expect(Object.keys(r).sort()).toEqual(['createdAt', 'id', 'messageCount', 'title', 'updatedAt'])
      expect(typeof r.createdAt).toBe('number')
      expect(typeof r.updatedAt).toBe('number')
    }
  })

  it('SRV-T-043 listRooms_propagates_db_failure', async () => {
    const failure = new Error('D1 down')
    const db = { rooms: { listSummaries: () => Promise.reject(failure) } } as unknown as Db
    await expect(createRoomsService({ db }).listRooms()).rejects.toBe(failure)
  })
})
