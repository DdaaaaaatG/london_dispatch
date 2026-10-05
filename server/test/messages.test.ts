// SRV-T-066~070 — doc/200_설계/server/messages.md §8 (D1 통합)
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../src/app-error'
import { createDb, type Db } from '../src/db'
import { createMessagesService } from '../src/messages'
import { insertLine, insertLines, insertRoom, resetDb } from './helpers'

beforeEach(resetDb)

const service = () => createMessagesService({ db: createDb(env.DB) })

const codeOf = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p
  } catch (e) {
    if (e instanceof AppError) return e.code
    throw e
  }
  return 'NO_ERROR'
}

describe('listMessages', () => {
  it('SRV-T-066 listMessages_pages_three_times_oldest_to_newest', async () => {
    await insertRoom('a', 'A', 1, 1)
    const ids = await insertLines('a', 70)
    const svc = service()
    const p1 = await svc.listMessages('a', { limit: 30 })
    expect(p1.messages.map((m) => m.id)).toEqual(ids.slice(40, 70))
    expect(p1.hasMore).toBe(true)
    const p2 = await svc.listMessages('a', { limit: 30, before: p1.messages[0]!.id })
    expect(p2.messages.map((m) => m.id)).toEqual(ids.slice(10, 40))
    expect(p2.hasMore).toBe(true)
    const p3 = await svc.listMessages('a', { limit: 30, before: p2.messages[0]!.id })
    expect(p3.messages.map((m) => m.id)).toEqual(ids.slice(0, 10))
    expect(p3.hasMore).toBe(false)
  })

  it('SRV-T-067 listMessages_excludes_other_rooms', async () => {
    await insertRoom('a', 'A', 1, 1)
    await insertRoom('b', 'B', 1, 1)
    for (let i = 0; i < 3; i += 1) {
      await insertLine('a', `a${i}`)
      await insertLine('b', `b${i}`)
    }
    const page = await service().listMessages('a', {})
    expect(page.messages).toHaveLength(3)
    expect(page.messages.every((m) => m.roomId === 'a')).toBe(true)
  })

  it('SRV-T-068 listMessages_returns_empty_page_for_empty_room', async () => {
    await insertRoom('a', 'A', 1, 1)
    expect(await service().listMessages('a', {})).toEqual({ messages: [], hasMore: false })
  })

  it('SRV-T-069 listMessages_throws_NOT_FOUND_for_unknown_room', async () => {
    expect(await codeOf(service().listMessages('nope', {}))).toBe('NOT_FOUND')
    expect(await codeOf(service().listMessages('nope', { before: 5 }))).toBe('NOT_FOUND')
  })

  it('SRV-T-070 listMessages_validates_before_touching_db', async () => {
    let calls = 0
    const trap = () => {
      calls += 1
      throw new Error('db touched')
    }
    const db = { rooms: { exists: trap }, messages: { pageDesc: trap } } as unknown as Db
    expect(await codeOf(createMessagesService({ db }).listMessages('a', { limit: 0 }))).toBe('VALIDATION_ERROR')
    expect(calls).toBe(0)
  })
})
