// SRV-T-066~070·140~150 — doc/200_설계/server/messages.md §8 (D1 통합)
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { AppError } from '../src/app-error'
import { createDb, type Db } from '../src/db'
import { createMessagesService } from '../src/messages'
import { insertLine, insertLines, insertRoom, resetDb } from './helpers'

const NOW = 1_800_000_000_000

beforeEach(resetDb)

const service = () => createMessagesService({ db: createDb(env.DB), now: () => NOW })

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
    expect(p1.messages.map(m => m.id)).toEqual(ids.slice(40, 70))
    expect(p1.hasMore).toBe(true)
    const p2 = await svc.listMessages('a', { limit: 30, before: p1.messages[0]!.id })
    expect(p2.messages.map(m => m.id)).toEqual(ids.slice(10, 40))
    expect(p2.hasMore).toBe(true)
    const p3 = await svc.listMessages('a', { limit: 30, before: p2.messages[0]!.id })
    expect(p3.messages.map(m => m.id)).toEqual(ids.slice(0, 10))
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
    expect(page.messages.every(m => m.roomId === 'a')).toBe(true)
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
    expect(
      await codeOf(createMessagesService({ db, now: () => NOW }).listMessages('a', { limit: 0 })),
    ).toBe('VALIDATION_ERROR')
    expect(calls).toBe(0)
  })
})

// ---- S2 (SRV-T-140~150) — doc/200_설계/server/messages.md §8 ----
const AUTHOR_A = { mbId: 'mb_a', displayName: '시엘 팬텀하이브' }
const AUTHOR_B = { mbId: 'mb_b', displayName: '닉네임' }
const T2 = 999

const writer = (now = T2) => createMessagesService({ db: createDb(env.DB), now: () => now })

const trapMessagesDb = () => {
  const calls = { n: 0 }
  const trap = () => {
    calls.n += 1
    throw new Error('db touched')
  }
  const db = { messages: { insert: trap, updateText: trap, deleteById: trap } } as unknown as Db
  return { calls, db }
}

const roomUpdatedAt = async (id: string): Promise<number | undefined> =>
  (
    await env.DB.prepare('SELECT updated_at FROM rooms WHERE id = ?1')
      .bind(id)
      .first<{ updated_at: number }>()
  )?.updated_at

const messageCount = async (where = '1 = 1'): Promise<number> =>
  (await env.DB.prepare(`SELECT COUNT(*) AS n FROM messages WHERE ${where}`).first<{ n: number }>())
    ?.n ?? -1

describe('addUserMessage', () => {
  it('SRV-T-140 addUserMessage_stores_line_with_author_and_touches_room', async () => {
    await insertRoom('a', 'A', 1, 100)
    const m = await writer().addUserMessage('a', { text: ' 안녕 ', ooc: false }, AUTHOR_A)
    expect(m).toMatchObject({
      speaker: 'user',
      kind: 'line',
      text: '안녕',
      authorName: '시엘 팬텀하이브',
      createdAt: T2,
      roomId: 'a',
    })
    expect(Object.keys(m)).not.toContain('authorMbId')
    const row = await env.DB.prepare('SELECT author_mb_id FROM messages WHERE id = ?1')
      .bind(m.id)
      .first<{ author_mb_id: string }>()
    expect(row?.author_mb_id).toBe('mb_a')
    expect(await roomUpdatedAt('a')).toBe(T2)
  })

  it('SRV-T-141 addUserMessage_stores_ooc_kind_for_instruction', async () => {
    await insertRoom('a', 'A', 1, 100)
    const m = await writer().addUserMessage('a', { text: '더 어둡게', ooc: true }, AUTHOR_A)
    expect([m.kind, m.speaker]).toEqual(['ooc', 'user'])
  })

  it('SRV-T-142 addUserMessage_records_displayName_as_author_name', async () => {
    await insertRoom('a', 'A', 1, 100)
    for (const author of [AUTHOR_A, AUTHOR_B]) {
      const m = await writer().addUserMessage('a', { text: 'x', ooc: false }, author)
      expect(m.authorName).toBe(author.displayName)
    }
  })

  it('SRV-T-143 addUserMessage_validates_text_before_db', async () => {
    const { calls, db } = trapMessagesDb()
    const guarded = createMessagesService({ db, now: () => T2 })
    for (const text of ['', '  \n ', 'a'.repeat(2001), '😀'.repeat(2001)]) {
      expect(await codeOf(guarded.addUserMessage('a', { text, ooc: false }, AUTHOR_A))).toBe(
        'VALIDATION_ERROR',
      )
    }
    expect(calls.n).toBe(0)
    await insertRoom('a', 'A', 1, 100)
    for (const text of ['a'.repeat(2000), '😀'.repeat(2000), '첫 줄\n둘째 줄']) {
      const m = await writer().addUserMessage('a', { text, ooc: false }, AUTHOR_A)
      expect(m.text).toBe(text)
    }
  })

  it('SRV-T-144 addUserMessage_throws_NOT_FOUND_for_unknown_room_without_insert', async () => {
    await insertRoom('other', 'O', 1, 100)
    expect(await codeOf(writer().addUserMessage('nope', { text: 'x', ooc: false }, AUTHOR_A))).toBe(
      'NOT_FOUND',
    )
    expect(await messageCount()).toBe(0)
    expect(await roomUpdatedAt('other')).toBe(100)
  })

  it('SRV-T-145 addUserMessage_never_calls_fetch', async () => {
    await insertRoom('a', 'A', 1, 100)
    const spy = vi.spyOn(globalThis, 'fetch')
    try {
      await writer().addUserMessage('a', { text: 'line', ooc: false }, AUTHOR_A)
      await writer().addUserMessage('a', { text: 'ooc', ooc: true }, AUTHOR_A)
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })
})

describe('editMessage · deleteMessage', () => {
  it('SRV-T-146 editMessage_replaces_text_for_user_and_character_messages', async () => {
    await insertRoom('a', 'A', 1, 100)
    const user = await writer(500).addUserMessage('a', { text: '원문', ooc: false }, AUTHOR_A)
    const [lineId] = await insertLines('a', 1)
    const edited = await writer().editMessage(user.id, { text: ' 고침 ' })
    expect(edited).toEqual({ ...user, text: '고침' })
    const line = await writer().editMessage(lineId ?? 0, { text: '캐릭터 고침' })
    expect(line).toMatchObject({
      text: '캐릭터 고침',
      speaker: 'sebastian',
      kind: 'line',
      authorName: null,
    })
    const row = await env.DB.prepare('SELECT author_mb_id FROM messages WHERE id = ?1')
      .bind(user.id)
      .first<{ author_mb_id: string }>()
    expect(row?.author_mb_id).toBe('mb_a')
    expect(await roomUpdatedAt('a')).toBe(T2)
  })

  it('SRV-T-147 editMessage_rejects_bad_id_text_or_unknown_message', async () => {
    const { calls, db } = trapMessagesDb()
    const guarded = createMessagesService({ db, now: () => T2 })
    for (const id of [0, -1, 1.5, Number.NaN]) {
      expect(await codeOf(guarded.editMessage(id, { text: 'x' }))).toBe('NOT_FOUND')
    }
    expect(await codeOf(guarded.editMessage(1, { text: 'a'.repeat(2001) }))).toBe(
      'VALIDATION_ERROR',
    )
    expect(calls.n).toBe(0)
    await insertRoom('a', 'A', 1, 100)
    expect(await codeOf(writer().editMessage(999_999, { text: 'x' }))).toBe('NOT_FOUND')
    expect(await roomUpdatedAt('a')).toBe(100)
  })

  it('SRV-T-148 deleteMessage_removes_message_and_touches_room', async () => {
    await insertRoom('a', 'A', 1, 100)
    await insertRoom('b', 'B', 1, 100)
    const ids = await insertLines('a', 3)
    await writer().deleteMessage(ids[1] ?? 0)
    expect(await messageCount("room_id = 'a'")).toBe(2)
    const page = await writer().listMessages('a', {})
    expect(page.messages.map(m => m.id)).toEqual([ids[0], ids[2]])
    expect(await roomUpdatedAt('a')).toBe(T2)
    expect(await roomUpdatedAt('b')).toBe(100)
  })

  it('SRV-T-149 deleteMessage_throws_NOT_FOUND_for_bad_or_unknown_id', async () => {
    const { calls, db } = trapMessagesDb()
    const guarded = createMessagesService({ db, now: () => T2 })
    for (const id of [0, Number.NaN])
      expect(await codeOf(guarded.deleteMessage(id))).toBe('NOT_FOUND')
    expect(calls.n).toBe(0)
    await insertRoom('a', 'A', 1, 100)
    const [id] = await insertLines('a', 1)
    expect(await codeOf(writer().deleteMessage(999_999))).toBe('NOT_FOUND')
    await writer().deleteMessage(id ?? 0)
    expect(await codeOf(writer().deleteMessage(id ?? 0))).toBe('NOT_FOUND')
  })

  it('SRV-T-150 edit_and_delete_do_not_check_original_author', async () => {
    await insertRoom('a', 'A', 1, 100)
    const m = await writer().addUserMessage('a', { text: 'mb_a 글', ooc: false }, AUTHOR_A)
    const service = writer()
    expectTypeOf(service.editMessage).parameters.toEqualTypeOf<[number, { text: string }]>()
    expectTypeOf(service.deleteMessage).parameters.toEqualTypeOf<[number]>()
    await expect(service.editMessage(m.id, { text: '남이 고침' })).resolves.toMatchObject({
      text: '남이 고침',
    })
    await expect(service.deleteMessage(m.id)).resolves.toBeUndefined()
  })
})
